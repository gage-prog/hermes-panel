"""Simple PIN-based authentication for Hermes Panel."""
import hashlib
import secrets
import time
from backend.config import PIN_CODE, SESSION_SECRET, SESSION_EXPIRY_HOURS

# In-memory session store (simple, restarts clear sessions)
_sessions: dict[str, float] = {}


def verify_pin(pin: str) -> bool:
    """Check if the provided PIN matches."""
    return pin.strip() == PIN_CODE


def create_session() -> str:
    """Create a new session token."""
    token = secrets.token_hex(32)
    _sessions[token] = time.time()
    return token


def validate_session(token: str) -> bool:
    """Check if a session token is valid and not expired."""
    if not token or token not in _sessions:
        return False
    created = _sessions[token]
    if time.time() - created > SESSION_EXPIRY_HOURS * 3600:
        del _sessions[token]
        return False
    return True


def destroy_session(token: str):
    """Remove a session."""
    _sessions.pop(token, None)
