import asyncio
import json
import logging
import os

from contextlib import asynccontextmanager
from datetime import date, datetime, time
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pywebpush import webpush, WebPushException
from share_models import ReminderShare
from share_routes import router as share_router
from sqlalchemy import delete, func, select

from attachment_models import ReminderAttachment
from attachment_routes import (
    UPLOAD_DIRECTORY,
    router as attachment_router,
)

from database import Base, SessionLocal, engine

from models import (
    Reminder,
    PushSubscription as PushSubscriptionDB,
    SentOccurrence,
)

from auth_routes import router as auth_router, get_current_user
from ai_routes import router as ai_router

from snooze_models import ReminderSnooze
from snooze_routes import router as snooze_router

from subtask_models import ReminderSubtask
from subtask_routes import router as subtask_router


# -----------------------------------------------------------------------------
# CONFIGURATION
# -----------------------------------------------------------------------------

logging.basicConfig(level=logging.INFO)

logger = logging.getLogger("remindme")

BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / ".env")

VAPID_PUBLIC_KEY = os.getenv(
    "VAPID_PUBLIC_KEY", ""
).strip()

VAPID_PRIVATE_KEY = BASE_DIR / os.getenv(
    "VAPID_PRIVATE_KEY", "private_key.pem"
)

VAPID_SUBJECT = os.getenv(
    "VAPID_SUBJECT", "mailto:admin@example.com"
)

TIMEZONE_FILE = BASE_DIR / "reminders_timezone.json"

CHECK_INTERVAL = 10


# -----------------------------------------------------------------------------
# REQUEST MODELS
# -----------------------------------------------------------------------------

class PushSubscriptionRequest(BaseModel):
    endpoint: str
    keys: dict[str, str]


class TestPushRequest(BaseModel):
    endpoint: str


class ReminderSyncRequest(BaseModel):
    timezone: str = "Asia/Kolkata"
    reminders: list[dict] = Field(default_factory=list)


# -----------------------------------------------------------------------------
# TIMEZONE
# -----------------------------------------------------------------------------

def get_timezone():

    try:

        timezone_name = "Asia/Kolkata"

        if TIMEZONE_FILE.exists():

            saved_timezone = json.loads(
                TIMEZONE_FILE.read_text(
                    encoding="utf-8"
                )
            )

            if isinstance(saved_timezone, str) and saved_timezone:
                timezone_name = saved_timezone

        return ZoneInfo(timezone_name)

    except (
        ZoneInfoNotFoundError,
        json.JSONDecodeError,
        OSError,
        TypeError,
    ):

        logger.warning(
            "Using default timezone Asia/Kolkata"
        )

        return ZoneInfo("Asia/Kolkata")


# -----------------------------------------------------------------------------
# RECURRING REMINDER CALCULATION
# -----------------------------------------------------------------------------

def is_scheduled(task, day: date) -> bool:

    start_date = task.date

    if day < start_date:
        return False

    repeat = task.repeat or "none"

    if repeat == "daily":
        return True

    if repeat == "weekly":
        return day.weekday() == start_date.weekday()

    if repeat == "monthly":
        return day.day == start_date.day

    return day == start_date


def is_completed(task, day: date) -> bool:

    if (task.repeat or "none") != "none":

        return day.isoformat() in (
            task.completed_dates or []
        )

    return bool(task.done)


# -----------------------------------------------------------------------------
# PUSH NOTIFICATION DELIVERY
# -----------------------------------------------------------------------------

def send_push(subscription, payload: dict) -> None:

    if not VAPID_PRIVATE_KEY.is_file():

        raise RuntimeError(
            "VAPID private key is missing."
        )

    subscription_info = {

        "endpoint": subscription.endpoint,

        "keys": {
            "p256dh": subscription.p256dh,
            "auth": subscription.auth,
        },
    }

    webpush(
        subscription_info=subscription_info,
        data=json.dumps(payload),
        vapid_private_key=str(VAPID_PRIVATE_KEY),
        vapid_claims={
            "sub": VAPID_SUBJECT
        },
        ttl=86400,
    )


# -----------------------------------------------------------------------------
# BACKGROUND SCHEDULER
# -----------------------------------------------------------------------------

