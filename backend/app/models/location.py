from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class LocationModel(BaseModel):
    name: str = Field(..., description="Official City or District Name")
    state: str = Field(..., description="State or Union Territory")
    district: str = Field(..., description="District Name")
    lat: float = Field(..., description="Latitude")
    lon: float = Field(..., description="Longitude")
    aliases: List[str] = Field(default_factory=list, description="Common Indian alternative spellings or nicknames")
    is_capital: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "name": "Visakhapatnam",
                "state": "Andhra Pradesh",
                "district": "Visakhapatnam",
                "lat": 17.6868,
                "lon": 83.2185,
                "aliases": ["Vizag", "Waltair"]
            }
        }
    }
