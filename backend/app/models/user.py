from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class UserRole(str, Enum):
    FARMER = "farmer"
    CITIZEN = "citizen"
    RESEARCHER = "researcher"
    AVIATION = "aviation"
    MARINE = "marine"
    DISASTER_MANAGER = "disaster_manager"
    OFFICER = "officer"


class UserLocation(BaseModel):
    name: str = "Hyderabad"
    state: str = "Telangana"
    lat: float = 17.3850
    lon: float = 78.4867


class UserModel(BaseModel):
    session_id: str = Field(..., description="Unique anonymous session identifier")
    preferred_language: str = Field(default="en", description="ISO 639-1 language code (en, hi, te, ta, etc.)")
    home_location: UserLocation = Field(default_factory=UserLocation)
    role: UserRole = Field(default=UserRole.CITIZEN, description="Persona role")
    onboarded: bool = Field(default=False, description="Whether user has completed first-run onboarding")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "session_id": "anon-sess-12345",
                "preferred_language": "te",
                "home_location": {
                    "name": "Kurnool",
                    "state": "Andhra Pradesh",
                    "lat": 15.8281,
                    "lon": 78.0373
                },
                "role": "farmer",
                "created_at": "2026-09-28T12:00:00Z"
            }
        }
    }
