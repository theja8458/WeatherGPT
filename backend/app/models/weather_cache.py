from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class WeatherCacheModel(BaseModel):
    key: str = Field(..., description="Unique compound key: lat,lon,type (e.g. '17.385,78.4867,current')")
    data: Dict[str, Any] = Field(..., description="Cached JSON weather payload")
    fetched_at: datetime = Field(default_factory=datetime.utcnow, description="Time data was retrieved from provider")
    expires_at: Optional[datetime] = Field(default=None, description="Explicit expiration timestamp")

    model_config = {
        "populate_by_name": True
    }
