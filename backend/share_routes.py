from uuid import uuid4
import re

from datetime import date, time
from typing import Optional, Literal

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from pydantic import BaseModel, Field

from sqlalchemy import select
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Reminder
from auth_routes import get_current_user
from share_models import ReminderShare


router = APIRouter(
    prefix="/api",
    tags=["Shared Reminders"],
)


# ---------------------------------------------------------
# DATABASE
# ---------------------------------------------------------

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------
# USER HELPERS
# ---------------------------------------------------------

def get_user_id(current_user):
    return int(current_user["id"])


def get_user_email(current_user):
    email = str(
        current_user.get("email") or ""
    ).strip().casefold()

    if not email or not re.fullmatch(
        r"[^@\s]+@[^@\s]+\.[^@\s]+",
        email,
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Your authenticated account must provide "
                "a valid email address to use sharing."
            ),
        )

    return email


# ---------------------------------------------------------
# REQUEST MODELS
# ---------------------------------------------------------

class ShareCreate(BaseModel):
    email: str = Field(
        min_length=5,
        max_length=255,
    )

    permission: Literal["viewer", "editor"] = "viewer"


class SharedReminderUpdate(BaseModel):
    title: Optional[str] = Field(
        default=None,
        max_length=200,
    )

    description: Optional[str] = None

    date: Optional[date] = None

    time: Optional[time] = None

    category: Optional[str] = None

    priority: Optional[
        Literal["Low", "Medium", "High"]
    ] = None

    repeat: Optional[
        Literal["none", "daily", "weekly", "monthly"]
    ] = None


# ---------------------------------------------------------
# REMINDER OWNERSHIP
# ---------------------------------------------------------

def check_reminder_owner(
    db,
    reminder_id,
    user_id,
):
    reminder = db.scalar(
        select(Reminder).where(
            Reminder.id == reminder_id,
            Reminder.user_id == user_id,
        )
    )

    if not reminder:
        raise HTTPException(
            status_code=404,
            detail="Reminder not found or access denied.",
        )

    return reminder


# ---------------------------------------------------------
# SHARE RESPONSE
# ---------------------------------------------------------

def share_response(share):
    return {
        "id": share.id,
        "reminder_id": share.reminder_id,
        "email": share.shared_with_email,
        "permission": share.permission,
        "created_at": (
            share.created_at.isoformat()
            if share.created_at
            else None
        ),
    }


# =========================================================
# 1. SHARE A REMINDER
# =========================================================

