from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class CurrentWeatherResponse(BaseModel):
    lat: float
    lon: float
    place_name: Optional[str] = None
    state: Optional[str] = None
    temperature: float = Field(..., description="Temperature in Celsius")
    feels_like: float = Field(..., description="Apparent temperature in Celsius")
    humidity: int = Field(..., description="Relative humidity %")
    wind_speed: float = Field(..., description="Wind speed in km/h")
    wind_direction: int = Field(..., description="Wind direction in degrees")
    surface_pressure: float = Field(..., description="Surface pressure in hPa")
    rain: float = Field(..., description="Precipitation/rain in mm")
    cloud_cover: int = Field(..., description="Cloud cover percentage")
    uv_index: float = Field(..., description="UV index")
    visibility: float = Field(..., description="Visibility in meters")
    weather_code: int = Field(..., description="WMO weather code")
    weather_description: str
    weather_icon: str
    condition: str
    fetched_at: datetime
    source: str = "Open-Meteo"
    cached: bool = False


class HourlyForecastPoint(BaseModel):
    time: str
    temperature: float
    humidity: int
    precipitation: float
    precipitation_probability: int
    weather_code: int
    weather_description: str
    weather_icon: str
    wind_speed: float
    surface_pressure: float
    uv_index: float


class HourlyForecastResponse(BaseModel):
    lat: float
    lon: float
    place_name: Optional[str] = None
    hours_count: int
    forecast: List[HourlyForecastPoint]
    fetched_at: datetime
    source: str = "Open-Meteo"
    cached: bool = False


class DailyForecastDay(BaseModel):
    date: str
    weather_code: int
    weather_description: str
    weather_icon: str
    temp_max: float
    temp_min: float
    precipitation_sum: float
    precipitation_probability_max: int
    wind_gusts_max: float
    sunrise: str
    sunset: str


class DailyForecastResponse(BaseModel):
    lat: float
    lon: float
    place_name: Optional[str] = None
    days_count: int
    forecast: List[DailyForecastDay]
    fetched_at: datetime
    source: str = "Open-Meteo"
    cached: bool = False


class AirQualityResponse(BaseModel):
    lat: float
    lon: float
    place_name: Optional[str] = None
    pm2_5: float = Field(..., description="PM2.5 in µg/m³")
    pm10: float = Field(..., description="PM10 in µg/m³")
    aqi: int = Field(..., description="US Air Quality Index")
    european_aqi: Optional[int] = Field(default=None, description="European AQI")
    category: str = Field(..., description="Good, Moderate, Unhealthy for Sensitive Groups, Unhealthy, Very Unhealthy, Hazardous")
    fetched_at: datetime
    source: str = "Open-Meteo Air Quality"
    cached: bool = False
