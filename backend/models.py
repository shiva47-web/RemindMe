from datetime import date, datetime, time

from sqlalchemy import (
    String,
    Text,
    Date,
    Time,
    Boolean,
    DateTime,
    JSON,
    Integer,
    ForeignKey,
    func,
)

from sqlalchemy.orm import Mapped, mapped_column

from database import Base


# REMINDERS TABLE
class Reminder(Base):

    __tablename__ = "reminders"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
    )

    user_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    time: Mapped[time | None] = mapped_column(
        Time,
        nullable=True,
    )

    category: Mapped[str] = mapped_column(
        String(50),
        default="Personal",
    )

    priority: Mapped[str] = mapped_column(
        String(20),
        default="Medium",
    )

    repeat: Mapped[str] = mapped_column(
        String(20),
        default="none",
    )

    done: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
    )

    completed_dates: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )


# PUSH SUBSCRIPTIONS TABLE
class PushSubscription(Base):

    __tablename__ = "push_subscriptions"

    endpoint: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
    )

    user_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    p256dh: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    auth: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )


# SENT NOTIFICATIONS TABLE
class SentOccurrence(Base):

    __tablename__ = "sent_occurrences"

    occurrence_key: Mapped[str] = mapped_column(
        String(150),
        primary_key=True,
    )

    task_id: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )

    occurrence_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )