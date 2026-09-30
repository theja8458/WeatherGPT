from fastapi import APIRouter
from app.services.metrics_service import metrics_service

router = APIRouter(tags=["Performance & Metrics"])


@router.get("/metrics")
async def get_metrics_endpoint():
    """
    Returns application performance, latency, uptime, and cache hit metrics
    as required by Prompt 17.
    """
    return metrics_service.get_metrics()
