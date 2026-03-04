"""
Pydantic schemas for request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional


# ─── Student ─────────────────────────────────────────────────────────────────

class StudentCreate(BaseModel):
    roll_no: str = Field(..., example="1RV22CSE001")
    name: str = Field(..., example="Rahul Kumar")
    branch: str = Field(..., example="CSE")


class StudentOut(BaseModel):
    roll_no: str
    name: str
    branch: str


# ─── Attendance ──────────────────────────────────────────────────────────────

class AttendanceRecord(BaseModel):
    roll_no: str
    name: str
    branch: str
    date: str
    login_time: Optional[str] = None
    login_status: Optional[str] = None
    logout_time: Optional[str] = None
    logout_status: Optional[str] = None


# ─── Recognition ─────────────────────────────────────────────────────────────

class RecognitionResult(BaseModel):
    success: bool
    roll_no: Optional[str] = None
    name: Optional[str] = None
    branch: Optional[str] = None
    similarity: Optional[float] = None
    status: str  # "Present", "Already Marked", "No Match", "No Face Detected"
    message: str


class MultiRecognitionResult(BaseModel):
    success: bool
    faces_detected: int = 0
    faces_recognized: int = 0
    results: list[RecognitionResult] = []
    message: str

# ─── Settings ────────────────────────────────────────────────────────────────

class ShiftConfig(BaseModel):
    login_time: str = Field(..., example="09:30:00")
    logout_time: str = Field(..., example="16:30:00")

