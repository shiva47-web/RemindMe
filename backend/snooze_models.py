from sqlalchemy import Column, String, Integer, Date, DateTime

from database import Base


class ReminderSnooze(Base):
    __tablename__ = "reminder_snoozes"

    occurrence_key = Column(
        String(255),
        primary_key=True
    )

    reminder_id = Column(
        String(100),
        nullable=False,
        index=True
    )

    user_id = Column(
        Integer,
        nullable=False,
        index=True
    )

    occurrence_date = Column(
        Date,
        nullable=False
    )

    snoozed_until = Column(
        DateTime(timezone=True),
        nullable=False
    )