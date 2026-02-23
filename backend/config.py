"""
Application configuration — loads settings from .env file.
"""

import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env from the attendance_ai root (one level up from backend/)
_env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
load_dotenv(_env_path)


class Settings(BaseSettings):
    MONGO_URI: str = "mongodb://localhost:27017"
    DB_NAME: str = "attendance_ai"
    SIMILARITY_THRESHOLD: float = 0.65

    class Config:
        env_file = _env_path
        extra = "ignore"


settings = Settings()
