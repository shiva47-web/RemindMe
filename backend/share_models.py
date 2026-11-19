from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    UniqueConstraint,
    func,
)

from database import Base


class ReminderShare(Base):
    __tablename__ = "reminder_shares"

    __table_args__ = (
        UniqueConstraint(
            "reminder_id",
            "shared_with_email",
            name="uq_reminder_shared_email",
        ),
    )

    id = Column(
        String(36),
        primary_key=True,
        index=True,
    )

    reminder_id = Column(
        String(100),
        nullable=False,
        index=True,
    )

    owner_user_id = Column(
        Integer,
        nullable=False,
        index=True,
    )

    shared_with_email = Column(
        String(255),
        nullable=False,
        index=True,
    )

    permission = Column(
        String(20),
        nullable=False,
        default="viewer",
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )