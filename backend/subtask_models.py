from sqlalchemy import Column, String, Integer, Boolean, DateTime, func
from database import Base


class ReminderSubtask(Base):
    __tablename__ = "reminder_subtasks"

    id = Column(String(36), primary_key=True, index=True)

    reminder_id = Column(String(100), nullable=False, index=True)

    user_id = Column(Integer, nullable=False, index=True)

    title = Column(String(200), nullable=False)

    completed = Column(Boolean, default=False, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )