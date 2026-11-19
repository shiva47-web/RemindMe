from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    func,
)

from database import Base


class ReminderAttachment(Base):
    __tablename__ = "reminder_attachments"

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

    user_id = Column(
        Integer,
        nullable=False,
        index=True,
    )

    original_filename = Column(
        String(255),
        nullable=False,
    )

    stored_filename = Column(
        String(255),
        nullable=False,
        unique=True,
    )

    content_type = Column(
        String(150),
        nullable=True,
    )

    file_size = Column(
        Integer,
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )