import logging
from typing import Optional
from fastapi import APIRouter, Query, HTTPException, Request
from app.services.advisory_service import advisory_service, SUPPORTED_CROPS
from app.core.limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Location-Based Multi-Sector Advisories"])


@router.get("/advisory")
@limiter.limit("30/minute")
async def get_location_advisory(
    request: Request,
    lat: float = Query(..., description="Representative latitude"),
    lon: float = Query(..., description="Representative longitude"),
    type: Optional[str] = Query(None, description="Sector: agriculture, aviation, marine, health, urban"),
    crop: Optional[str] = Query(None, description="Target crop: cotton, rice, groundnut, chilli, maize, wheat, sugarcane, tomato"),
    role: Optional[str] = Query(None, description="User role: farmer, pilot, fisherman, general_public, urban_planner"),
    lang: str = Query("en", description="Language code: en, te, hi, ta, kn, etc."),
    place: Optional[str] = Query(None, description="Optional city or place name"),
):
    """
    Generates tailored, dated, and data-backed sector advisory using forecast data + LLM.
    Supports Agriculture (crop-specific), Aviation (METAR), Marine (Go/No-Go), Health, and Urban sectors.
    Applies role-based defaults (e.g. role=farmer defaults to agriculture).
    """
    try:
        advisory = await advisory_service.generate_advisory(
            lat=lat,
            lon=lon,
            sector=type or "agriculture",
            crop=crop,
            role=role,
            lang=lang,
            place_name=place,
        )
        return {
            "status": "success",
            "advisory": advisory,
        }
    except Exception as e:
        logger.error(f"Error generating advisory for ({lat}, {lon}): {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate sector advisory: {str(e)}",
        )


@router.get("/advisory/crops")
async def get_supported_crops():
    """Returns list of supported agricultural crops for advisory generation."""
    return {
        "supported_crops": SUPPORTED_CROPS,
    }
