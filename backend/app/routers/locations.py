from typing import Optional
from fastapi import APIRouter, Query, HTTPException, status

from app.schemas.location import LocationSearchResponse, ReverseGeocodeResponse, LocationCandidate
from app.services.location_service import location_service

router = APIRouter(prefix="/locations", tags=["Locations"])


@router.get("/search", response_model=LocationSearchResponse)
async def search_locations(
    q: str = Query(..., min_length=1, description="City, district or alias name to search"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of candidates"),
):
    """
    Autocomplete and ranked location search with Indian alias and fuzzy resolution.
    Handles spellings like Vizag (Visakhapatnam), Bangalore (Bengaluru), Kurnool, Chennai, etc.
    """
    candidates = await location_service.search_places(query=q, limit=limit)
    return LocationSearchResponse(
        query=q,
        count=len(candidates),
        results=candidates,
    )


@router.get("/resolve", response_model=LocationCandidate)
async def resolve_single_place(
    name: str = Query(..., description="Place name to resolve to single best match"),
):
    """Resolves a single location string to its top ranked geographic match."""
    match = await location_service.resolve_place(name)
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Could not resolve place name '{name}'."
        )
    return match


@router.get("/reverse", response_model=ReverseGeocodeResponse)
async def reverse_geocode(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Latitude"),
    lon: float = Query(..., ge=-180.0, le=180.0, description="Longitude"),
):
    """
    Reverse geocodes latitude and longitude to the nearest district and state.
    """
    return await location_service.reverse_geocode(lat=lat, lon=lon)
