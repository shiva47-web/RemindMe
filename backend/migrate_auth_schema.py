from sqlalchemy import text

from database import Base, engine
from auth_models import User
from models import Reminder, PushSubscription, SentOccurrence


def migrate_database():

    try:
        # Ensure all existing tables and the users table exist.
        Base.metadata.create_all(bind=engine)

        with engine.begin() as connection:

            # Add user ownership to existing reminders.
            connection.execute(text("""
                ALTER TABLE reminders
                ADD COLUMN IF NOT EXISTS user_id
                INTEGER REFERENCES users(id)
            """))

            # Add user ownership to existing subscriptions.
            connection.execute(text("""
                ALTER TABLE push_subscriptions
                ADD COLUMN IF NOT EXISTS user_id
                INTEGER REFERENCES users(id)
            """))

            # Create indexes.
            connection.execute(text("""
                CREATE INDEX IF NOT EXISTS
                ix_reminders_user_id
                ON reminders(user_id)
            """))

            connection.execute(text("""
                CREATE INDEX IF NOT EXISTS
                ix_push_subscriptions_user_id
                ON push_subscriptions(user_id)
            """))

            reminder_count = connection.execute(
                text("SELECT COUNT(*) FROM reminders")
            ).scalar()

            subscription_count = connection.execute(
                text("SELECT COUNT(*) FROM push_subscriptions")
            ).scalar()

            user_count = connection.execute(
                text("SELECT COUNT(*) FROM users")
            ).scalar()

        print("Authentication database migration successful!")
        print(f"Users: {user_count}")
        print(f"Existing reminders preserved: {reminder_count}")
        print(f"Existing subscriptions preserved: {subscription_count}")

    except Exception as error:
        print("Database migration failed:")
        print(error)

    finally:
        engine.dispose()


if __name__ == "__main__":
    migrate_database()