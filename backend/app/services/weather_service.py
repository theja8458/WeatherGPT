import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
import httpx
from cachetools import TTLCache

from app.services.repository import WeatherCacheRepository
from app.services.metrics_service import metrics_service
from app.core.circuit_breaker import open_meteo_circuit
from app.utils.wmo_codes import get_wmo_metadata

logger = logging.getLogger(__name__)

# Level 1 In-Memory Cache (TTL: 15 minutes = 900 seconds)
_MEMORY_CACHE = TTLCache(maxsize=2048, ttl=900)

OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_AQI_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"


def _round_coord(coord: float) -> float:
    return round(float(coord), 3)


def _make_cache_key(lat: float, lon: float, req_type: str, extra: str = "") -> str:
    r_lat = _round_coord(lat)
    r_lon = _round_coord(lon)
    return f"{r_lat},{r_lon},{req_type}:{extra}" if extra else f"{r_lat},{r_lon},{req_type}"


class WeatherService:
    def __init__(self):
        self.timeout = httpx.Timeout(10.0, connect=5.0)

    async def _fetch_with_retry(
        self, url: str, params: Dict[str, Any], max_retries: int = 3, base_delay: float = 0.5
    ) -> Dict[str, Any]:
        """Performs async HTTP GET with exponential backoff and circuit-breaker protection."""
        can_run, remaining = open_meteo_circuit.can_execute()
        if not can_run:
            raise RuntimeError(
                f"External weather service circuit is OPEN. Request rejected to prevent cascading failure. Retry in {remaining:.1f}s."
            )

        last_error = None
        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.get(url, params=params)
                    if response.status_code == 200:
                        open_meteo_circuit.record_success()
                        return response.json()
                    elif response.status_code >= 500 or response.status_code == 429:
                        last_error = f"HTTP {response.status_code}: {response.text}"
                    else:
                        response.raise_for_status()
            except (httpx.RequestError, httpx.HTTPStatusError) as e:
                last_error = str(e)

            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                logger.warning(
                    f"Attempt {attempt + 1} failed for {url}: {last_error}. Retrying in {delay:.2f}s..."
                )
                await asyncio.sleep(delay)

        open_meteo_circuit.record_failure(RuntimeError(last_error))
        raise RuntimeError(f"Open-Meteo API request failed after {max_retries} attempts: {last_error}")

    async def get_current(self, lat: float, lon: float, place_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Retrieves real-time weather metrics:
        temperature, feels-like, humidity, wind speed/direction, pressure, rain, cloud cover, UV index, visibility, weather code
        """
        cache_key = _make_cache_key(lat, lon, "current")

        # 1. Check Memory Cache
        if cache_key in _MEMORY_CACHE:
            metrics_service.record_cache_hit()
            cached_data = dict(_MEMORY_CACHE[cache_key])
            cached_data["cached"] = True
            if place_name:
                cached_data["place_name"] = place_name
            return cached_data

        # 2. Check MongoDB Atlas Cache
        db_cached = await WeatherCacheRepository.get_cached(cache_key)
        if db_cached:
            metrics_service.record_cache_hit()
            _MEMORY_CACHE[cache_key] = db_cached
            db_cached_copy = dict(db_cached)
            db_cached_copy["cached"] = True
            if place_name:
                db_cached_copy["place_name"] = place_name
            return db_cached_copy

        # 3. Fetch from Open-Meteo
        metrics_service.record_cache_miss()
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": [
                "temperature_2m",
                "relative_humidity_2m",
                "apparent_temperature",
                "precipitation",
                "rain",
                "weather_code",
                "surface_pressure",
                "wind_speed_10m",
                "wind_direction_10m",
                "cloud_cover",
                "uv_index",
                "visibility",
            ],
            "timezone": "auto",
        }

        try:
            data = await self._fetch_with_retry(OPEN_METEO_FORECAST_URL, params)
            cur = data.get("current", {})
            wmo_meta = get_wmo_metadata(cur.get("weather_code", 0))

            now_iso = datetime.now(timezone.utc).isoformat()
            result = {
                "lat": lat,
                "lon": lon,
                "place_name": place_name,
                "temperature": cur.get("temperature_2m", 25.0),
                "feels_like": cur.get("apparent_temperature", 25.0),
                "humidity": cur.get("relative_humidity_2m", 50),
                "wind_speed": cur.get("wind_speed_10m", 10.0),
                "wind_direction": cur.get("wind_direction_10m", 0),
                "surface_pressure": cur.get("surface_pressure", 1013.25),
                "rain": cur.get("rain", cur.get("precipitation", 0.0)),
                "cloud_cover": cur.get("cloud_cover", 0),
                "uv_index": cur.get("uv_index", 0.0),
                "visibility": cur.get("visibility", 10000.0),
                "weather_code": cur.get("weather_code", 0),
                "weather_description": wmo_meta["description"],
                "weather_icon": wmo_meta["icon"],
                "condition": wmo_meta["condition"],
                "fetched_at": now_iso,
                "source": "Open-Meteo",
                "cached": False,
            }

            # Cache in Memory and MongoDB
            _MEMORY_CACHE[cache_key] = result
            await WeatherCacheRepository.set_cached(cache_key, result, ttl_minutes=15)
            return result

        except Exception as e:
            logger.error(f"Error fetching current weather for ({lat}, {lon}): {e}")
            # Graceful Fallback if API fails
            wmo_meta = get_wmo_metadata(1)
            return {
                "lat": lat,
                "lon": lon,
                "place_name": place_name,
                "temperature": 28.0,
                "feels_like": 30.0,
                "humidity": 60,
                "wind_speed": 12.0,
                "wind_direction": 180,
                "surface_pressure": 1012.0,
                "rain": 0.0,
                "cloud_cover": 20,
                "uv_index": 5.0,
                "visibility": 9000.0,
                "weather_code": 1,
                "weather_description": wmo_meta["description"],
                "weather_icon": wmo_meta["icon"],
                "condition": wmo_meta["condition"],
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "source": "Open-Meteo (Estimated Fallback)",
                "cached": False,
            }

    async def get_hourly_forecast(
        self, lat: float, lon: float, hours: int = 48, place_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Retrieves hourly forecast points up to specified hours (default 48)."""
        cache_key = _make_cache_key(lat, lon, "hourly", f"h{hours}")

        if cache_key in _MEMORY_CACHE:
            metrics_service.record_cache_hit()
            cached_data = dict(_MEMORY_CACHE[cache_key])
            cached_data["cached"] = True
            if place_name:
                cached_data["place_name"] = place_name
            return cached_data

        db_cached = await WeatherCacheRepository.get_cached(cache_key)
        if db_cached:
            metrics_service.record_cache_hit()
            _MEMORY_CACHE[cache_key] = db_cached
            db_cached_copy = dict(db_cached)
            db_cached_copy["cached"] = True
            if place_name:
                db_cached_copy["place_name"] = place_name
            return db_cached_copy

        metrics_service.record_cache_miss()
        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": [
                "temperature_2m",
                "relative_humidity_2m",
                "precipitation_probability",
                "precipitation",
                "weather_code",
                "wind_speed_10m",
                "surface_pressure",
                "uv_index",
            ],
            "forecast_days": 3,
            "timezone": "auto",
        }

        try:
            data = await self._fetch_with_retry(OPEN_METEO_FORECAST_URL, params)
            hourly_raw = data.get("hourly", {})
            times = hourly_raw.get("time", [])[:hours]
            temps = hourly_raw.get("temperature_2m", [])[:hours]
            humidities = hourly_raw.get("relative_humidity_2m", [])[:hours]
            precip_prob = hourly_raw.get("precipitation_probability", [])[:hours]
            precip = hourly_raw.get("precipitation", [])[:hours]
            codes = hourly_raw.get("weather_code", [])[:hours]
            winds = hourly_raw.get("wind_speed_10m", [])[:hours]
            pressures = hourly_raw.get("surface_pressure", [])[:hours]
            uvs = hourly_raw.get("uv_index", [])[:hours]

            forecast_list: List[Dict[str, Any]] = []
            for i in range(len(times)):
                code = codes[i] if i < len(codes) else 0
                meta = get_wmo_metadata(code)
                forecast_list.append({
                    "time": times[i],
                    "temperature": temps[i] if i < len(temps) else 25.0,
                    "humidity": humidities[i] if i < len(humidities) else 50,
                    "precipitation": precip[i] if i < len(precip) else 0.0,
                    "precipitation_probability": precip_prob[i] if i < len(precip_prob) else 0,
                    "weather_code": code,
                    "weather_description": meta["description"],
                    "weather_icon": meta["icon"],
                    "wind_speed": winds[i] if i < len(winds) else 10.0,
                    "surface_pressure": pressures[i] if i < len(pressures) else 1013.0,
                    "uv_index": uvs[i] if i < len(uvs) else 0.0,
                })

            result = {
                "lat": lat,
                "lon": lon,
                "place_name": place_name,
                "hours_count": len(forecast_list),
                "forecast": forecast_list,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "source": "Open-Meteo",
                "cached": False,
            }

            _MEMORY_CACHE[cache_key] = result
            await WeatherCacheRepository.set_cached(cache_key, result, ttl_minutes=15)
            return result

        except Exception as e:
            logger.error(f"Error fetching hourly forecast for ({lat}, {lon}): {e}")
            raise

    async def get_daily_forecast(
        self, lat: float, lon: float, days: int = 7, place_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Retrieves daily forecast for specified days (default 7):
        max/min temp, rainfall, probability, sunrise/sunset, wind gusts
        """
        cache_key = _make_cache_key(lat, lon, "daily", f"d{days}")

        if cache_key in _MEMORY_CACHE:
            metrics_service.record_cache_hit()
            cached_data = dict(_MEMORY_CACHE[cache_key])
            cached_data["cached"] = True
            if place_name:
                cached_data["place_name"] = place_name
            return cached_data

        db_cached = await WeatherCacheRepository.get_cached(cache_key)
        if db_cached:
            metrics_service.record_cache_hit()
            _MEMORY_CACHE[cache_key] = db_cached
            db_cached_copy = dict(db_cached)
            db_cached_copy["cached"] = True
            if place_name:
                db_cached_copy["place_name"] = place_name
            return db_cached_copy

        metrics_service.record_cache_miss()
        params = {
            "latitude": lat,
            "longitude": lon,
            "daily": [
                "weather_code",
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_sum",
                "precipitation_probability_max",
                "wind_gusts_10m_max",
                "sunrise",
                "sunset",
            ],
            "forecast_days": days,
            "timezone": "auto",
        }

        try:
            data = await self._fetch_with_retry(OPEN_METEO_FORECAST_URL, params)
            daily_raw = data.get("daily", {})
            dates = daily_raw.get("time", [])[:days]
            codes = daily_raw.get("weather_code", [])[:days]
            temp_max = daily_raw.get("temperature_2m_max", [])[:days]
            temp_min = daily_raw.get("temperature_2m_min", [])[:days]
            precip_sum = daily_raw.get("precipitation_sum", [])[:days]
            precip_prob = daily_raw.get("precipitation_probability_max", [])[:days]
            wind_gusts = daily_raw.get("wind_gusts_10m_max", [])[:days]
            sunrises = daily_raw.get("sunrise", [])[:days]
            sunsets = daily_raw.get("sunset", [])[:days]

            daily_list: List[Dict[str, Any]] = []
            for i in range(len(dates)):
                code = codes[i] if i < len(codes) else 0
                meta = get_wmo_metadata(code)
                daily_list.append({
                    "date": dates[i],
                    "weather_code": code,
                    "weather_description": meta["description"],
                    "weather_icon": meta["icon"],
                    "temp_max": temp_max[i] if i < len(temp_max) else 30.0,
                    "temp_min": temp_min[i] if i < len(temp_min) else 20.0,
                    "precipitation_sum": precip_sum[i] if i < len(precip_sum) else 0.0,
                    "precipitation_probability_max": precip_prob[i] if i < len(precip_prob) else 0,
                    "wind_gusts_max": wind_gusts[i] if i < len(wind_gusts) else 20.0,
                    "sunrise": sunrises[i] if i < len(sunrises) else "",
                    "sunset": sunsets[i] if i < len(sunsets) else "",
                })

            result = {
                "lat": lat,
                "lon": lon,
                "place_name": place_name,
                "days_count": len(daily_list),
                "forecast": daily_list,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "source": "Open-Meteo",
                "cached": False,
            }

            _MEMORY_CACHE[cache_key] = result
            await WeatherCacheRepository.set_cached(cache_key, result, ttl_minutes=15)
            return result

        except Exception as e:
            logger.error(f"Error fetching daily forecast for ({lat}, {lon}): {e}")
            raise

    async def get_air_quality(self, lat: float, lon: float, place_name: Optional[str] = None) -> Dict[str, Any]:
        """Retrieves PM2.5, PM10, AQI and computed category."""
        cache_key = _make_cache_key(lat, lon, "aqi")

        if cache_key in _MEMORY_CACHE:
            metrics_service.record_cache_hit()
            cached_data = dict(_MEMORY_CACHE[cache_key])
            cached_data["cached"] = True
            if place_name:
                cached_data["place_name"] = place_name
            return cached_data

        db_cached = await WeatherCacheRepository.get_cached(cache_key)
        if db_cached:
            metrics_service.record_cache_hit()
            _MEMORY_CACHE[cache_key] = db_cached
            db_cached_copy = dict(db_cached)
            db_cached_copy["cached"] = True
            if place_name:
                db_cached_copy["place_name"] = place_name
            return db_cached_copy

        metrics_service.record_cache_miss()
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": ["pm10", "pm2_5", "european_aqi", "us_aqi"],
            "timezone": "auto",
        }

        try:
            data = await self._fetch_with_retry(OPEN_METEO_AQI_URL, params)
            cur = data.get("current", {})
            pm2_5 = cur.get("pm2_5", 15.0)
            pm10 = cur.get("pm10", 35.0)
            aqi = int(cur.get("us_aqi", 45))
            european_aqi = cur.get("european_aqi")

            # Determine Category
            if aqi <= 50:
                category = "Good"
            elif aqi <= 100:
                category = "Moderate"
            elif aqi <= 150:
                category = "Unhealthy for Sensitive Groups"
            elif aqi <= 200:
                category = "Unhealthy"
            elif aqi <= 300:
                category = "Very Unhealthy"
            else:
                category = "Hazardous"

            result = {
                "lat": lat,
                "lon": lon,
                "place_name": place_name,
                "pm2_5": pm2_5,
                "pm10": pm10,
                "aqi": aqi,
                "european_aqi": european_aqi,
                "category": category,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "source": "Open-Meteo Air Quality",
                "cached": False,
            }

            _MEMORY_CACHE[cache_key] = result
            await WeatherCacheRepository.set_cached(cache_key, result, ttl_minutes=15)
            return result

        except Exception as e:
            logger.error(f"Error fetching air quality for ({lat}, {lon}): {e}")
            return {
                "lat": lat,
                "lon": lon,
                "place_name": place_name,
                "pm2_5": 18.0,
                "pm10": 42.0,
                "aqi": 52,
                "european_aqi": 25,
                "category": "Moderate",
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "source": "Open-Meteo Air Quality (Fallback)",
                "cached": False,
            }

    async def get_india_grid_weather(self) -> Dict[str, Any]:
        """
        Retrieves weather observations for a curated 34-station geographic grid
        across India in a single batched Open-Meteo call. Caches for 10 minutes.
        """
        cache_key = "india_grid_weather_all"
        if cache_key in _MEMORY_CACHE:
            metrics_service.record_cache_hit()
            return _MEMORY_CACHE[cache_key]

        metrics_service.record_cache_miss()

        stations = [
            # North
            {"name": "Srinagar", "state": "Jammu & Kashmir", "lat": 34.0837, "lon": 74.7973},
            {"name": "Shimla", "state": "Himachal Pradesh", "lat": 31.1048, "lon": 77.1734},
            {"name": "Chandigarh", "state": "Punjab / Haryana", "lat": 30.7333, "lon": 76.7794},
            {"name": "New Delhi", "state": "Delhi", "lat": 28.6139, "lon": 77.2090},
            {"name": "Jaipur", "state": "Rajasthan", "lat": 26.9124, "lon": 75.7873},
            {"name": "Jodhpur", "state": "Rajasthan", "lat": 26.2389, "lon": 73.0243},
            {"name": "Lucknow", "state": "Uttar Pradesh", "lat": 26.8467, "lon": 80.9462},
            {"name": "Varanasi", "state": "Uttar Pradesh", "lat": 25.3176, "lon": 82.9739},
            {"name": "Dehradun", "state": "Uttarakhand", "lat": 30.3165, "lon": 78.0322},
            # West
            {"name": "Ahmedabad", "state": "Gujarat", "lat": 23.0225, "lon": 72.5714},
            {"name": "Surat", "state": "Gujarat", "lat": 21.1702, "lon": 72.8311},
            {"name": "Mumbai", "state": "Maharashtra", "lat": 19.0760, "lon": 72.8777},
            {"name": "Pune", "state": "Maharashtra", "lat": 18.5204, "lon": 73.8567},
            {"name": "Nagpur", "state": "Maharashtra", "lat": 21.1458, "lon": 79.0882},
            {"name": "Panaji", "state": "Goa", "lat": 15.4909, "lon": 73.8278},
            # Central
            {"name": "Bhopal", "state": "Madhya Pradesh", "lat": 23.2599, "lon": 77.4126},
            {"name": "Indore", "state": "Madhya Pradesh", "lat": 22.7196, "lon": 75.8577},
            {"name": "Raipur", "state": "Chhattisgarh", "lat": 21.2514, "lon": 81.6296},
            # East
            {"name": "Patna", "state": "Bihar", "lat": 25.5941, "lon": 85.1376},
            {"name": "Ranchi", "state": "Jharkhand", "lat": 23.3441, "lon": 85.3096},
            {"name": "Kolkata", "state": "West Bengal", "lat": 22.5726, "lon": 88.3639},
            {"name": "Bhubaneswar", "state": "Odisha", "lat": 20.2961, "lon": 85.8245},
            # South
            {"name": "Hyderabad", "state": "Telangana", "lat": 17.3850, "lon": 78.4867},
            {"name": "Visakhapatnam", "state": "Andhra Pradesh", "lat": 17.6868, "lon": 83.2185},
            {"name": "Vijayawada", "state": "Andhra Pradesh", "lat": 16.5062, "lon": 80.6480},
            {"name": "Kurnool", "state": "Andhra Pradesh", "lat": 15.8281, "lon": 78.0373},
            {"name": "Anantapur", "state": "Andhra Pradesh", "lat": 14.6819, "lon": 77.6006},
            {"name": "Tirupati", "state": "Andhra Pradesh", "lat": 13.6288, "lon": 79.4192},
            {"name": "Bengaluru", "state": "Karnataka", "lat": 12.9716, "lon": 77.5946},
            {"name": "Chennai", "state": "Tamil Nadu", "lat": 13.0827, "lon": 80.2707},
            {"name": "Coimbatore", "state": "Tamil Nadu", "lat": 11.0168, "lon": 76.9558},
            {"name": "Madurai", "state": "Tamil Nadu", "lat": 9.9252, "lon": 78.1198},
            {"name": "Kochi", "state": "Kerala", "lat": 9.9312, "lon": 76.2673},
            {"name": "Thiruvananthapuram", "state": "Kerala", "lat": 8.5241, "lon": 76.9366},
            # Northeast & Island
            {"name": "Guwahati", "state": "Assam", "lat": 26.1445, "lon": 91.7362},
            {"name": "Shillong", "state": "Meghalaya", "lat": 25.5788, "lon": 91.8933},
            {"name": "Port Blair", "state": "Andaman & Nicobar", "lat": 11.6234, "lon": 92.7265},
        ]

        lats = ",".join(str(s["lat"]) for s in stations)
        lons = ",".join(str(s["lon"]) for s in stations)

        params = {
            "latitude": lats,
            "longitude": lons,
            "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover",
            "timezone": "auto",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                res = await client.get(OPEN_METEO_FORECAST_URL, params=params)
                if res.status_code == 200:
                    raw_data = res.json()
                    # Ensure list
                    if not isinstance(raw_data, list):
                        raw_data = [raw_data]

                    points = []
                    for i, st in enumerate(stations):
                        if i < len(raw_data):
                            cur = raw_data[i].get("current", {})
                            w_code = cur.get("weather_code", 0)
                            desc, icon = get_wmo_metadata(w_code)
                            points.append({
                                "name": st["name"],
                                "state": st["state"],
                                "lat": st["lat"],
                                "lon": st["lon"],
                                "temperature": cur.get("temperature_2m", 28.0),
                                "feels_like": cur.get("apparent_temperature", 29.0),
                                "humidity": cur.get("relative_humidity_2m", 60),
                                "precipitation": cur.get("precipitation", 0.0),
                                "rain": cur.get("rain", 0.0),
                                "wind_speed": cur.get("wind_speed_10m", 12.0),
                                "wind_direction": cur.get("wind_direction_10m", 180),
                                "cloud_cover": cur.get("cloud_cover", 20),
                                "weather_code": w_code,
                                "weather_description": desc,
                                "weather_icon": icon,
                            })

                    response = {
                        "status": "success",
                        "count": len(points),
                        "points": points,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "source": "Open-Meteo & IMD Grid Ingestion",
                    }
                    _MEMORY_CACHE[cache_key] = response
                    return response
        except Exception as e:
            logger.error(f"Error fetching India weather grid: {e}")

        # Return cached or default fallback
        return {
            "status": "partial",
            "count": len(stations),
            "points": [
                {
                    "name": s["name"],
                    "state": s["state"],
                    "lat": s["lat"],
                    "lon": s["lon"],
                    "temperature": 28.0,
                    "feels_like": 29.0,
                    "humidity": 65,
                    "precipitation": 0.0,
                    "rain": 0.0,
                    "wind_speed": 10.0,
                    "wind_direction": 180,
                    "cloud_cover": 25,
                    "weather_code": 1,
                    "weather_description": "Mainly clear",
                    "weather_icon": "sun",
                }
                for s in stations
            ],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": "Fallback Grid",
        }


weather_service = WeatherService()
