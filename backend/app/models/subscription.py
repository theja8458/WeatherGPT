from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class SubscriptionLocation(BaseModel):
    name: str = "Hyderabad"
    state: str = "Telangana"
    lat: float = 17.3850
    lon: float = 78.4867


class SubscriptionModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    session_id: str = Field(..., description="User session identifier")
    location_name: Optional[str] = Field(default=None, description="Location / District name")
    lat: Optional[float] = Field(default=None, description="Latitude")
    lon: Optional[float] = Field(default=None, description="Longitude")
    radius_km: Optional[float] = Field(default=50.0, description="Subscription radius in km")
    channel: Optional[str] = Field(default="websocket", description="Delivery channel: websocket, push, sms")
    target: Optional[str] = Field(default=None, description="Push token or target endpoint")
    location: Optional[SubscriptionLocation] = Field(default=None, description="Optional nested location object")
    alert_types: List[str] = Field(default_factory=lambda: ["all"], description="Subscribed alert categories")
    language: str = Field(default="en", description="Preferred notification language")
    push_token: Optional[str] = Field(default=None, description="WebPush/FCM device token")
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "populate_by_name": True
    }
