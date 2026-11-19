import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, sessionmaker


# LOAD ENVIRONMENT VARIABLES
BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / ".env")


# DATABASE SETTINGS
DB_USER = os.getenv("DATABASE_USER", "postgres")
DB_PASSWORD = os.getenv("DATABASE_PASSWORD", "")
DB_HOST = os.getenv("DATABASE_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DATABASE_PORT", "5432"))
DB_NAME = os.getenv("DATABASE_NAME", "remindme_db")


# CREATE DATABASE URL SAFELY
DATABASE_URL = URL.create(
    drivername="postgresql+psycopg",
    username=DB_USER,
    password=DB_PASSWORD,
    host=DB_HOST,
    port=DB_PORT,
    database=DB_NAME,
)


# DATABASE ENGINE
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    echo=False,
)


# DATABASE SESSION
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


# BASE MODEL
class Base(DeclarativeBase):
    pass