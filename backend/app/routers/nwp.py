import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Query, HTTPException, status
from pydantic import BaseModel

from app.services.nwp_service import nwp_service
from app.services.mqtt_service import mqtt_service
from app.services.grib_reader import grib_reader

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/nwp", tags=["NWP Models & AWS Real-Time Ingestion"])


class MockAWSPublishRequest(BaseModel):
    station_id: Optional[str] = None
    station_name: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    temperature_c: Optional[float] = None
    humidity_percent: Optional[int] = None
    pressure_hpa: Optional[float] = None
    wind_speed_kmh: Optional[float] = None
    rain_rate_mmh: Optional[float] = None


async def _resolve_nwp_coordinates(
    lat: Optional[float], lon: Optional[float], place: Optional[str]
) -> tuple[float, float, str]:
    """Resolves latitude, longitude, and place name using existing repository and geocoding conventions."""
    if lat is not None and lon is not None:
        if place:
            return float(lat), float(lon), place
        try:
            from app.services.location_service import location_service
            rev = await location_service.reverse_geocode(float(lat), float(lon))
            if rev:
                return float(lat), float(lon), f"{rev.name}, {rev.state}"
        except Exception:
            pass
        return float(lat), float(lon), f"Coordinates ({float(lat):.2f}, {float(lon):.2f})"

    if place:
        clean_place = place.strip()
        try:
            from app.services.location_service import location_service
            loc = await location_service.resolve_place(clean_place)
            if loc:
                return float(loc.lat), float(loc.lon), f"{loc.name}, {loc.state}"
        except Exception:
            pass
        from app.services.repository import LocationRepository
        loc_model = await LocationRepository.get_by_name(clean_place)
        if loc_model:
            return float(loc_model.lat), float(loc_model.lon), f"{loc_model.name}, {loc_model.state}"
        candidates = await LocationRepository.search_locations(clean_place, limit=1)
        if candidates:
            return float(candidates[0].lat), float(candidates[0].lon), f"{candidates[0].name}, {candidates[0].state}"

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Location '{place}' could not be resolved. Please provide lat and lon coordinates.",
        )

    # Default fallback to Hyderabad
    return 17.3850, 78.4867, "Hyderabad, Telangana"


@router.get("/compare")
async def compare_nwp_models(
    lat: Optional[float] = Query(None, description="Latitude for model query (-90 to 90)"),
    lon: Optional[float] = Query(None, description="Longitude for model query (-180 to 180)"),
    place: Optional[str] = Query(None, description="City or district name (e.g. Hyderabad, Kurnool, Delhi)"),
    days: int = Query(7, ge=3, le=14, description="Forecast days for comparison (default: 7)"),
):
    """
    Compares NOAA GFS (gfs_seamless) and ECMWF IFS (ecmwf_ifs) numerical weather prediction outputs for 7 days.
    Returns:
    - GFS and ECMWF daily forecasts for temperature, precipitation, wind, and pressure
    - Ensemble consensus and spread metrics
    - Daily agreement levels (High Agreement, Moderate Agreement, Model Divergence)
    - Uncertainty and confidence rating for chatbot synthesis
    """
    latitude, longitude, place_name = await _resolve_nwp_coordinates(lat, lon, place)
    try:
        return await nwp_service.get_model_comparison(
            lat=latitude,
            lon=longitude,
            place_name=place_name,
            days=days,
        )
    except Exception as e:
        logger.error(f"Error comparing NWP models for ({latitude}, {longitude}): {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compare NWP models: {str(e)}",
        )


@router.get("/aws/latest")
async def get_latest_aws_readings():
    """
    Returns latest telemetry readings from IMD Automatic Weather Stations (AWS)
    ingested via WIS 2.0 / MQTT.
    """
    stations = mqtt_service.get_latest_stations()
    return {
        "status": "success",
        "count": len(stations),
        "protocol": "WIS 2.0 / MQTT Real-Time Feed",
        "stations": stations,
    }


@router.post("/aws/publish-mock")
async def publish_mock_aws_telemetry(req: Optional[MockAWSPublishRequest] = None):
    """
    Simulates / triggers an AWS station telemetry transmission.
    Ingests into MongoDB and broadcasts to connected browsers via WebSocket.
    Mirrors WIS 2.0 publish/subscribe architecture.
    """
    import random
    from datetime import datetime, timezone

    # Pick or generate station
    station_id = req.station_id if req and req.station_id else "IMD_AWS_43295_BEGUMPET"
    station_name = req.station_name if req and req.station_name else "IMD AWS Hyderabad Begumpet"
    district = req.district if req and req.district else "Hyderabad"
    state = req.state if req and req.state else "Telangana"
    lat = req.lat if req and req.lat is not None else 17.4531
    lon = req.lon if req and req.lon is not None else 78.4676

    base_temp = req.temperature_c if req and req.temperature_c is not None else 31.0 + random.uniform(-1.0, 1.5)
    base_hum = req.humidity_percent if req and req.humidity_percent is not None else int(60 + random.uniform(-5, 8))
    base_wind = req.wind_speed_kmh if req and req.wind_speed_kmh is not None else round(12.0 + random.uniform(-3, 4), 1)
    base_rain = req.rain_rate_mmh if req and req.rain_rate_mmh is not None else (round(random.uniform(0.0, 3.5), 1) if random.random() < 0.3 else 0.0)

    reading = {
        "station_id": station_id,
        "station_name": station_name,
        "district": district,
        "state": state,
        "lat": lat,
        "lon": lon,
        "temperature_c": round(base_temp, 1),
        "humidity_percent": base_hum,
        "pressure_hpa": round(1011.5 + random.uniform(-0.5, 0.5), 1),
        "wind_speed_kmh": base_wind,
        "wind_direction_deg": int(random.choice([180, 190, 200, 210, 225])),
        "rain_rate_mmh": base_rain,
        "accumulated_rain_mm": round(base_rain * 1.5, 1),
        "battery_v": round(12.6 + random.uniform(0.0, 0.4), 2),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "protocol": "WIS2.0 / MQTT",
    }

    # Process and broadcast
    processed = await mqtt_service.process_aws_reading(reading)
    mqtt_service.publish_reading(reading)

    return {
        "status": "published",
        "message": "AWS observation ingested and broadcasted over WebSocket",
        "reading": processed,
    }


@router.get("/grib/status")
async def get_grib_status():
    """Returns GFS GRIB2 NOMADS ingestion status and feature flag."""
    return await grib_reader.ingest_gfs_grib2_subset()
