"""
Application configuration — loads settings from .env file.
"""

import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Project root (COE-PROJECT/) — four levels up from backend/app/core/config.py
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
_env_path = os.path.join(ROOT_DIR, ".env")
load_dotenv(_env_path)


class Settings(BaseSettings):
    # ── Database ──
    MONGO_URI: str = "mongodb://localhost:27017"
    DB_NAME: str = "attendance_ai"

    # ── Recognition ──
    SIMILARITY_THRESHOLD: float = 0.55
    LOGIN_TIME: str = "09:30:00"
    LOGOUT_TIME: str = "16:30:00"

    # ── Camera: webcam index ("0") or an RTSP/HTTP URL ──
    CAMERA_SOURCE: str = "0"

    # ── Model / data files (relative paths resolve against the project root) ──
    YOLO_MODEL_PATH: str = "yolov8n-face.pt"
    YOLO_MODEL_URL: str = "https://github.com/akanametov/yolo-face/releases/download/1.0.0/yolov8n-face.pt"
    FAISS_INDEX_PATH: str = "student_index.faiss"
    LABELS_PATH: str = "labels.pkl"
    DATASET_DIR: str = "processed_dataset"

    # ── Admin auth ──
    ADMIN_PIN: str = "1234"
    SECRET_KEY: str = ""  # Generated per-process if empty (sessions reset on restart)
    SESSION_MINUTES: int = 5

    # ── HTTP ──
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    FRONTEND_DIST: str = "frontend/dist"

    class Config:
        env_file = _env_path
        extra = "ignore"

    def path(self, value: str) -> str:
        """Resolve a configured path against the project root."""
        return value if os.path.isabs(value) else os.path.join(ROOT_DIR, value)

    @property
    def camera_source(self):
        return int(self.CAMERA_SOURCE) if self.CAMERA_SOURCE.isdigit() else self.CAMERA_SOURCE

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
