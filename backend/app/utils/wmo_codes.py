from typing import Dict, Any

WMO_WEATHER_MAP: Dict[int, Dict[str, Any]] = {
    0: {"description": "Clear sky", "icon": "sun", "condition": "clear"},
    1: {"description": "Mainly clear", "icon": "sun", "condition": "clear"},
    2: {"description": "Partly cloudy", "icon": "cloud-sun", "condition": "partly_cloudy"},
    3: {"description": "Overcast", "icon": "cloud", "condition": "cloudy"},
    45: {"description": "Foggy", "icon": "cloud-fog", "condition": "fog"},
    48: {"description": "Depositing rime fog", "icon": "cloud-fog", "condition": "fog"},
    51: {"description": "Light drizzle", "icon": "cloud-drizzle", "condition": "drizzle"},
    53: {"description": "Moderate drizzle", "icon": "cloud-drizzle", "condition": "drizzle"},
    55: {"description": "Dense drizzle", "icon": "cloud-drizzle", "condition": "drizzle"},
    56: {"description": "Light freezing drizzle", "icon": "cloud-snow", "condition": "freezing_drizzle"},
    57: {"description": "Dense freezing drizzle", "icon": "cloud-snow", "condition": "freezing_drizzle"},
    61: {"description": "Slight rain", "icon": "cloud-rain", "condition": "rain"},
    63: {"description": "Moderate rain", "icon": "cloud-rain", "condition": "rain"},
    65: {"description": "Heavy rain", "icon": "cloud-rain-heavy", "condition": "heavy_rain"},
    66: {"description": "Light freezing rain", "icon": "cloud-snow", "condition": "freezing_rain"},
    67: {"description": "Heavy freezing rain", "icon": "cloud-snow", "condition": "freezing_rain"},
    71: {"description": "Slight snow", "icon": "snowflake", "condition": "snow"},
    73: {"description": "Moderate snow", "icon": "snowflake", "condition": "snow"},
    75: {"description": "Heavy snow", "icon": "snowflake", "condition": "snow"},
    77: {"description": "Snow grains", "icon": "snowflake", "condition": "snow"},
    80: {"description": "Slight rain showers", "icon": "cloud-rain", "condition": "showers"},
    81: {"description": "Moderate rain showers", "icon": "cloud-rain", "condition": "showers"},
    82: {"description": "Violent rain showers", "icon": "cloud-rain-heavy", "condition": "heavy_showers"},
    85: {"description": "Slight snow showers", "icon": "snowflake", "condition": "snow_showers"},
    86: {"description": "Heavy snow showers", "icon": "snowflake", "condition": "snow_showers"},
    95: {"description": "Thunderstorm", "icon": "cloud-lightning", "condition": "thunderstorm"},
    96: {"description": "Thunderstorm with slight hail", "icon": "cloud-lightning", "condition": "thunderstorm_hail"},
    99: {"description": "Thunderstorm with heavy hail", "icon": "cloud-lightning", "condition": "thunderstorm_hail"},
}


def get_wmo_metadata(code: int) -> Dict[str, Any]:
    """Returns human-readable description, icon identifier, and category for a WMO weather code."""
    return WMO_WEATHER_MAP.get(
        code,
        {"description": "Unknown Weather", "icon": "cloud", "condition": "unknown"}
    )
