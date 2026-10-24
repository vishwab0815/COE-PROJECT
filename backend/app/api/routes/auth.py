"""
Auth routes — POST /auth/login exchanges the admin PIN for a bearer token.
"""

from fastapi import APIRouter, HTTPException
from app.core.security import check_pin, create_token
from app.models.schemas import LoginRequest, LoginResponse

router = APIRouter(tags=["Auth"])


@router.post("/auth/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    """Validate the admin PIN and issue a session token."""
    if not check_pin(body.pin):
        raise HTTPException(status_code=401, detail="Incorrect PIN")
    token, expires_at = create_token()
    return LoginResponse(token=token, expires_at=expires_at)
