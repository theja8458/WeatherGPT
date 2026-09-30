from functools import lru_cache
from typing import List, Optional, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "WeatherGPT API"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    
    # MongoDB Atlas
    MONGODB_URI: str = "mongodb://localhost:27017/weathergpt"
    MONGODB_DB_NAME: str = "weathergpt"
    MONGODB_MIN_POOL_SIZE: int = 5
    MONGODB_MAX_POOL_SIZE: int = 50
    
    # LLM & External Services
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    OPENWEATHER_KEY: Optional[str] = None
    
    # MQTT / WIS 2.0
    MQTT_BROKER_HOST: str = "broker.emqx.io"
    MQTT_BROKER_PORT: int = 1883
    
    # Frontend & CORS
    FRONTEND_URL: str = "http://localhost:5173"
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "https://weather-gpt-sigma-ten.vercel.app",
    ]
    
    # Logging
    LOG_LEVEL: str = "INFO"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return ["*"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
