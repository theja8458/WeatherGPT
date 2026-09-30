from typing import List, Optional
from pydantic import BaseModel, Field


class LocationCandidate(BaseModel):
    name: str = Field(..., description="Official place or district name")
    state: str = Field(..., description="State or Union Territory")
    district: Optional[str] = Field(default=None, description="District name")
    country: str = Field(default="India")
    lat: float = Field(..., description="Latitude")
    lon: float = Field(..., description="Longitude")
    score: float = Field(default=1.0, description="Relevance rank score")
    source: str = Field(default="local_db", description="Source provider: local_db or open_meteo")
    aliases: List[str] = Field(default_factory=list, description="Alternative names / spellings")


class LocationSearchResponse(BaseModel):
    query: str
    count: int
    results: List[LocationCandidate]


class ReverseGeocodeResponse(BaseModel):
    lat: float
    lon: float
    name: str
    district: Optional[str] = None
    state: Optional[str] = None
    country: str = "India"
    source: str = "local_db"
