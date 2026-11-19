import json
import shutil
from datetime import date, time
from pathlib import Path

from sqlalchemy import select, func

from database import Base, engine, SessionLocal
from models import Reminder, PushSubscription, SentOccurrence


BASE_DIR = Path(__file__).resolve().parent

REMINDERS_FILE = BASE_DIR / "reminders.json"
SUBSCRIPTIONS_FILE = BASE_DIR / "subscriptions.json"
SENT_FILE = BASE_DIR / "sent_occurrences.json"

BACKUP_DIR = BASE_DIR / "backup_before_postgres"


def read_json(path):
    if not path.exists():
        print(f"File not found (skipped): {path.name}")
        return []

    try:
        with path.open("r", encoding="utf-8") as file:
            data = json.load(file)

        return data if isinstance(data, list) else []

    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError(
            f"Could not safely read {path.name}: {error}"
        )


def create_backups():
    BACKUP_DIR.mkdir(exist_ok=True)

    for path in [
        REMINDERS_FILE,
        SUBSCRIPTIONS_FILE,
        SENT_FILE,
    ]:
        if path.exists():
            shutil.copy2(
                path,
                BACKUP_DIR / path.name
            )
            print(f"Backup created: {path.name}")


def migrate():
    print("\nStarting RemindMe migration...\n")

    # Ensure database tables exist.
    Base.metadata.create_all(bind=engine)

    # Read original JSON data.
    reminder_data = read_json(REMINDERS_FILE)
    subscription_data = read_json(SUBSCRIPTIONS_FILE)
    sent_data = read_json(SENT_FILE)

    reminder_count = 0
    subscription_count = 0
    sent_count = 0

    with SessionLocal() as session:

        # MIGRATE REMINDERS
        for item in reminder_data:

            if not isinstance(item, dict):
                continue

            try:
                reminder_id = str(item["id"])

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
                    "completedDates", []
                )

                if not isinstance(completed_dates, list):
                    completed_dates = []

                reminder = Reminder(
                    id=reminder_id,
                    title=str(item.get("title", "Untitled")),
                    description=item.get("description"),
                    date=reminder_date,
                    time=reminder_time,
                    category=item.get("category", "Personal"),
                    priority=item.get("priority", "Medium"),
                    repeat=item.get("repeat", "none"),
                    done=bool(item.get("done", False)),
                    completed_dates=completed_dates,
                )

                session.merge(reminder)
                reminder_count += 1

            except (KeyError, ValueError, TypeError) as error:
                print(
                    f"Skipped invalid reminder: {item.get('id')} - {error}"
                )

        # MIGRATE PUSH SUBSCRIPTIONS
        for item in subscription_data:

            if not isinstance(item, dict):
                continue

            keys = item.get("keys", {})

            endpoint = item.get("endpoint")
            p256dh = keys.get("p256dh")
            auth = keys.get("auth")

            if not endpoint or not p256dh or not auth:
                print("Skipped invalid push subscription.")
                continue

            subscription = PushSubscription(
                endpoint=endpoint,
                p256dh=p256dh,
                auth=auth,
            )

            session.merge(subscription)
            subscription_count += 1

        # MIGRATE SENT NOTIFICATION RECORDS
        for occurrence in sent_data:

            try:
                task_id, occurrence_date = str(
                    occurrence
                ).split("|", 1)

                sent_record = SentOccurrence(
                    occurrence_key=str(occurrence),
                    task_id=task_id,
                    occurrence_date=date.fromisoformat(
                        occurrence_date
                    ),
                )

                session.merge(sent_record)
                sent_count += 1

            except (ValueError, TypeError):
                print(
                    f"Skipped invalid sent record: {occurrence}"
                )

        # SAVE ALL DATA
        session.commit()

        # VERIFY DATABASE COUNTS
        total_reminders = session.scalar(
            select(func.count()).select_from(Reminder)
        )

        total_subscriptions = session.scalar(
            select(func.count()).select_from(PushSubscription)
        )

        total_sent = session.scalar(
            select(func.count()).select_from(SentOccurrence)
        )

    print("\n================================")
    print("REMINDME MIGRATION COMPLETED")
    print("================================")

    print(f"Reminders processed: {reminder_count}")
    print(f"Subscriptions processed: {subscription_count}")
    print(f"Sent records processed: {sent_count}")

    print("\nPostgreSQL database totals:")

    print(f"Reminders: {total_reminders}")
    print(f"Subscriptions: {total_subscriptions}")
    print(f"Sent occurrences: {total_sent}")

    print("\nOriginal JSON files have NOT been deleted.")
    print(f"Backups saved in: {BACKUP_DIR}")


if __name__ == "__main__":

    create_backups()

    try:
        migrate()

    except Exception as error:
        print("\nMigration failed:")
        print(error)
        raise SystemExit(1)

    finally:
        engine.dispose()