async def check_due_reminders() -> None:

    timezone = get_timezone()

    now = datetime.now(timezone)

    today = now.date()

    with SessionLocal() as session:

        all_reminders = session.scalars(
            select(Reminder).where(
                Reminder.user_id.is_not(None)
            )
        ).all()

        all_subscriptions = session.scalars(
            select(PushSubscriptionDB).where(
                PushSubscriptionDB.user_id.is_not(None)
            )
        ).all()

        subscriptions_by_user = {}

        for subscription in all_subscriptions:

            subscriptions_by_user.setdefault(
                subscription.user_id,
                []
            ).append(subscription)

        if not all_reminders or not all_subscriptions:
            return

        for task in all_reminders:

            if task.user_id is None or not task.time:
                continue

            if not is_scheduled(task, today):
                continue

            if is_completed(task, today):
                continue

            owner_subscriptions = subscriptions_by_user.get(
                task.user_id,
                []
            )

            if not owner_subscriptions:
                continue

            occurrence_key = (
                f"{task.id}|{today.isoformat()}"
            )

            already_sent = session.get(
                SentOccurrence,
                occurrence_key,
            )

            if already_sent:
                continue

            due_at = datetime.combine(
                today,
                task.time,
                tzinfo=timezone,
            )

            snooze_record = session.get(
                ReminderSnooze,
                occurrence_key,
            )

            if snooze_record is not None:

                if snooze_record.user_id == task.user_id:

                    due_at = snooze_record.snoozed_until

                else:

                    session.delete(snooze_record)
                    snooze_record = None

            if now < due_at:
                continue

                      # Check reminder priority

            is_high_priority = (
                (task.priority or "Medium").lower() == "high"
            )

            # Notification payload

            payload = {
                "title": (
                    f"🚨 HIGH PRIORITY: {task.title}"
                    if is_high_priority
                    else f"Reminder: {task.title}"
                ),

                "body": (
                    f"Important reminder! {task.description}"
                    if is_high_priority and task.description
                    else (
                        f"Important {task.category} reminder is due now!"
                        if is_high_priority
                        else (
                            task.description
                            or f"{task.category} reminder is due now!"
                        )
                    )
                ),

                "tag": f"remindme-{task.id}-{today.isoformat()}",

                "url": "/",

                "priority": task.priority or "Medium",

                "requireInteraction": is_high_priority,
            }

            successful_deliveries = 0

            stale_endpoints = []

            for subscription in owner_subscriptions:

                try:

                    await asyncio.to_thread(
                        send_push,
                        subscription,
                        payload,
                    )

                    successful_deliveries += 1

                except WebPushException as error:

                    response = getattr(
                        error,
                        "response",
                        None,
                    )

                    status = (
                        response.status_code
                        if response is not None
                        else None
                    )

                    logger.error(
                        "Push failed for reminder %s: HTTP %s",
                        task.id,
                        status,
                    )

                    if status in (404, 410):

                        stale_endpoints.append(
                            subscription.endpoint
                        )

                except Exception:

                    logger.exception(
                        "Unexpected push error for reminder %s",
                        task.id,
                    )

            for endpoint in stale_endpoints:

                stale_subscription = session.get(
                    PushSubscriptionDB,
                    endpoint,
                )

                if stale_subscription:

                    session.delete(
                        stale_subscription
                    )

            if successful_deliveries > 0:

                session.add(
                    SentOccurrence(
                        occurrence_key=occurrence_key,
                        task_id=str(task.id),
                        occurrence_date=today,
                    )
                )

                if snooze_record is not None:

                    session.delete(snooze_record)

                session.commit()

                logger.info(
                    "Reminder %s for user %s sent on %s",
                    task.id,
                    task.user_id,
                    today,
                )

            elif stale_endpoints:

                session.commit()


# -----------------------------------------------------------------------------
# SCHEDULER LOOP
# -----------------------------------------------------------------------------

async def scheduler_loop() -> None:

    logger.info(
        "RemindMe PostgreSQL scheduler started."
    )

    while True:

        try:

            await check_due_reminders()

        except asyncio.CancelledError:

            raise

        except Exception:

            logger.exception(
                "Scheduler execution failed."
            )

        await asyncio.sleep(CHECK_INTERVAL)


# -----------------------------------------------------------------------------
# FASTAPI LIFESPAN
# -----------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):

    # Create missing database tables.
    # Existing data is preserved.

    Base.metadata.create_all(
        bind=engine
    )

    scheduler_task = asyncio.create_task(
        scheduler_loop()
    )

    try:

        yield

    finally:

        scheduler_task.cancel()

        try:

            await scheduler_task

        except asyncio.CancelledError:

            pass

        logger.info(
            "Scheduler stopped."
        )


# -----------------------------------------------------------------------------
# FASTAPI APPLICATION
# -----------------------------------------------------------------------------

app = FastAPI(

    title="RemindMe API",

    description=(
        "PostgreSQL-backed reminder service with account authentication "
        "and owner-scoped push notifications"
    ),

    version="3.0.0",

    lifespan=lifespan,
)


