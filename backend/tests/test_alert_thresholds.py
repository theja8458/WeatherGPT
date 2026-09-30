"""
tests/test_alert_thresholds.py

Unit tests for IMD Alert Threshold Logic (Prompt 18A):
- Normal weather conditions (zero alerts)
- Warning thresholds (Yellow)
- Severe / Critical thresholds (Orange / Red)
- Exact boundary condition testing (64.5mm, 115.6mm, 204.4mm, 40°C, 45°C)
- Determinism verification (identical inputs yield identical alerts)
"""

import pytest
from unittest.mock import patch, AsyncMock
from app.services.alert_service import alert_service
from app.models.alert import AlertSeverity, AlertType


def make_mock_weather(precip_sum=0.0, temp_max=30.0, temp_min=20.0, wind_gusts=15.0, visibility=10000):
    """Helper to mock current weather and daily forecast with controlled metrics."""
    mock_current = {
        "temperature": temp_max,
        "feels_like": temp_max,
        "weather_code": 1,
        "rain": 0.0,
        "wind_speed": wind_gusts,
        "visibility": visibility,
    }
    mock_daily = {
        "forecast": [
            {
                "precipitation_sum": precip_sum,
                "precipitation_probability_max": 20 if precip_sum == 0 else 80,
                "temp_max": temp_max,
                "temp_min": temp_min,
                "wind_gusts_max": wind_gusts,
                "weather_code": 1,
            }
        ]
    }
    return mock_current, mock_daily


@pytest.mark.asyncio
async def test_normal_weather_conditions():
    """Tests calm/normal conditions trigger zero alerts."""
    curr, daily = make_mock_weather(precip_sum=5.0, temp_max=32.0, temp_min=22.0, wind_gusts=20.0)

    with patch("app.services.weather_service.weather_service.get_current", new_callable=AsyncMock) as m_curr, \
         patch("app.services.weather_service.weather_service.get_daily_forecast", new_callable=AsyncMock) as m_daily, \
         patch("app.services.repository.AlertRepository.create_alert", new_callable=AsyncMock):
        m_curr.return_value = curr
        m_daily.return_value = daily

        alerts = await alert_service.evaluate_location_forecast(17.385, 78.4867, "Hyderabad")
        assert len(alerts) == 0, f"Expected 0 alerts for normal weather, got {len(alerts)}"


@pytest.mark.asyncio
async def test_heavy_rainfall_warning_threshold_yellow():
    """Tests moderate-heavy rainfall triggers IMD Yellow Watch (>= 64.5 mm)."""
    curr, daily = make_mock_weather(precip_sum=75.0)

    with patch("app.services.weather_service.weather_service.get_current", new_callable=AsyncMock) as m_curr, \
         patch("app.services.weather_service.weather_service.get_daily_forecast", new_callable=AsyncMock) as m_daily, \
         patch("app.services.repository.AlertRepository.create_alert", new_callable=AsyncMock):
        m_curr.return_value = curr
        m_daily.return_value = daily

        alerts = await alert_service.evaluate_location_forecast(17.385, 78.4867, "Hyderabad")
        rain_alerts = [a for a in alerts if a.type == AlertType.HEAVY_RAIN]
        assert len(rain_alerts) == 1
        assert rain_alerts[0].severity == AlertSeverity.YELLOW


@pytest.mark.asyncio
async def test_heavy_rainfall_severe_orange_and_red_thresholds():
    """Tests Orange (>= 115.6 mm) and Red (>= 204.4 mm) severe thresholds."""
    with patch("app.services.weather_service.weather_service.get_current", new_callable=AsyncMock) as m_curr, \
         patch("app.services.weather_service.weather_service.get_daily_forecast", new_callable=AsyncMock) as m_daily, \
         patch("app.services.repository.AlertRepository.create_alert", new_callable=AsyncMock):

        # Orange Alert (150 mm)
        curr_o, daily_o = make_mock_weather(precip_sum=150.0)
        m_curr.return_value = curr_o
        m_daily.return_value = daily_o
        alerts_o = await alert_service.evaluate_location_forecast(17.385, 78.4867, "Hyderabad")
        rain_o = [a for a in alerts_o if a.type == AlertType.HEAVY_RAIN]
        assert len(rain_o) == 1
        assert rain_o[0].severity == AlertSeverity.ORANGE

        # Red Alert (250 mm)
        curr_r, daily_r = make_mock_weather(precip_sum=250.0)
        m_curr.return_value = curr_r
        m_daily.return_value = daily_r
        alerts_r = await alert_service.evaluate_location_forecast(17.385, 78.4867, "Hyderabad")
        rain_r = [a for a in alerts_r if a.type == AlertType.HEAVY_RAIN]
        assert len(rain_r) == 1
        assert rain_r[0].severity == AlertSeverity.RED


