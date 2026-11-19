from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from database import SessionLocal
from models import Reminder
from auth_routes import get_current_user
from subtask_models import ReminderSubtask


router = APIRouter(
    prefix="/api",
    tags=["Reminder Subtasks"]
)


# -------------------------------------------------
# REQUEST MODELS
# -------------------------------------------------

class SubtaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class SubtaskUpdate(BaseModel):
    title: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=200
    )

    completed: Optional[bool] = None


# -------------------------------------------------
# CHECK PARENT REMINDER OWNERSHIP
# -------------------------------------------------

def check_reminder(session, reminder_id, user_id):

    reminder = session.scalar(
        select(Reminder).where(
            Reminder.id == str(reminder_id),
            Reminder.user_id == user_id
        )
    )

    if not reminder:
        raise HTTPException(
            status_code=404,
            detail="Reminder not found."
        )

    return reminder


# -------------------------------------------------
# FORMAT SUBTASK RESPONSE
# -------------------------------------------------

def format_subtask(subtask):

    return {
        "id": subtask.id,
        "reminder_id": subtask.reminder_id,
        "title": subtask.title,
        "completed": bool(subtask.completed),
        "created_at": (
            subtask.created_at.isoformat()
            if subtask.created_at
            else None
        )
    }


# -------------------------------------------------
# GET SUBTASKS
# -------------------------------------------------

@router.get("/reminders/{reminder_id}/subtasks")
def get_subtasks(
    reminder_id: str,
    current_user: dict = Depends(get_current_user)
):

    user_id = int(current_user["id"])

    with SessionLocal() as session:

        check_reminder(session, reminder_id, user_id)

        subtasks = session.scalars(
            select(ReminderSubtask)
            .where(
                ReminderSubtask.reminder_id == str(reminder_id),
                ReminderSubtask.user_id == user_id
            )
            .order_by(
                ReminderSubtask.created_at.asc()
            )
        ).all()

        return {
            "subtasks": [
                format_subtask(item)
                for item in subtasks
            ]
        }


# -------------------------------------------------
# CREATE SUBTASK
# -------------------------------------------------

@router.post("/reminders/{reminder_id}/subtasks")
def create_subtask(
    reminder_id: str,
    request: SubtaskCreate,
    current_user: dict = Depends(get_current_user)
):

    user_id = int(current_user["id"])

    title = request.title.strip()

    if not title:
        raise HTTPException(
            status_code=400,
            detail="Subtask title cannot be empty."
        )

    with SessionLocal() as session:

        check_reminder(session, reminder_id, user_id)

        subtask = ReminderSubtask(
            id=str(uuid4()),
            reminder_id=str(reminder_id),
            user_id=user_id,
            title=title,
            completed=False
        )

        session.add(subtask)
        session.commit()
        session.refresh(subtask)

        return {
            "message": "Subtask created successfully.",
            "subtask": format_subtask(subtask)
        }


# -------------------------------------------------
# UPDATE SUBTASK
# -------------------------------------------------

@router.patch(
    "/reminders/{reminder_id}/subtasks/{subtask_id}"
)
def update_subtask(
    reminder_id: str,
    subtask_id: str,
    request: SubtaskUpdate,
    current_user: dict = Depends(get_current_user)
):

    user_id = int(current_user["id"])

    updates = request.dict(exclude_unset=True)

    if not updates:
        raise HTTPException(
            status_code=400,
            detail="No changes provided."
        )

    with SessionLocal() as session:

        check_reminder(session, reminder_id, user_id)

        subtask = session.scalar(
            select(ReminderSubtask).where(
                ReminderSubtask.id == subtask_id,
                ReminderSubtask.reminder_id == str(reminder_id),
                ReminderSubtask.user_id == user_id
            )
        )

        if not subtask:
            raise HTTPException(
                status_code=404,
                detail="Subtask not found."
            )

        if "title" in updates:

            title = (updates["title"] or "").strip()

            if not title:
                raise HTTPException(
                    status_code=400,
                    detail="Subtask title cannot be empty."
                )

            subtask.title = title

        if "completed" in updates:
            subtask.completed = bool(updates["completed"])

        session.commit()
        session.refresh(subtask)

        return {
            "message": "Subtask updated successfully.",
            "subtask": format_subtask(subtask)
        }


# -------------------------------------------------
# DELETE SUBTASK
# -------------------------------------------------

@router.delete(
    "/reminders/{reminder_id}/subtasks/{subtask_id}"
)
def delete_subtask(
    reminder_id: str,
    subtask_id: str,
    current_user: dict = Depends(get_current_user)
):

    user_id = int(current_user["id"])

    with SessionLocal() as session:

        check_reminder(session, reminder_id, user_id)

        subtask = session.scalar(
            select(ReminderSubtask).where(
                ReminderSubtask.id == subtask_id,
                ReminderSubtask.reminder_id == str(reminder_id),
                ReminderSubtask.user_id == user_id
            )
        )

        if not subtask:
            raise HTTPException(
                status_code=404,
                detail="Subtask not found."
            )

        session.delete(subtask)
        session.commit()

        return {
            "message": "Subtask deleted successfully."
        }