# -----------------------------------------------------------------------------
# CORS MIDDLEWARE
# IMPORTANT: Register AFTER creating the FastAPI application.
# -----------------------------------------------------------------------------

app.add_middleware(

    CORSMiddleware,

    allow_origins=[

        "http://localhost:4173",

        "http://127.0.0.1:4173",

        "http://localhost:5173",

        "http://127.0.0.1:5173",
    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# REGISTER ROUTERS
# -----------------------------------------------------------------------------

app.include_router(auth_router)

app.include_router(ai_router)

app.include_router(snooze_router)

app.include_router(subtask_router)

app.include_router(attachment_router)

app.include_router(share_router)


# -----------------------------------------------------------------------------
# HOME
# -----------------------------------------------------------------------------

@app.get("/")
def home():

    return {

        "message": "RemindMe Backend is running!",

        "database": "PostgreSQL",

        "scheduler": "active",

        "authentication": "enabled",
    }


# -----------------------------------------------------------------------------
# PUBLIC VAPID KEY
# -----------------------------------------------------------------------------

@app.get("/api/vapid-public-key")
def get_vapid_public_key():

    if not VAPID_PUBLIC_KEY:

        raise HTTPException(
            status_code=500,
            detail="VAPID public key is missing.",
        )

    return {
        "publicKey": VAPID_PUBLIC_KEY
    }


# -----------------------------------------------------------------------------
# SAVE PUSH SUBSCRIPTION
# -----------------------------------------------------------------------------

@app.post("/api/subscribe")
def subscribe(

    request: PushSubscriptionRequest,

    current_user: dict = Depends(get_current_user),
):

    p256dh = request.keys.get("p256dh")

    auth_key = request.keys.get("auth")

    if not request.endpoint.strip() or not p256dh or not auth_key:

        raise HTTPException(
            status_code=400,
            detail=(
                "A valid endpoint, p256dh key and auth key are required."
            ),
        )

    user_id = int(current_user["id"])

    with SessionLocal() as session:

        existing = session.get(
            PushSubscriptionDB,
            request.endpoint,
        )

        if existing:

            existing.user_id = user_id
            existing.p256dh = p256dh
            existing.auth = auth_key

        else:

            session.add(
                PushSubscriptionDB(
                    endpoint=request.endpoint,
                    user_id=user_id,
                    p256dh=p256dh,
                    auth=auth_key,
                )
            )

        session.commit()

        count = session.scalar(

            select(func.count())
            .select_from(PushSubscriptionDB)
            .where(
                PushSubscriptionDB.user_id == user_id
            )
        )

    return {

        "message": "Push subscription saved!",

        "total": count,
    }


# -----------------------------------------------------------------------------
# TEST PUSH NOTIFICATION
# -----------------------------------------------------------------------------

@app.post("/api/test-push")
def test_push(

    request: TestPushRequest,

    current_user: dict = Depends(get_current_user),
):

    user_id = int(current_user["id"])

    with SessionLocal() as session:

        subscription = session.scalar(

            select(PushSubscriptionDB).where(

                PushSubscriptionDB.endpoint == request.endpoint,

                PushSubscriptionDB.user_id == user_id,
            )
        )

        if not subscription:

            raise HTTPException(
                status_code=404,
                detail=(
                    "Push subscription not found for this account."
                ),
            )

        try:

            send_push(
                subscription,
                {
                    "title": "RemindMe Test Notification",
                    "body": (
                        "Your account's push notifications are working!"
                    ),
                    "tag": "remindme-test",
                    "url": "/",
                },
            )

            return {
                "message": (
                    "Test push notification sent successfully!"
                )
            }

        except WebPushException as error:

            response = getattr(
                error,
                "response",
                None,
            )

            status = (
                response.status_code
                if response is not None
                else None
            )

            logger.exception(
                "Test push failed."
            )

            if status in (404, 410):

                session.delete(subscription)
                session.commit()

            raise HTTPException(
                status_code=502,
                detail=f"Push delivery failed: HTTP {status}",
            )

        except Exception:

            logger.exception(
                "Unexpected test push failure."
            )

            raise HTTPException(
                status_code=502,
                detail="Push delivery failed.",
            )


# -----------------------------------------------------------------------------
# LOAD REMINDERS FOR THE LOGGED-IN USER
# -----------------------------------------------------------------------------

@app.get("/api/reminders")
def get_user_reminders(

    current_user: dict = Depends(get_current_user),
):

    user_id = int(current_user["id"])

    with SessionLocal() as session:

        reminders = session.scalars(

            select(Reminder)
            .where(Reminder.user_id == user_id)
            .order_by(
                Reminder.date.asc(),
                Reminder.time.asc(),
            )
        ).all()

        result = [

            {
                "id": task.id,
                "title": task.title,
                "description": task.description or "",
                "date": task.date.isoformat(),
                "time": (
                    task.time.strftime("%H:%M")
                    if task.time else ""
                ),
                "category": task.category or "Personal",
                "priority": task.priority or "Medium",
                "repeat": task.repeat or "none",
                "done": bool(task.done),
                "completedDates": task.completed_dates or [],
            }

            for task in reminders
        ]

    return {

        "reminders": result,

        "count": len(result),
    }


# -----------------------------------------------------------------------------
# SYNCHRONIZE REMINDERS
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# SYNCHRONIZE REMINDERS
# ONLY THE CURRENT USER'S REMINDERS
# -----------------------------------------------------------------------------

@app.post("/api/reminders/sync")
def sync_reminders(
    request: ReminderSyncRequest,
    current_user: dict = Depends(get_current_user),
):
    # Validate browser timezone.
    try:
        ZoneInfo(request.timezone)

    except (
        ZoneInfoNotFoundError,
        ValueError,
        TypeError,
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid browser timezone.",
        )

    user_id = int(current_user["id"])
    clean_reminders = request.reminders

    # Store attachment information before deleting database records.
    attachments_to_delete = []

    with SessionLocal() as session:

        # Load existing reminders belonging to this user.
        old_reminders = {
            str(task.id): task
            for task in session.scalars(
                select(Reminder).where(
                    Reminder.user_id == user_id
                )
            ).all()
        }

        # Prevent overwriting another user's reminders.
        incoming_ids = {
            str(item.get("id"))
            for item in clean_reminders
            if item.get("id") is not None
        }

        if incoming_ids:
            conflicting_reminders = session.scalars(
                select(Reminder).where(
                    Reminder.id.in_(incoming_ids)
                )
            ).all()

            for conflicting in conflicting_reminders:
                if conflicting.user_id != user_id:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            "One or more reminder IDs belong to "
                            "another account. No reminders were "
                            "synchronized."
                        ),
                    )

        # Protect existing reminders from accidental empty sync.
        if not clean_reminders and old_reminders:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Empty synchronization rejected to protect "
                    "your saved reminders."
                ),
            )

        received_ids = set()

        # Save or update reminders.
        for item in clean_reminders:
            try:
                task_id = str(item["id"])

                if not task_id or task_id == "None":
                    raise ValueError(
                        "Reminder ID is required."
                    )

                if task_id in received_ids:
                    raise ValueError(
                        "Duplicate reminder ID."
                    )

                title = str(
                    item.get("title", "Untitled")
                ).strip()

                if not title:
                    raise ValueError(
                        "Reminder title cannot be empty."
                    )

                reminder_date = date.fromisoformat(
                    str(item["date"])
                )

                raw_time = item.get("time")

                reminder_time = (
                    time.fromisoformat(str(raw_time))
                    if raw_time
                    else None
                )

                completed_dates = item.get(
                    "completedDates",
                    [],
                )

                if not isinstance(completed_dates, list):
                    completed_dates = []

                completed_dates = [
                    str(value)
                    for value in completed_dates
                ]

                reminder = Reminder(
                    id=task_id,
                    user_id=user_id,
                    title=title,
                    description=item.get("description"),
                    date=reminder_date,
                    time=reminder_time,
                    category=str(
                        item.get("category", "Personal")
                    ),
                    priority=str(
                        item.get("priority", "Medium")
                    ),
                    repeat=str(
                        item.get("repeat", "none")
                    ),
                    done=bool(
                        item.get("done", False)
                    ),
                    completed_dates=completed_dates,
                )

                old = old_reminders.get(task_id)

                # Clear notification and snooze history
                # when the reminder schedule changes.
                if old is not None:
                    changed = (
                        old.date != reminder_date
                        or old.time != reminder_time
                        or old.repeat != reminder.repeat
                        or old.title != reminder.title
                        or old.description != reminder.description
                        or old.done != reminder.done
                        or (
                            (old.completed_dates or [])
                            != completed_dates
                        )
                    )

                    if changed:
                        session.execute(
                            delete(SentOccurrence).where(
                                SentOccurrence.task_id == task_id
                            )
                        )

                        session.execute(
                            delete(ReminderSnooze).where(
                                ReminderSnooze.reminder_id == task_id,
                                ReminderSnooze.user_id == user_id,
                            )
                        )

                session.merge(reminder)
                received_ids.add(task_id)

            except (
                KeyError,
                ValueError,
                TypeError,
            ) as error:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid reminder data: {error}",
                )

        # Find reminders deleted by this user.
        deleted_ids = (
            set(old_reminders.keys()) - received_ids
        )

        if deleted_ids:

            # Retrieve attachment metadata before deleting it.
            attachments_to_delete = session.scalars(
                select(ReminderAttachment).where(
                    ReminderAttachment.reminder_id.in_(deleted_ids),
                    ReminderAttachment.user_id == user_id,
                )
            ).all()

            # Delete parent reminders.
            session.execute(
                delete(Reminder).where(
                    Reminder.user_id == user_id,
                    Reminder.id.in_(deleted_ids),
                )
            )

            # Delete notification history.
            session.execute(
                delete(SentOccurrence).where(
                    SentOccurrence.task_id.in_(deleted_ids)
                )
            )

            # Delete snooze records.
            session.execute(
                delete(ReminderSnooze).where(
                    ReminderSnooze.reminder_id.in_(deleted_ids),
                    ReminderSnooze.user_id == user_id,
                )
            )

            # Delete subtasks.
            session.execute(
                delete(ReminderSubtask).where(
                    ReminderSubtask.reminder_id.in_(deleted_ids),
                    ReminderSubtask.user_id == user_id,
                )
            )

            # Delete attachment metadata.
            session.execute(
                delete(ReminderAttachment).where(
                    ReminderAttachment.reminder_id.in_(deleted_ids),
                    ReminderAttachment.user_id == user_id,
                )
            )

            # Delete sharing permissions.
            session.execute(
                delete(ReminderShare).where(
                    ReminderShare.reminder_id.in_(deleted_ids),
                    ReminderShare.owner_user_id == user_id,
                )
            )

        # Save all database changes.
        session.commit()

        # Delete physical attachment files after successful commit.
        for attachment in attachments_to_delete:
            file_path = (
                UPLOAD_DIRECTORY / attachment.stored_filename
            ).resolve()

            if (
                file_path.parent == UPLOAD_DIRECTORY.resolve()
                and file_path.is_file()
            ):
                try:
                    file_path.unlink()

                except OSError:
                    logger.exception(
                        "Could not delete attachment file %s",
                        file_path,
                    )

        # Get total reminders belonging to this user.
        total = session.scalar(
            select(func.count())
            .select_from(Reminder)
            .where(
                Reminder.user_id == user_id
            )
        )

    # Save browser timezone.
    try:
        TIMEZONE_FILE.write_text(
            json.dumps(request.timezone),
            encoding="utf-8",
        )

    except OSError:
        logger.exception(
            "Could not save the browser timezone."
        )

    return {
        "message": "Reminders synchronized with PostgreSQL!",
        "count": total,
        "deleted": len(deleted_ids),
        "user_id": user_id,
    }
