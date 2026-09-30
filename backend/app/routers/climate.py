import logging
from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from app.services.climate_service import climate_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Climate Trends & Historical Analysis"])


@router.get("/climate/trends")
async def get_climate_trends_endpoint(
    lat: float = Query(..., description="Latitude for climate series"),
    lon: float = Query(..., description="Longitude for climate series"),
    from_year: int = Query(1994, alias="from", description="Start year (e.g. 1994 for 30-year or 2004 for 20-year)"),
    to_year: int = Query(2023, alias="to", description="End year (e.g. 2023)"),
    metric: str = Query("all", description="Metric filter: rainfall, temperature, extremes, or all"),
    place: Optional[str] = Query(None, description="City / district place name"),
    compare_lat: Optional[float] = Query(None, description="Optional comparison location latitude"),
    compare_lon: Optional[float] = Query(None, description="Optional comparison location longitude"),
    compare_name: Optional[str] = Query(None, description="Optional comparison location name"),
):
    """
    Retrieves 10-30 year historical climate trends, linear regression decadal slopes,
    monthly anomaly heatmaps, and extreme weather frequencies using Open-Meteo Archive & NASA POWER.
    Supports location and period comparisons.
    """
    try:
        data = await climate_service.get_climate_trends(
            lat=lat,
            lon=lon,
            from_year=from_year,
            to_year=to_year,
            place_name=place,
            compare_lat=compare_lat,
            compare_lon=compare_lon,
            compare_name=compare_name,
        )
        return data
    except Exception as e:
        logger.error(f"Error computing climate trends for ({lat}, {lon}): {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to compute climate trends: {str(e)}")
