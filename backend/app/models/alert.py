from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class AlertSeverity(str, Enum):
    GREEN = "green"      # No warning / Normal
    YELLOW = "yellow"    # Watch / Be updated
    ORANGE = "orange"    # Alert / Be prepared
    RED = "red"          # Warning / Take action


class AlertType(str, Enum):
    HEATWAVE = "heatwave"
    HEAVY_RAIN = "heavy_rain"
    THUNDERSTORM = "thunderstorm"
    CYCLONE = "cyclone"
    FLOOD = "flood"
    STRONG_WIND = "strong_wind"
    COLD_WAVE = "cold_wave"
    FOG = "fog"
    AIR_QUALITY = "air_quality"
    GENERAL = "general"


class GeoGeometry(BaseModel):
    type: str = Field(default="Point", description="GeoJSON type: Point or Polygon")
    coordinates: List[Any] = Field(..., description="[lon, lat] for Point or [[lon, lat], ...] for Polygon")


class AlertModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    type: AlertType = Field(default=AlertType.GENERAL)
    severity: AlertSeverity = Field(default=AlertSeverity.YELLOW)
    region: str = Field(..., description="District, state, or zone name")
    geometry: GeoGeometry = Field(..., description="GeoJSON geometry for 2dsphere indexing")
    lat: float = Field(..., description="Representative latitude")
    lon: float = Field(..., description="Representative longitude")
    title: str = Field(..., description="Alert headline / title")
    description: str = Field(..., description="Detailed alert and safety instructions")
    source: str = Field(default="IMD", description="Source provider (IMD, MoES, Open-Meteo)")
    valid_from: datetime = Field(default_factory=datetime.utcnow)
    valid_to: datetime = Field(..., description="Expiry of the warning")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "type": "heavy_rain",
                "severity": "orange",
                "region": "Kurnool",
                "geometry": {
                    "type": "Point",
                    "coordinates": [78.0373, 15.8281]
                },
                "lat": 15.8281,
                "lon": 78.0373,
                "title": "Orange Alert: Heavy to Very Heavy Rainfall",
                "description": "Expected rainfall 115.6 - 204.4 mm. Avoid waterlogged areas and low-lying roads.",
                "source": "IMD",
                "valid_from": "2026-09-28T06:00:00Z",
                "valid_to": "2026-09-29T06:00:00Z"
            }
        }
    }
