import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import db_manager
from app.core.logging import setup_logging
from app.routers.api import api_v1_router
from app.routers.health import router as health_router
from app.routers.alerts import router as alerts_router
from app.routers.metrics import router as metrics_router
from app.services.alert_service import alert_service
from app.services.metrics_service import metrics_service
from app.core.limiter import limiter, custom_rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# Initialize structured logging
setup_logging()
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def scheduled_alerts_job():
    """APScheduler 15-minute background job: evaluates forecast thresholds and pushes live alerts for subscribed locations."""
    logger.info("Running scheduled 15-minute IMD alert threshold evaluation...")
    locations_to_check = [
        {"name": "Hyderabad", "lat": 17.3850, "lon": 78.4867},
        {"name": "Kurnool", "lat": 15.8281, "lon": 78.0373},
        {"name": "Visakhapatnam", "lat": 17.6868, "lon": 83.2185},
        {"name": "Chennai", "lat": 13.0827, "lon": 80.2707},
        {"name": "Delhi", "lat": 28.6139, "lon": 77.2090},
        {"name": "Mumbai", "lat": 19.0760, "lon": 72.8777},
    ]

    try:
        from app.services.repository import SubscriptionRepository
        active_subs = await SubscriptionRepository.get_active_subscriptions()
        for sub in active_subs:
            name = sub.location_name or (sub.location.name if sub.location else None)
            lat = sub.lat if sub.lat is not None else (sub.location.lat if sub.location else None)
            lon = sub.lon if sub.lon is not None else (sub.location.lon if sub.location else None)
            if name and lat is not None and lon is not None:
                if not any(loc["name"].lower() == name.lower() for loc in locations_to_check):
                    locations_to_check.append({"name": name, "lat": lat, "lon": lon})
    except Exception as sub_err:
        logger.warning(f"Could not load active subscriptions for alert evaluation: {sub_err}")

    for city in locations_to_check:
        try:
            await alert_service.evaluate_location_forecast(city["lat"], city["lon"], city["name"])
        except Exception as e:
            logger.debug(f"Error evaluating alerts for {city['name']}: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize DB and services
    logger.info(f"Starting {settings.PROJECT_NAME} in [{settings.ENVIRONMENT}] mode...")
    await db_manager.connect_to_database()

    # Start 15-minute APScheduler job
    try:
        scheduler.add_job(scheduled_alerts_job, "interval", minutes=15, id="imd_alerts_job")
        scheduler.start()
        logger.info("APScheduler alerts monitoring job started (15-min interval).")
    except Exception as e:
        logger.warning(f"Could not start APScheduler: {e}")

    # Start MQTT / WIS 2.0 subscriber
    try:
        from app.services.mqtt_service import mqtt_service
        mqtt_service.start_subscriber()
    except Exception as e:
        logger.warning(f"Could not initialize MQTT subscriber: {e}")

    yield

    # Shutdown: Clean up resources
    logger.info(f"Shutting down {settings.PROJECT_NAME}...")
    try:
        scheduler.shutdown(wait=False)
    except Exception:
        pass
    await db_manager.close_database_connection()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Conversational AI for weather forecasts, alerts, and climate info (MoES / IMD, Disaster Management)",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Rate Limiter setup (Prompt 17)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, custom_rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Performance & Response-Time Logging Middleware (Prompt 17)
@app.middleware("http")
async def performance_metrics_middleware(request: Request, call_next):
    start_time = time.perf_counter()
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

    # Record in internal metrics service
    metrics_service.record_request(
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        latency_ms=duration_ms,
    )

    # Log structured response-time record
    logger.info(
        f"{request.method} {request.url.path} - {response.status_code} ({duration_ms}ms)"
    )

    # Inject latency header into response
    response.headers["X-Response-Time-Ms"] = str(duration_ms)
    return response


# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred while processing your request.",
            "detail": str(exc) if settings.DEBUG else None,
            "path": request.url.path,
        },
    )


# Root health check endpoint as required by Prompt 1
app.include_router(health_router)

# Versioned API routes (/api/v1)
app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)

# Direct root WebSocket and alerts routes
app.include_router(alerts_router)

# Direct root metrics route (/metrics)
app.include_router(metrics_router)


@app.get("/")
async def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": "1.0.0",
        "health": "/health",
        "api_v1": settings.API_V1_PREFIX,
        "docs": "/docs",
    }