@router.post("/reminders/{reminder_id}/shares")
def create_share(
    reminder_id: str,
    request: ShareCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = get_user_id(current_user)

    owner_email = get_user_email(current_user)

    recipient_email = request.email.strip().casefold()

    if not re.fullmatch(
        r"[^@\s]+@[^@\s]+\.[^@\s]+",
        recipient_email,
    ):
        raise HTTPException(
            status_code=400,
            detail="Enter a valid email address.",
        )

    if recipient_email == owner_email:
        raise HTTPException(
            status_code=400,
            detail="You cannot share a reminder with yourself.",
        )

    check_reminder_owner(
        db,
        reminder_id,
        user_id,
    )

    existing = db.scalar(
        select(ReminderShare).where(
            ReminderShare.reminder_id == reminder_id,
            ReminderShare.owner_user_id == user_id,
            ReminderShare.shared_with_email == recipient_email,
        )
    )

    if existing:
        existing.permission = request.permission
        db.commit()
        db.refresh(existing)

        return {
            "message": "Sharing permission updated.",
            "share": share_response(existing),
        }

    share = ReminderShare(
        id=str(uuid4()),
        reminder_id=reminder_id,
        owner_user_id=user_id,
        shared_with_email=recipient_email,
        permission=request.permission,
    )

    db.add(share)
    db.commit()
    db.refresh(share)

    return {
        "message": "Reminder shared successfully.",
        "share": share_response(share),
    }


# =========================================================
# 2. VIEW PEOPLE SHARING YOUR REMINDER
# =========================================================

@router.get("/reminders/{reminder_id}/shares")
def get_reminder_shares(
    reminder_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = get_user_id(current_user)

    check_reminder_owner(
        db,
        reminder_id,
        user_id,
    )

    shares = db.scalars(
        select(ReminderShare)
        .where(
            ReminderShare.reminder_id == reminder_id,
            ReminderShare.owner_user_id == user_id,
        )
        .order_by(ReminderShare.created_at.desc())
    ).all()

    return {
        "shares": [
            share_response(item)
            for item in shares
        ]
    }


# =========================================================
# 3. REVOKE ACCESS
# =========================================================

@router.delete(
    "/reminders/{reminder_id}/shares/{share_id}"
)
def delete_share(
    reminder_id: str,
    share_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = get_user_id(current_user)

    share = db.scalar(
        select(ReminderShare).where(
            ReminderShare.id == share_id,
            ReminderShare.reminder_id == reminder_id,
            ReminderShare.owner_user_id == user_id,
        )
    )

    if not share:
        raise HTTPException(
            status_code=404,
            detail="Sharing record not found.",
        )

    db.delete(share)
    db.commit()

    return {
        "message": "Access revoked successfully."
    }


# =========================================================
# 4. VIEW REMINDERS SHARED WITH THE LOGGED-IN USER
# =========================================================

@router.get("/shared-reminders")
def get_shared_reminders(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    email = get_user_email(current_user)

    results = db.execute(
        select(
            Reminder,
            ReminderShare.permission,
            ReminderShare.owner_user_id,
        )
        .join(
            ReminderShare,
            Reminder.id == ReminderShare.reminder_id,
        )
        .where(
            ReminderShare.shared_with_email == email
        )
    ).all()

    shared = []

    for reminder, permission, owner_user_id in results:

        shared.append({
            "id": reminder.id,
            "title": reminder.title,
            "description": reminder.description or "",
            "date": reminder.date.isoformat(),
            "time": (
                reminder.time.strftime("%H:%M")
                if reminder.time
                else ""
            ),
            "category": reminder.category or "Personal",
            "priority": reminder.priority or "Medium",
            "repeat": reminder.repeat or "none",
            "done": bool(reminder.done),
            "completedDates": reminder.completed_dates or [],
            "permission": permission,
            "owner_user_id": owner_user_id,
        })

    return {
        "shared_reminders": shared,
        "count": len(shared),
    }


# =========================================================
# 5. EDIT A SHARED REMINDER
# ONLY EDITORS CAN USE THIS ENDPOINT
# =========================================================

@router.patch("/shared-reminders/{reminder_id}")
def update_shared_reminder(
    reminder_id: str,
    request: SharedReminderUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    email = get_user_email(current_user)

    share = db.scalar(
        select(ReminderShare).where(
            ReminderShare.reminder_id == reminder_id,
            ReminderShare.shared_with_email == email,
        )
    )

    if not share:
        raise HTTPException(
            status_code=404,
            detail="Shared reminder not found.",
        )

    if share.permission != "editor":
        raise HTTPException(
            status_code=403,
            detail="You have viewer-only access.",
        )

    reminder = db.get(
        Reminder,
        reminder_id,
    )

    if not reminder:
        raise HTTPException(
            status_code=404,
            detail="Reminder no longer exists.",
        )

    changes = request.model_dump(
        exclude_unset=True
    )

    if not changes:
        raise HTTPException(
            status_code=400,
            detail="No changes were provided.",
        )

    if "title" in changes:

        if not changes["title"] or not changes["title"].strip():
            raise HTTPException(
                status_code=400,
                detail="Reminder title cannot be empty.",
            )

        changes["title"] = changes["title"].strip()

    for field, value in changes.items():
        setattr(reminder, field, value)

    db.commit()
    db.refresh(reminder)

    return {
        "message": "Shared reminder updated successfully.",
        "id": reminder.id,
        "title": reminder.title,
        "permission": share.permission,
    }