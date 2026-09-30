"""
tests/test_weather_service.py

Unit tests for weather_service (Prompt 18A):
- Mocked httpx calls (deterministic, zero external internet dependencies)
- Current weather response
- Daily forecast response
- Cache hit vs cache miss behavior
- Timeout and failure handling
- Circuit breaker trip and protection
"""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
import httpx

from app.services.weather_service import weather_service, _MEMORY_CACHE, _make_cache_key
from app.core.circuit_breaker import CircuitBreaker, CircuitState


@pytest.fixture(autouse=True)
def clean_and_mock_cache():
    """Cleans in-memory weather cache and isolates tests from live MongoDB Atlas."""
    _MEMORY_CACHE.clear()
    with patch("app.services.weather_service.WeatherCacheRepository.get_cached", new_callable=AsyncMock) as mock_get_cached, \
         patch("app.services.weather_service.WeatherCacheRepository.set_cached", new_callable=AsyncMock) as mock_set_cached:
        mock_get_cached.return_value = None
        mock_set_cached.return_value = None
        yield
    _MEMORY_CACHE.clear()



MOCK_CURRENT_METEO_RESPONSE = {
    "current": {
        "temperature_2m": 31.5,
        "relative_humidity_2m": 50,
        "apparent_temperature": 33.0,
        "precipitation": 0.0,
        "rain": 0.0,
        "weather_code": 1,
        "surface_pressure": 1011.5,
        "wind_speed_10m": 14.2,
        "wind_direction_10m": 190,
        "cloud_cover": 25,
        "uv_index": 6.2,
        "visibility": 12000.0,
        "time": "2026-09-29T10:00",
    }
}

MOCK_DAILY_METEO_RESPONSE = {
    "daily": {
        "time": ["2026-09-29", "2026-09-30", "2026-10-01"],
        "weather_code": [1, 2, 61],
        "temperature_2m_max": [33.5, 34.0, 31.0],
        "temperature_2m_min": [23.0, 24.0, 22.5],
        "precipitation_sum": [0.0, 0.5, 12.0],
        "precipitation_probability_max": [10, 25, 75],
        "wind_gusts_10m_max": [25.0, 30.0, 45.0],
        "sunrise": ["2026-09-29T06:05", "2026-09-30T06:06", "2026-10-01T06:06"],
        "sunset": ["2026-09-29T18:05", "2026-09-30T18:04", "2026-10-01T18:03"],
    }
}


@pytest.mark.asyncio
async def test_get_current_weather_success():
    """Tests successful current weather parsing with mocked HTTP response."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = MOCK_CURRENT_METEO_RESPONSE

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp

        res = await weather_service.get_current(17.3850, 78.4867, "Hyderabad, Telangana")

        assert res["temperature"] == 31.5
        assert res["feels_like"] == 33.0
        assert res["humidity"] == 50
        assert res["weather_description"] == "Mainly clear"
        assert res["cached"] is False
        assert res["place_name"] == "Hyderabad, Telangana"
        assert mock_get.called


@pytest.mark.asyncio
async def test_get_daily_forecast_success():
    """Tests successful daily forecast parsing with mocked HTTP response."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = MOCK_DAILY_METEO_RESPONSE

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp

        res = await weather_service.get_daily_forecast(17.3850, 78.4867, days=3, place_name="Hyderabad")

        assert "forecast" in res
        assert len(res["forecast"]) == 3
        day1 = res["forecast"][0]
        assert day1["temp_max"] == 33.5
        assert day1["temp_min"] == 23.0
        assert day1["precipitation_sum"] == 0.0
        assert res["cached"] is False


@pytest.mark.asyncio
async def test_cache_hit_behavior():
    """Tests that subsequent requests with identical coordinates return cached data without external call."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = MOCK_CURRENT_METEO_RESPONSE

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp

        # First call: Cache miss -> External fetch
        first = await weather_service.get_current(17.3850, 78.4867, "Hyderabad")
        assert first["cached"] is False
        assert mock_get.call_count == 1

        # Second call: Cache hit -> No external fetch
        second = await weather_service.get_current(17.3850, 78.4867, "Hyderabad")
        assert second["cached"] is True
        assert second["temperature"] == 31.5
        assert mock_get.call_count == 1  # external call was NOT repeated!


@pytest.mark.asyncio
async def test_cache_miss_after_eviction():
    """Tests that clearing cache triggers a new external fetch."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = MOCK_CURRENT_METEO_RESPONSE

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp

        # 1. Fetch and cache
        r1 = await weather_service.get_current(17.3850, 78.4867, "Hyderabad")
        assert mock_get.call_count == 1

        # 2. Evict cache
        _MEMORY_CACHE.clear()

        # 3. Fetch again -> triggers external call
        r2 = await weather_service.get_current(17.3850, 78.4867, "Hyderabad")
        assert mock_get.call_count == 2
        assert r2["cached"] is False


@pytest.mark.asyncio
async def test_timeout_and_failure_handling():
    """Tests graceful handling when external weather provider times out."""
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = httpx.TimeoutException("Connection timed out after 5.0s")

        # Must not raise an unhandled exception to caller; returns fallback weather structure
        res = await weather_service.get_current(17.3850, 78.4867, "Hyderabad")
        assert "temperature" in res
        assert "weather_description" in res
        assert res.get("cached") is not None


@pytest.mark.asyncio
async def test_circuit_breaker_protection():
    """Tests that consecutive provider failures trip the circuit breaker and prevent remote calls."""
    cb = CircuitBreaker("open-meteo-test", failure_threshold=2, cooldown_seconds=5.0)

    # 1. Initially CLOSED
    can_exec, _ = cb.can_execute()
    assert can_exec is True
    assert cb.state == CircuitState.CLOSED

    # 2. Record 2 failures -> trips to OPEN
    cb.record_failure(httpx.ConnectError("Network unreachable"))
    cb.record_failure(httpx.ConnectError("Network unreachable"))
    assert cb.state == CircuitState.OPEN

    # 3. Execution blocked
    can_exec, cooldown = cb.can_execute()
    assert can_exec is False
    assert cooldown > 0

    # 4. Successful recovery resets
    cb.record_success()
    assert cb.state == CircuitState.CLOSED