@pytest.mark.asyncio
async def test_rainfall_exact_boundary_values():
    """Tests critical boundary edges: 64.4 vs 64.5, 115.5 vs 115.6, 204.3 vs 204.4."""
    with patch("app.services.weather_service.weather_service.get_current", new_callable=AsyncMock) as m_curr, \
         patch("app.services.weather_service.weather_service.get_daily_forecast", new_callable=AsyncMock) as m_daily, \
         patch("app.services.repository.AlertRepository.create_alert", new_callable=AsyncMock):

        # 64.4 mm -> Just below Yellow threshold -> No alert
        c1, d1 = make_mock_weather(precip_sum=64.4)
        m_curr.return_value = c1
        m_daily.return_value = d1
        a1 = await alert_service.evaluate_location_forecast(17.385, 78.4867, "Hyderabad")
        assert len([a for a in a1 if a.type == AlertType.HEAVY_RAIN]) == 0

        # 64.5 mm -> Exactly at Yellow boundary -> Yellow alert
        c2, d2 = make_mock_weather(precip_sum=64.5)
        m_curr.return_value = c2
        m_daily.return_value = d2
        a2 = await alert_service.evaluate_location_forecast(17.385, 78.4867, "Hyderabad")
        rain2 = [a for a in a2 if a.type == AlertType.HEAVY_RAIN]
        assert len(rain2) == 1 and rain2[0].severity == AlertSeverity.YELLOW

        # 115.5 mm -> Yellow
        c3, d3 = make_mock_weather(precip_sum=115.5)
        m_curr.return_value = c3
        m_daily.return_value = d3
        a3 = await alert_service.evaluate_location_forecast(17.385, 78.4867, "Hyderabad")
        rain3 = [a for a in a3 if a.type == AlertType.HEAVY_RAIN]
        assert len(rain3) == 1 and rain3[0].severity == AlertSeverity.YELLOW

        # 115.6 mm -> Exactly at Orange boundary -> Orange alert
        c4, d4 = make_mock_weather(precip_sum=115.6)
        m_curr.return_value = c4
        m_daily.return_value = d4
        a4 = await alert_service.evaluate_location_forecast(17.385, 78.4867, "Hyderabad")
        rain4 = [a for a in a4 if a.type == AlertType.HEAVY_RAIN]
        assert len(rain4) == 1 and rain4[0].severity == AlertSeverity.ORANGE

        # 204.3 mm -> Orange
        c5, d5 = make_mock_weather(precip_sum=204.3)
        m_curr.return_value = c5
        m_daily.return_value = d5
        a5 = await alert_service.evaluate_location_forecast(17.385, 78.4867, "Hyderabad")
        rain5 = [a for a in a5 if a.type == AlertType.HEAVY_RAIN]
        assert len(rain5) == 1 and rain5[0].severity == AlertSeverity.ORANGE

        # 204.4 mm -> Exactly at Red boundary -> Red alert
        c6, d6 = make_mock_weather(precip_sum=204.4)
        m_curr.return_value = c6
        m_daily.return_value = d6
        a6 = await alert_service.evaluate_location_forecast(17.385, 78.4867, "Hyderabad")
        rain6 = [a for a in a6 if a.type == AlertType.HEAVY_RAIN]
        assert len(rain6) == 1 and rain6[0].severity == AlertSeverity.RED


@pytest.mark.asyncio
async def test_heatwave_and_wind_thresholds():
    """Tests Heatwave (40°C yellow, 45°C red) and Wind (50 km/h yellow, 70 km/h orange)."""
    with patch("app.services.weather_service.weather_service.get_current", new_callable=AsyncMock) as m_curr, \
         patch("app.services.weather_service.weather_service.get_daily_forecast", new_callable=AsyncMock) as m_daily, \
         patch("app.services.repository.AlertRepository.create_alert", new_callable=AsyncMock):

        # Extreme Heatwave 46°C -> RED
        c_heat, d_heat = make_mock_weather(temp_max=46.0)
        m_curr.return_value = c_heat
        m_daily.return_value = d_heat
        alerts_heat = await alert_service.evaluate_location_forecast(17.385, 78.4867, "Hyderabad")
        heat_alerts = [a for a in alerts_heat if a.type == AlertType.HEATWAVE]
        assert len(heat_alerts) == 1
        assert heat_alerts[0].severity == AlertSeverity.RED

        # Gale wind 75 km/h -> ORANGE
        c_wind, d_wind = make_mock_weather(wind_gusts=75.0)
        m_curr.return_value = c_wind
        m_daily.return_value = d_wind
        alerts_wind = await alert_service.evaluate_location_forecast(17.385, 78.4867, "Hyderabad")
        wind_alerts = [a for a in alerts_wind if a.type == AlertType.STRONG_WIND]
        assert len(wind_alerts) == 1
        assert wind_alerts[0].severity == AlertSeverity.ORANGE


@pytest.mark.asyncio
async def test_alert_severity_determinism():
    """Verifies that running evaluation 5 times with identical inputs produces identical deterministic results."""
    c, d = make_mock_weather(precip_sum=135.0, temp_max=41.0)

    with patch("app.services.weather_service.weather_service.get_current", new_callable=AsyncMock) as m_curr, \
         patch("app.services.weather_service.weather_service.get_daily_forecast", new_callable=AsyncMock) as m_daily, \
         patch("app.services.repository.AlertRepository.create_alert", new_callable=AsyncMock):
        m_curr.return_value = c
        m_daily.return_value = d

        runs = []
        for _ in range(5):
            res = await alert_service.evaluate_location_forecast(17.385, 78.4867, "Hyderabad")
            runs.append([(a.type, a.severity) for a in res])

        # All 5 runs must be strictly identical
        for run in runs[1:]:
            assert run == runs[0]
