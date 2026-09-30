from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator
from app.core.security import sanitize_text


class ChatRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=128, description="Unique user session identifier")
    message: str = Field(..., min_length=1, max_length=1500, description="User question or voice transcript")
    language: Optional[str] = Field(default=None, max_length=10, description="Optional ISO language code override")
    lat: Optional[float] = Field(default=None, ge=-90.0, le=90.0, description="Current user latitude")
    lon: Optional[float] = Field(default=None, ge=-180.0, le=180.0, description="Current user longitude")

    @field_validator("message")
    @classmethod
    def sanitize_user_message(cls, v: str) -> str:
        clean = sanitize_text(v, max_length=1500)
        if not clean:
            raise ValueError("Message cannot be empty or solely whitespace/control characters.")
        return clean

    @field_validator("session_id")
    @classmethod
    def sanitize_session_id(cls, v: str) -> str:
        clean = sanitize_text(v, max_length=128)
        if not clean:
            raise ValueError("Invalid session_id.")
        return clean


class ChatResponse(BaseModel):
    answer: str = Field(..., description="Grounded natural language answer in user's language")
    intent: str = Field(..., description="Classified intent")
    entities: Dict[str, Any] = Field(default_factory=dict, description="Extracted entities")
    sources: List[str] = Field(default_factory=lambda: ["Open-Meteo", "IMD MoES"], description="Data providers")
    data_cards: List[Dict[str, Any]] = Field(default_factory=list, description="Structured UI widgets (weather card, forecast strip, alert)")
    follow_up_suggestions: List[str] = Field(default_factory=list, description="Dynamic suggested quick questions")
    language: str = Field(default="en", description="Detected/used language code")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
