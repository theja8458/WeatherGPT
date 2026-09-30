from fastapi import APIRouter
from app.routers import health, weather, locations, chat, feedback, glossary, voice, alerts, advisory, climate, nwp, users, metrics

api_v1_router = APIRouter()

# Include version 1 endpoints
api_v1_router.include_router(health.router)
api_v1_router.include_router(weather.router)
api_v1_router.include_router(locations.router)
api_v1_router.include_router(chat.router)
api_v1_router.include_router(feedback.router)
api_v1_router.include_router(glossary.router)
api_v1_router.include_router(voice.router)
api_v1_router.include_router(alerts.router)
api_v1_router.include_router(advisory.router)
api_v1_router.include_router(climate.router)
api_v1_router.include_router(nwp.router)
api_v1_router.include_router(users.router)
api_v1_router.include_router(metrics.router)
