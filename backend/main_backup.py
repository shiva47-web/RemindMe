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
from sqlalchemy import delete, func, select

from database import Base, SessionLocal, engine
from models import (
    Reminder,
    PushSubscription as PushSubscriptionDB,
    SentOccurrence,
)
from auth_routes import router as auth_router, get_current_user


# CONFIGURATION

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("remindme")

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "").strip()
VAPID_PRIVATE_KEY = BASE_DIR / os.getenv(
    "VAPID_PRIVATE_KEY", "private_key.pem"
)
VAPID_SUBJECT = os.getenv(
    "VAPID_SUBJECT", "mailto:admin@example.com"
)

TIMEZONE_FILE = BASE_DIR / "reminders_timezone.json"
CHECK_INTERVAL = 10


# REQUEST MODELS

class PushSubscriptionRequest(BaseModel):
    endpoint: str
    keys: dict[str, str]


class TestPushRequest(BaseModel):
    endpoint: str


class ReminderSyncRequest(BaseModel):
    timezone: str = "Asia/Kolkata"
    reminders: list[dict] = Field(default_factory=list)


# TIMEZONE

def get_timezone():
    try:
        timezone_name = "Asia/Kolkata"

        if TIMEZONE_FILE.exists():
            timezone_name = json.loads(
                TIMEZONE_FILE.read_text(encoding="utf-8")
            )

        return ZoneInfo(timezone_name)

    except (ZoneInfoNotFoundError, json.JSONDecodeError, OSError):
        logger.warning("Using default timezone Asia/Kolkata")
        return ZoneInfo("Asia/Kolkata")


# RECURRING REMINDER CALCULATION

def is_scheduled(task, day):
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