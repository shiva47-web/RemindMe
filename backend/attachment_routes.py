import os
from pathlib import Path
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
)

from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Reminder
from auth_routes import get_current_user
from attachment_models import ReminderAttachment


router = APIRouter(
    prefix="/api",
    tags=["Reminder Attachments"],
)


# Store files inside the backend folder.
UPLOAD_DIRECTORY = (
    Path(__file__).resolve().parent
    / "uploads"
    / "reminder_attachments"
)

UPLOAD_DIRECTORY.mkdir(
    parents=True,
    exist_ok=True,
)

MAX_FILE_SIZE = 10 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".txt",
    ".csv",
    ".png",
    ".jpg",
    ".jpeg",
}


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def check_reminder_access(
    db: Session,
    reminder_id: str,
    user_id: int,
):
    reminder = (
        db.query(Reminder)
        .filter(
            Reminder.id == reminder_id,
            Reminder.user_id == user_id,
        )
        .first()
    )

    if not reminder:
        raise HTTPException(
            status_code=404,
            detail="Reminder not found.",
        )

    return reminder


def attachment_response(attachment):
    return {
        "id": attachment.id,
        "reminder_id": attachment.reminder_id,
        "original_filename": attachment.original_filename,
        "content_type": attachment.content_type,
        "file_size": attachment.file_size,
        "created_at": (
            attachment.created_at.isoformat()
            if attachment.created_at
            else None
        ),
    }


# GET: List attachments
@router.get("/reminders/{reminder_id}/attachments")
def get_attachments(
    reminder_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    check_reminder_access(
        db,
        reminder_id,
       current_user["id"],
    )

    attachments = (
        db.query(ReminderAttachment)
        .filter(
            ReminderAttachment.reminder_id == reminder_id,
            ReminderAttachment.user_id == current_user["id"],
        )
        .order_by(ReminderAttachment.created_at.desc())
        .all()
    )

    return {
        "attachments": [
            attachment_response(item)
            for item in attachments
        ]
    }


# POST: Upload attachment
@router.post("/reminders/{reminder_id}/attachments")
async def upload_attachment(
    reminder_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    check_reminder_access(
        db,
        reminder_id,
        current_user["id"],
    )

    original_filename = Path(
        file.filename or "attachment"
    ).name

    extension = Path(
        original_filename
    ).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="This file type is not supported.",
        )

    attachment_id = str(uuid4())

    stored_filename = (
        attachment_id + extension
    )

    destination = (
        UPLOAD_DIRECTORY / stored_filename
    )

    total_size = 0

    try:
        with destination.open("wb") as output:
            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="Maximum file size is 10 MB.",
                    )

                output.write(chunk)

        if total_size == 0:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty.",
            )

        attachment = ReminderAttachment(
            id=attachment_id,
            reminder_id=reminder_id,
            user_id=current_user["id"],
            original_filename=original_filename,
            stored_filename=stored_filename,
            content_type=file.content_type,
            file_size=total_size,
        )

        db.add(attachment)
        db.commit()
        db.refresh(attachment)

        return {
            "message": "Attachment uploaded successfully.",
            "attachment": attachment_response(attachment),
        }

    except Exception:
        db.rollback()

        if destination.exists():
            destination.unlink()

        raise

    finally:
        await file.close()


# GET: Download attachment
@router.get(
    "/reminders/{reminder_id}/attachments/{attachment_id}/download"
)
def download_attachment(
    reminder_id: str,
    attachment_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    check_reminder_access(
        db,
        reminder_id,
        current_user["id"],
    )

    attachment = (
        db.query(ReminderAttachment)
        .filter(
            ReminderAttachment.id == attachment_id,
            ReminderAttachment.reminder_id == reminder_id,
            ReminderAttachment.user_id == current_user["id"],
        )
        .first()
    )

    if not attachment:
        raise HTTPException(
            status_code=404,
            detail="Attachment not found.",
        )

    file_path = UPLOAD_DIRECTORY / attachment.stored_filename

    if not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Attachment file is missing.",
        )

    return FileResponse(
        path=str(file_path),
        filename=attachment.original_filename,
        media_type=attachment.content_type or "application/octet-stream",
    )


# DELETE: Delete attachment
@router.delete(
    "/reminders/{reminder_id}/attachments/{attachment_id}"
)
def delete_attachment(
    reminder_id: str,
    attachment_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    check_reminder_access(
        db,
        reminder_id,
        current_user["id"],
    )

    attachment = (
        db.query(ReminderAttachment)
        .filter(
            ReminderAttachment.id == attachment_id,
            ReminderAttachment.reminder_id == reminder_id,
            ReminderAttachment.user_id == current_user["id"],
        )
        .first()
    )

    if not attachment:
        raise HTTPException(
            status_code=404,
            detail="Attachment not found.",
        )

    file_path = UPLOAD_DIRECTORY / attachment.stored_filename

    db.delete(attachment)
    db.commit()

    if file_path.is_file():
        os.remove(file_path)

    return {
        "message": "Attachment deleted successfully."
    }