from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class MessageModel(BaseModel):
    role: str = Field(..., description="Role: 'user' or 'assistant' or 'system'")
    content: str = Field(..., description="Message text content")
    language: Optional[str] = Field(default="en", description="Detected or generated language")
    intent: Optional[str] = Field(default=None, description="Classified intent (forecast, alert, etc.)")
    entities: Optional[Dict[str, Any]] = Field(default=None, description="Extracted entities")
    data_cards: Optional[List[Dict[str, Any]]] = Field(default=None, description="Attached UI cards")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ConversationModel(BaseModel):
    session_id: str = Field(..., description="Session identifier matching user")
    messages: List[MessageModel] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "populate_by_name": True
    }
