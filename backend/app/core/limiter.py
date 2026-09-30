import logging
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


def rate_limit_key_func(request: Request) -> str:
    """
    Identifies client IP or session for rate limiting.
    Falls back gracefully to 127.0.0.1 if client is not set.
    """
    client_ip = get_remote_address(request)
    return client_ip or "127.0.0.1"


# Global limiter with reasonable default limit
limiter = Limiter(
    key_func=rate_limit_key_func,
    default_limits=["120/minute"],
    headers_enabled=False,
)


def custom_rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """
    Standardized, safe JSON response when a client exceeds the endpoint rate limit.
    """
    logger.warning(
        f"Rate limit exceeded on {request.method} {request.url.path} from {request.client.host if request.client else 'unknown'}"
    )
    return JSONResponse(
        status_code=429,
        content={
            "error": "Too Many Requests",
            "message": "Rate limit exceeded. Please wait a moment before sending more requests.",
            "detail": str(exc.detail),
            "path": request.url.path,
        },
        headers={"Retry-After": "60"},
    )
