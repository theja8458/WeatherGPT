from datetime import datetime
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(default="ok", description="Overall service status")
    app_name: str
    environment: str
    database_connected: bool
    version: str = "1.0.0"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
