
import os
import re
import time
import hashlib
import hmac

from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

import jwt

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from pwdlib import PasswordHash
from sqlalchemy import select, func, update
from sqlalchemy.exc import IntegrityError

from database import SessionLocal
from auth_models import User
from models import Reminder, PushSubscription


# ======================================================
# ENVIRONMENT SETTINGS
# ======================================================

BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / ".env")

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "").strip()

if not JWT_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY is missing from .env")

JWT_ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
)

CLOUDINARY_CLOUD_NAME = os.getenv(
    "CLOUDINARY_CLOUD_NAME", ""
).strip()

CLOUDINARY_API_KEY = os.getenv(
    "CLOUDINARY_API_KEY", ""
).strip()

CLOUDINARY_API_SECRET = os.getenv(
    "CLOUDINARY_API_SECRET", ""
).strip()

CLOUDINARY_PROFILE_FOLDER = "remindme/profiles"


# ======================================================
# PASSWORD HASHING
# ======================================================

password_hash = PasswordHash.recommended()


# ======================================================
# ROUTER
# ======================================================

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)

security = HTTPBearer(auto_error=False)


# ======================================================
# REQUEST MODELS
# ======================================================

class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str
    password: str


class ProfileUpdateRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=255)
    avatar_url: str | None = Field(
        default=None,
        max_length=500
    )


# ======================================================
# EMAIL VALIDATION
# ======================================================

def validate_email(email: str) -> bool:
    return bool(
        re.fullmatch(
            r"[^@\s]+@[^@\s]+\.[^@\s]+",
            email
        )
    )


# ======================================================
# JWT TOKEN
# ======================================================

def create_access_token(user_id: int):

    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "exp": expires_at,
        "type": "access",
    }

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )


# ======================================================
# PUBLIC USER RESPONSE
# ======================================================

def user_response(user):

    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "avatar_url": user.avatar_url,
        "is_active": user.is_active,
    }


# ======================================================
# REGISTER
# ======================================================

@router.post("/register")
def register(request: RegisterRequest):

    full_name = request.full_name.strip()
    email = request.email.strip().lower()

    if not full_name:
        raise HTTPException(
            status_code=400,
            detail="Full name cannot be empty."
        )

    if not validate_email(email):
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid email address."
        )

    hashed_password = password_hash.hash(request.password)

    try:

        with SessionLocal() as session:

            existing_user_count = session.scalar(
                select(func.count()).select_from(User)
            ) or 0

            existing_user = session.scalar(
                select(User).where(User.email == email)
            )

            if existing_user:
                raise HTTPException(
                    status_code=409,
                    detail="An account with this email already exists."
                )

            user = User(
                full_name=full_name,
                email=email,
                hashed_password=hashed_password,
                avatar_url=None,
                is_active=True,
            )

            session.add(user)
            session.flush()

            if existing_user_count == 0:

                session.execute(
                    update(Reminder)
                    .where(Reminder.user_id.is_(None))
                    .values(user_id=user.id)
                )

                session.execute(
                    update(PushSubscription)
                    .where(PushSubscription.user_id.is_(None))
                    .values(user_id=user.id)
                )

            session.commit()
            session.refresh(user)

            token = create_access_token(user.id)

            return {
                "message": "Account created successfully!",
                "access_token": token,
                "token_type": "bearer",
                "user": user_response(user),
            }

    except HTTPException:
        raise

    except IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists."
        )

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Unable to create account."
        )


# ======================================================
# LOGIN
# ======================================================

@router.post("/login")
def login(request: LoginRequest):

    email = request.email.strip().lower()

    with SessionLocal() as session:

        user = session.scalar(
            select(User).where(User.email == email)
        )

        if (
            not user
            or not password_hash.verify(
                request.password,
                user.hashed_password
            )
        ):
            raise HTTPException(
                status_code=401,
                detail="Incorrect email or password."
            )

        if not user.is_active:
            raise HTTPException(
                status_code=403,
                detail="This account is inactive."
            )

        token = create_access_token(user.id)

        return {
            "message": "Login successful!",
            "access_token": token,
            "token_type": "bearer",
            "user": user_response(user),
        }


