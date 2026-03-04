"""
Settings routes — Shift time configuration.
"""

from fastapi import APIRouter
from app.core.database import get_db
from app.core.config import settings
from app.models.schemas import ShiftConfig

router = APIRouter(tags=["Settings"])


@router.get("/shift-config", response_model=ShiftConfig)
async def get_shift_config():
    """Get the current dynamic shift login/logout boundaries."""
    db = get_db()
    config = await db.settings.find_one({"_id": "global_config"})
    if config:
        return ShiftConfig(
            login_time=config.get("login_time", "09:30:00"),
            logout_time=config.get("logout_time", "16:30:00")
        )
    return ShiftConfig(
        login_time=getattr(settings, "LOGIN_TIME", "09:30:00"),
        logout_time=getattr(settings, "LOGOUT_TIME", "16:30:00")
    )


@router.post("/shift-config")
async def update_shift_config(config: ShiftConfig):
    """Update global shift settings instantly without rebooting server."""
    db = get_db()
    await db.settings.update_one(
        {"_id": "global_config"},
        {"$set": {"login_time": config.login_time, "logout_time": config.logout_time}},
        upsert=True
    )
    return {"message": "Shift configuration updated successfully!"}
