"""
Admin authentication — PIN login issuing short-lived HMAC-signed bearer tokens.
"""

import hmac
import time
import base64
import hashlib
import secrets
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings

_SECRET = (settings.SECRET_KEY or secrets.token_hex(32)).encode()
_bearer = HTTPBearer(auto_error=False)


def _sign(payload: str) -> str:
    return hmac.new(_SECRET, payload.encode(), hashlib.sha256).hexdigest()


def create_token() -> tuple[str, int]:
    """Return (token, expires_at_ms)."""
    expires_at = int(time.time()) + settings.SESSION_MINUTES * 60
    payload = f"admin:{expires_at}"
    raw = f"{payload}:{_sign(payload)}"
    return base64.urlsafe_b64encode(raw.encode()).decode(), expires_at * 1000


def verify_token(token: str) -> bool:
    try:
        role, expires_at, signature = base64.urlsafe_b64decode(token.encode()).decode().split(":")
    except Exception:
        return False
    payload = f"{role}:{expires_at}"
    return hmac.compare_digest(signature, _sign(payload)) and int(expires_at) > time.time()


def check_pin(pin: str) -> bool:
    return hmac.compare_digest(pin.encode(), settings.ADMIN_PIN.encode())


async def require_admin(credentials: HTTPAuthorizationCredentials = Depends(_bearer)):
    """FastAPI dependency guarding admin-only routes."""
    if not credentials or not verify_token(credentials.credentials):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin session expired or missing",
            headers={"WWW-Authenticate": "Bearer"},
        )
