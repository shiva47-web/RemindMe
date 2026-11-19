import json
import logging
import urllib.request
import urllib.error

from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from database import SessionLocal
from models import Reminder
from auth_routes import get_current_user


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

logger = logging.getLogger("remindme.ai")

router = APIRouter(tags=["Remy AI Assistant"])

OLLAMA_URL = "http://127.0.0.1:11434/api/chat"

AI_MODEL = "llama3.2:3b"

MAX_HISTORY_MESSAGES = 8


# --------------------------------------------------
# REQUEST MODELS
# --------------------------------------------------

class ChatHistoryMessage(BaseModel):
    role: str
    content: str = Field(min_length=1, max_length=2000)


class AIChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)

    history: list[ChatHistoryMessage] = Field(
        default_factory=list
    )


# --------------------------------------------------
# REMY AI CHAT ENDPOINT
# --------------------------------------------------

@router.post("/api/ai/chat")
def ai_chat(
    request: AIChatRequest,
    current_user: dict = Depends(get_current_user),
):

    user_id = int(current_user["id"])

    user_message = request.message.strip()

    if not user_message:
        raise HTTPException(
            status_code=400,
            detail="Please enter a message."
        )

    # ----------------------------------------------
    # GET CURRENT USER'S REMINDERS
    # ----------------------------------------------

    with SessionLocal() as session:

        reminders = session.scalars(
            select(Reminder)
            .where(Reminder.user_id == user_id)
            .order_by(
                Reminder.date.asc(),
                Reminder.time.asc()
            )
            .limit(50)
        ).all()

        reminder_data = []

        for task in reminders:

            reminder_data.append({
                "id": str(task.id),
                "title": task.title,
                "description": task.description or "",
                "date": task.date.isoformat(),

                "time": (
                    task.time.strftime("%H:%M")
                    if task.time
                    else "Not specified"
                ),

                "category": task.category or "Personal",
                "priority": task.priority or "Medium",
                "repeat": task.repeat or "none",
                "completed": bool(task.done),

                "completed_dates": (
                    task.completed_dates or []
                ),
            })

    # ----------------------------------------------
    # CURRENT DATE AND USER
    # ----------------------------------------------

    today = datetime.now(
        ZoneInfo("Asia/Kolkata")
    ).strftime("%Y-%m-%d")

    user_name = current_user.get(
        "full_name",
        "there"
    )

    # ----------------------------------------------
    # REMY PERSONALITY AND INSTRUCTIONS
    # ----------------------------------------------

    system_prompt = f"""
You are Remy, the personal AI assistant of RemindMe.

RemindMe is a reminder and productivity application.

YOUR IDENTITY:
Your name is Remy.
You are not ChatGPT.
You are RemindMe's personal AI assistant.

YOUR PERSONALITY:
- Friendly and helpful.
- Warm and encouraging.
- Intelligent and practical.
- Explain things in simple language.
- Use emojis occasionally.
- Keep answers clear and easy to understand.

CURRENT USER:
Name: {user_name}
User ID: {user_id}

CURRENT DATE:
{today}

USER'S REMINDERS:
{json.dumps(reminder_data, ensure_ascii=False)}

YOUR RESPONSIBILITIES:

1. Answer questions about the user's reminders.
2. Help organize daily activities.
3. Suggest study timetables.
4. Help users manage their time.
5. Suggest ways to improve productivity.
6. Explain how to prioritize tasks.
7. Help users plan their week.
8. Answer general questions.
9. Give motivational advice when appropriate.

IMPORTANT RULES:

- Use the provided reminder information when answering
  questions about the user's tasks.
- Never invent reminders.
- Never claim a task exists unless it is in the data.
- If there are no reminders, say so honestly.
- Do not reveal another user's information.
- Do not claim you created, edited or deleted a reminder.
- You currently provide suggestions only.
- Be honest about your capabilities.

You are Remy. Welcome the user warmly and help them
make their day more productive.
"""

    # ----------------------------------------------
    # BUILD CONVERSATION HISTORY
    # ----------------------------------------------

    messages = [
        {
            "role": "system",
            "content": system_prompt
        }
    ]

    for item in request.history[-MAX_HISTORY_MESSAGES:]:

        if item.role not in ("user", "assistant"):
            continue

        content = item.content.strip()

        if not content:
            continue

        messages.append({
            "role": item.role,
            "content": content[:2000]
        })

    messages.append({
        "role": "user",
        "content": user_message
    })

    # ----------------------------------------------
    # OLLAMA REQUEST
    # ----------------------------------------------

    payload = {
        "model": AI_MODEL,

        "messages": messages,

        "stream": False,

        "options": {
            "temperature": 0.5,
            "num_predict": 350
        }
    }

    body = json.dumps(payload).encode("utf-8")

    ollama_request = urllib.request.Request(
        OLLAMA_URL,
        data=body,
        headers={
            "Content-Type": "application/json"
        },
        method="POST"
    )

    # ----------------------------------------------
    # GET AI RESPONSE
    # ----------------------------------------------

    try:

        with urllib.request.urlopen(
            ollama_request,
            timeout=120
        ) as response:

            result = json.loads(
                response.read().decode("utf-8")
            )

        answer = (
            result.get("message", {})
            .get("content", "")
            .strip()
        )

        if not answer:

            raise HTTPException(
                status_code=502,
                detail="Remy returned an empty response."
            )

        return {
            "success": True,
            "assistant": "Remy",
            "reply": answer,
            "model": AI_MODEL
        }

    except urllib.error.HTTPError as error:

        logger.error(
            "Ollama returned HTTP error: %s",
            error.code
        )

        raise HTTPException(
            status_code=502,
            detail="The local AI service returned an error."
        )

    except (urllib.error.URLError, TimeoutError):

        logger.exception(
            "Could not connect to Ollama."
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "Remy is currently unavailable. "
                "Please check whether Ollama is running."
            )
        )

    except HTTPException:
        raise

    except Exception:

        logger.exception(
            "Unexpected Remy AI error."
        )

        raise HTTPException(
            status_code=500,
            detail="Something went wrong while generating the response."
        )