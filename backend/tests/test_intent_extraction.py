"""
tests/test_intent_extraction.py

Unit tests for natural language intent and entity extraction (Prompt 18A):
- current weather
- forecast (today, tomorrow, 7-day)
- rainfall inquiries
- temperature inquiries
- severe weather alerts
- air quality / AQI
- historical climate trends
- multilingual script detection (English, Telugu, Hindi)
"""

import pytest
from app.services.llm_service import llm_service, detect_language


def test_current_weather_intent():
    """Tests current weather inquiries resolve to 'current_weather'."""
    queries = [
        "What is the weather in Hyderabad right now?",
        "How is the weather currently?",
        "Give me today's weather condition",
    ]
    for q in queries:
        intent, entities = llm_service._extract_intent_and_entities_heuristic(q)
        assert intent in ["current_weather", "forecast"], f"Failed on query: '{q}'"
        assert entities.get("day_offset") == 0


def test_forecast_intent_and_day_offset():
    """Tests forecast and future day offsets (tomorrow, day after tomorrow, week)."""
    # Tomorrow -> offset 1
    intent, entities = llm_service._extract_intent_and_entities_heuristic("Will it rain tomorrow in Kurnool?")
    assert intent == "forecast"
    assert entities.get("day_offset") == 1

    # Day after tomorrow -> offset 2
    intent, entities = llm_service._extract_intent_and_entities_heuristic("What is the forecast for day after tomorrow?")
    assert intent == "forecast"
    assert entities.get("day_offset") == 2

    # 7-day forecast
    intent, entities = llm_service._extract_intent_and_entities_heuristic("Show me the next 7 days forecast for Visakhapatnam")
    assert intent == "forecast"


def test_rainfall_inquiries():
    """Tests rainfall queries extract weather/forecast intent and recognize rain tokens."""
    queries = [
        "Will it rain today?",
        "Is there any rainfall expected in Hyderabad?",
        "repu vaana padutunda?",
        "kal baarish hogi kya?",
    ]
    for q in queries:
        intent, entities = llm_service._extract_intent_and_entities_heuristic(q)
        assert intent in ["current_weather", "forecast"]


def test_temperature_inquiries():
    """Tests temperature queries extract weather/forecast intent."""
    queries = [
        "What is the current temperature in Delhi?",
        "How hot is it right now?",
        "Current temp in Kurnool",
    ]
    for q in queries:
        intent, entities = llm_service._extract_intent_and_entities_heuristic(q)
        assert intent in ["current_weather", "forecast"]


def test_alert_check_intent():
    """Tests disaster/alert keywords resolve to 'alert_check'."""
    queries = [
        "Are there any active cyclone warnings or flood alerts?",
        "Is there any heatwave threat or danger today?",
        "Check warning alerts for Andhra Pradesh",
    ]
    for q in queries:
        intent, _ = llm_service._extract_intent_and_entities_heuristic(q)
        assert intent == "alert_check", f"Failed to detect alert intent for: '{q}'"


def test_air_quality_intent():
    """Tests air pollution and AQI queries resolve to 'air_quality'."""
    queries = [
        "What is the AQI in Delhi today?",
        "Check air quality and pm2.5 pollution levels",
        "How bad is the smog in Hyderabad?",
    ]
    for q in queries:
        intent, _ = llm_service._extract_intent_and_entities_heuristic(q)
        assert intent == "air_quality", f"Failed to detect AQI intent for: '{q}'"


def test_climate_trends_intent():
    """Tests historical climate trend queries extract years and 'climate_trends' intent."""
    intent, entities = llm_service._extract_intent_and_entities_heuristic(
        "How have climate trends changed over the past 30 years in Hyderabad?"
    )
    assert intent == "climate_trends"
    assert entities.get("years") == 30

    intent2, entities2 = llm_service._extract_intent_and_entities_heuristic(
        "What is the historical decadal warming trend over the past 20 years?"
    )
    assert intent2 == "climate_trends"
    assert entities2.get("years") == 20


def test_multilingual_language_detection():
    """Tests script and keyword language detector for English, Telugu, and Hindi."""
    # English
    assert detect_language("What is the current weather?") == "en"

    # Telugu script
    assert detect_language("హైదరాబాద్‌లో వాతావరణం ఎలా ఉంది?") == "te"
    # Telugu transliteration
    assert detect_language("repu vaana padutunda?") == "te"

    # Hindi script
    assert detect_language("आज दिल्ली में मौसम कैसा है?") == "hi"
    # Hindi transliteration
    assert detect_language("aaj barish hogi kya?") == "hi"
