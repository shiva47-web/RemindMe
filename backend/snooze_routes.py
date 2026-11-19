import json

from datetime import datetime, timedelta
from pathlib import Path
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select

from database import SessionLocal
from models import Reminder, SentOccurrence
from snooze_models import ReminderSnooze
from auth_routes import get_current_user


router = APIRouter(tags=["Reminder Snooze"])

BASE_DIR = Path(__file__).resolve().parent

TIMEZONE_FILE = BASE_DIR / "reminders_timezone.json"


# GET USER TIMEZONE

def get_timezone():
    try:
        timezone_name = "Asia/Kolkata"

        if TIMEZONE_FILE.exists():
            saved = json.loads(
                TIMEZONE_FILE.read_text(encoding="utf-8")
            )

            if isinstance(saved, str) and saved:
                timezone_name = saved

        return ZoneInfo(timezone_name)

    except (
        ZoneInfoNotFoundError,
        json.JSONDecodeError,
        OSError,
        TypeError,
    ):
        return ZoneInfo("Asia/Kolkata")


# CHECK WHETHER REMINDER IS SCHEDULED TODAY

def is_scheduled_today(task, today):
    if today < task.date:
        return False

    repeat = task.repeat or "none"

    if repeat == "daily":
        return True

    if repeat == "weekly":
        return today.weekday() == task.date.weekday()

    if repeat == "monthly":
        return today.day == task.date.day

    return today == task.date


# CHECK WHETHER REMINDER IS COMPLETED

def is_completed_today(task, today):
    if (task.repeat or "none") != "none":
        return today.isoformat() in (
            task.completed_dates or []
        )

    return bool(task.done)


# REQUEST MODEL

class SnoozeRequest(BaseModel):
    minutes: Literal[5, 10, 30, 60]


# SNOOZE A REMINDER

@router.post("/api/reminders/{reminder_id}/snooze")
def snooze_reminder(
    reminder_id: str,
    request: SnoozeRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = int(current_user["id"])

    timezone = get_timezone()
    now = datetime.now(timezone)
    today = now.date()

    with SessionLocal() as session:

        # Only access reminders belonging to this user.
        task = session.scalar(
            select(Reminder).where(
                Reminder.id == reminder_id,
                Reminder.user_id == user_id,
            )
        )

        if not task:
            raise HTTPException(
                status_code=404,
                detail="Reminder not found."
            )

        if not task.time:
            raise HTTPException(
                status_code=400,
                detail="This reminder does not have a scheduled time."
            )

        if not is_scheduled_today(task, today):
            raise HTTPException(
                status_code=400,
                detail="This reminder is not scheduled for today."
            )

        if is_completed_today(task, today):
            raise HTTPException(
                status_code=400,
                detail="A completed reminder cannot be snoozed."
            )

        original_due = datetime.combine(
            today,
            task.time,
            tzinfo=timezone,
        )

        if now < original_due:
            raise HTTPException(
                status_code=400,
                detail="You can snooze a reminder after it becomes due."
            )

        snoozed_until = now + timedelta(
            minutes=request.minutes
        )

        # Keep the occurrence on the same day because the
        # existing scheduler identifies occurrences by date.
        if snoozed_until.date() != today:
            raise HTTPException(
                status_code=400,
                detail="This snooze would cross midnight. Choose a shorter snooze."
            )

        occurrence_key = (
            f"{task.id}|{today.isoformat()}"
        )

        snooze_record = ReminderSnooze(
            occurrence_key=occurrence_key,
            reminder_id=str(task.id),
            user_id=user_id,
            occurrence_date=today,
            snoozed_until=snoozed_until,
        )

        session.merge(snooze_record)

        # Remove the previous delivery record so the scheduler
        # can send this reminder again at the snoozed time.
        session.execute(
            delete(SentOccurrence).where(
                SentOccurrence.occurrence_key == occurrence_key
            )
        )

        session.commit()

    return {
        "success": True,
        "message": f"Reminder snoozed for {request.minutes} minutes.",
        "reminder_id": reminder_id,
        "occurrence_date": today.isoformat(),
        "snoozed_until": snoozed_until.isoformat(),
    }


# GET CURRENT USER'S ACTIVE SNOOZES

@router.get("/api/reminders/snoozes")
def get_active_snoozes(
    current_user: dict = Depends(get_current_user),
):
    user_id = int(current_user["id"])

    timezone = get_timezone()
    now = datetime.now(timezone)
    today = now.date()

    with SessionLocal() as session:

        records = session.scalars(
            select(ReminderSnooze).where(
                ReminderSnooze.user_id == user_id,
                ReminderSnooze.occurrence_date == today,
                ReminderSnooze.snoozed_until > now,
            )
        ).all()

        result = []

        for record in records:
            task = session.scalar(
                select(Reminder).where(
                    Reminder.id == record.reminder_id,
                    Reminder.user_id == user_id,
                )
            )

            if (
                task
                and is_scheduled_today(task, today)
                and not is_completed_today(task, today)
            ):
                result.append({
                    "reminder_id": record.reminder_id,
                    "occurrence_date": record.occurrence_date.isoformat(),
                    "snoozed_until": record.snoozed_until.isoformat(),
                })
            else:
                session.delete(record)

        session.commit()

    return {
        "snoozes": result
    }