# -----------------------------------------------------------------------------
# DATABASE STATUS
# -----------------------------------------------------------------------------

@app.get("/api/reminders/status")
def reminder_status(

    current_user: dict = Depends(get_current_user),
):

    user_id = int(current_user["id"])

    with SessionLocal() as session:

        reminder_count = session.scalar(

            select(func.count())
            .select_from(Reminder)
            .where(
                Reminder.user_id == user_id
            )
        )

        subscription_count = session.scalar(

            select(func.count())
            .select_from(PushSubscriptionDB)
            .where(
                PushSubscriptionDB.user_id == user_id
            )
        )

        user_task_ids = select(
            Reminder.id
        ).where(
            Reminder.user_id == user_id
        )

        sent_count = session.scalar(

            select(func.count())
            .select_from(SentOccurrence)
            .where(
                SentOccurrence.task_id.in_(user_task_ids)
            )
        )

    return {

        "scheduler": "active",

        "database": "PostgreSQL",

        "check_interval_seconds": CHECK_INTERVAL,

        "saved_reminders": reminder_count,

        "push_subscriptions": subscription_count,

        "sent_occurrences": sent_count,
    }


# -----------------------------------------------------------------------------
# SUBSCRIPTION COUNT
# -----------------------------------------------------------------------------

@app.get("/api/subscriptions/count")
def subscription_count(

    current_user: dict = Depends(get_current_user),
):

    user_id = int(current_user["id"])

    with SessionLocal() as session:

        total = session.scalar(

            select(func.count())
            .select_from(PushSubscriptionDB)
            .where(
                PushSubscriptionDB.user_id == user_id
            )
        )

    return {
        "total_subscriptions": total
    }