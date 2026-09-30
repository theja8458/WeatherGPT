from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.weather import (
    CurrentWeatherResponse,
    HourlyForecastResponse,
    DailyForecastResponse,
    AirQualityResponse,
)
from app.services.weather_service import weather_service
from app.services.repository import LocationRepository

router = APIRouter(prefix="/weather", tags=["Weather"])


async def _resolve_coordinates(
    lat: Optional[float], lon: Optional[float], place: Optional[str]
) -> tuple[float, float, Optional[str], Optional[str]]:
    """Resolves latitude, longitude, and place name from query parameters."""
    if lat is not None and lon is not None:
        # If place name is also passed, preserve it, else reverse geocode
        if not place:
            from app.services.location_service import location_service
            rev = await location_service.reverse_geocode(float(lat), float(lon))
            if rev:
                return float(lat), float(lon), f"{rev.name}, {rev.state}", rev.state
        return float(lat), float(lon), place, None

    if place:
        clean_place = place.strip()
        loc = await LocationRepository.get_by_name(clean_place)
        if not loc:
            candidates = await LocationRepository.search_locations(clean_place, limit=1)
            loc = candidates[0] if candidates else None

        if loc:
            return loc.lat, loc.lon, loc.name, loc.state

        # If not found in local curated database, default to Open-Meteo geocoding fallback
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Location '{place}' could not be resolved. Please provide lat and lon coordinates."
        )

    # Default fallback to Hyderabad if nothing provided
    return 17.3850, 78.4867, "Hyderabad", "Telangana"


@router.get("/current", response_model=CurrentWeatherResponse)
async def get_current_weather(
    lat: Optional[float] = Query(None, description="Latitude (-90 to 90)"),
    lon: Optional[float] = Query(None, description="Longitude (-180 to 180)"),
    place: Optional[str] = Query(None, description="City or district name (e.g. Hyderabad, Kurnool, Vizag)"),
):
    latitude, longitude, place_name, state = await _resolve_coordinates(lat, lon, place)
    data = await weather_service.get_current(latitude, longitude, place_name)
    if state and not data.get("state"):
        data["state"] = state
    return data


@router.get("/forecast/hourly", response_model=HourlyForecastResponse)
async def get_hourly_forecast(
    lat: Optional[float] = Query(None, description="Latitude"),
    lon: Optional[float] = Query(None, description="Longitude"),
    place: Optional[str] = Query(None, description="City or district name"),
    hours: int = Query(48, ge=1, le=72, description="Forecast hours (default 48)"),
):
    latitude, longitude, place_name, _ = await _resolve_coordinates(lat, lon, place)
    return await weather_service.get_hourly_forecast(latitude, longitude, hours, place_name)


@router.get("/forecast/daily", response_model=DailyForecastResponse)
async def get_daily_forecast(
    lat: Optional[float] = Query(None, description="Latitude"),
    lon: Optional[float] = Query(None, description="Longitude"),
    place: Optional[str] = Query(None, description="City or district name"),
    days: int = Query(7, ge=1, le=16, description="Forecast days (default 7)"),
):
    latitude, longitude, place_name, _ = await _resolve_coordinates(lat, lon, place)
    return await weather_service.get_daily_forecast(latitude, longitude, days, place_name)


@router.get("/air-quality", response_model=AirQualityResponse)
async def get_air_quality(
    lat: Optional[float] = Query(None, description="Latitude"),
    lon: Optional[float] = Query(None, description="Longitude"),
    place: Optional[str] = Query(None, description="City or district name"),
):
    latitude, longitude, place_name, _ = await _resolve_coordinates(lat, lon, place)
    return await weather_service.get_air_quality(latitude, longitude, place_name)


@router.get("/grid")
async def get_weather_grid():
    """
    Returns live weather observations across an India-wide 34-station geographic grid
    for GIS weather map layers (temperature, precipitation, wind, clouds).
    """
    return await weather_service.get_india_grid_weather()
