from fastapi import APIRouter
from app.core.config import settings
from app.core.database import db_manager
from app.schemas.health import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def check_health():
    return HealthResponse(
        status="ok" if db_manager.is_connected or settings.ENVIRONMENT == "development" else "degraded",
        app_name=settings.PROJECT_NAME,
        environment=settings.ENVIRONMENT,
        database_connected=db_manager.is_connected,
        version="1.0.0",
    )
