"""
security.py
-----------
Protects the AI service so that ONLY our Node.js server can use it.

The server sends a secret header `X-Service-Key`. We compare it in
constant time (hmac.compare_digest) so attackers can't guess it
character-by-character from response timings.
"""

import hmac

from fastapi import Header, HTTPException, status

from config import AI_SERVICE_KEY


def require_service_key(x_service_key: str = Header(default="")) -> None:
    """FastAPI dependency: reject any request without the correct key."""
    if not AI_SERVICE_KEY:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            "AI_SERVICE_KEY is not configured on the AI service")
    if not hmac.compare_digest(x_service_key.encode(), AI_SERVICE_KEY.encode()):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid service key")
