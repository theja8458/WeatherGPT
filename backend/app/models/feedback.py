from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class FeedbackModel(BaseModel):
    message_id: str = Field(..., description="ID of the chatbot message being rated")
    session_id: Optional[str] = Field(default=None, description="User session ID")
    rating: int = Field(..., ge=1, le=5, description="1-5 rating (e.g. 5 for thumbs up, 1 for thumbs down)")
    comment: Optional[str] = Field(default=None, description="Optional user textual feedback")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "populate_by_name": True
    }