# ======================================================
# AUTHENTICATE CURRENT USER
# ======================================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security)
):

    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:

        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )

        if payload.get("type") != "access":
            raise HTTPException(
                status_code=401,
                detail="Invalid access token."
            )

        user_id = int(payload["sub"])

    except (
        jwt.InvalidTokenError,
        ValueError,
        KeyError,
        TypeError
    ):

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    with SessionLocal() as session:

        user = session.get(User, user_id)

        if not user or not user.is_active:
            raise HTTPException(
                status_code=401,
                detail="User account not found or inactive."
            )

        return user_response(user)


# ======================================================
# GET CURRENT LOGGED-IN USER
# ======================================================

@router.get("/me")
def get_me(
    current_user: dict = Depends(get_current_user)
):

    return {
        "message": "Authenticated successfully!",
        "user": current_user,
    }


# ======================================================
# CLOUDINARY SIGNATURE
# ======================================================

@router.post("/cloudinary-signature")
def create_cloudinary_signature(
    current_user: dict = Depends(get_current_user)
):

    if not all([
        CLOUDINARY_CLOUD_NAME,
        CLOUDINARY_API_KEY,
        CLOUDINARY_API_SECRET
    ]):
        raise HTTPException(
            status_code=500,
            detail="Cloudinary is not configured on the server."
        )

    timestamp = int(time.time())

    parameters = (
        f"folder={CLOUDINARY_PROFILE_FOLDER}"
        f"&timestamp={timestamp}"
    )

    signature = hmac.new(
        CLOUDINARY_API_SECRET.encode("utf-8"),
        parameters.encode("utf-8"),
        hashlib.sha1
    ).hexdigest()

    return {
        "cloud_name": CLOUDINARY_CLOUD_NAME,
        "api_key": CLOUDINARY_API_KEY,
        "timestamp": timestamp,
        "folder": CLOUDINARY_PROFILE_FOLDER,
        "signature": signature,
    }


# ======================================================
# VALIDATE CLOUDINARY IMAGE URL
# ======================================================

def validate_avatar_url(avatar_url: str):

    parsed = urlparse(avatar_url)

    expected_prefix = (
        f"/{CLOUDINARY_CLOUD_NAME}/image/upload/"
    )

    if (
        not CLOUDINARY_CLOUD_NAME
        or parsed.scheme != "https"
        or parsed.hostname != "res.cloudinary.com"
        or not parsed.path.startswith(expected_prefix)
        or "/remindme/profiles/" not in parsed.path
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid Cloudinary profile image URL."
        )


# ======================================================
# UPDATE PROFILE
# ======================================================

@router.put("/profile")
def update_profile(
    request: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user)
):

    full_name = request.full_name.strip()
    email = request.email.strip().lower()
    avatar_url = request.avatar_url

    if not full_name:
        raise HTTPException(
            status_code=400,
            detail="Full name cannot be empty."
        )

    if not validate_email(email):
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid email address."
        )

    if avatar_url:
        validate_avatar_url(avatar_url)

    try:

        with SessionLocal() as session:

            user = session.get(User, current_user["id"])

            if not user or not user.is_active:
                raise HTTPException(
                    status_code=404,
                    detail="User account not found."
                )

            existing_user = session.scalar(
                select(User).where(
                    User.email == email,
                    User.id != user.id
                )
            )

            if existing_user:
                raise HTTPException(
                    status_code=409,
                    detail="This email address is already used by another account."
                )

            user.full_name = full_name
            user.email = email

            if avatar_url is not None:
                user.avatar_url = avatar_url

            session.commit()
            session.refresh(user)

            return {
                "message": "Profile updated successfully!",
                "user": user_response(user),
            }

    except HTTPException:
        raise

    except IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="This email address is already in use."
        )

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Unable to update profile."
        )
