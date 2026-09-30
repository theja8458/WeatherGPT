import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.stdout.reconfigure(encoding="utf-8")

from fastapi.testclient import TestClient
from app.main import app
from app.services.llm_service import llm_service


def test_normal_llm_request():
    client = TestClient(app)
    llm_service.simulate_llm_failure = False

    resp = client.post(
        "/api/v1/chat",
        json={"session_id": "test-fallback-session-1", "message": "What is the weather in Hyderabad today?"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "answer" in data and len(data["answer"]) > 10
    # Normal response is not blocked and has data cards
    assert data["intent"] in ["current_weather", "forecast", "small_talk"]
    assert len(data.get("data_cards", [])) > 0
    print("[PASS] Normal LLM request succeeds with rich cards.")


def test_simulated_llm_failure_triggers_weather_fallback():
    client = TestClient(app)

    try:
        # Simulate LLM failure (e.g. Google GenAI API down / timeout / quota exceeded)
        llm_service.simulate_llm_failure = True

        resp = client.post(
            "/api/v1/chat",
            json={"session_id": "test-fallback-session-2", "message": "Give me the weather in Kurnool."},
        )
        assert resp.status_code == 200, f"Expected 200 from fallback, got {resp.status_code}"
        data = resp.json()
        answer = data["answer"]

        # 1. DO NOT return blank response
        assert answer and len(answer.strip()) > 20, "Fallback returned empty or too short response"

        # 2. DO NOT expose stack trace, API keys, internal prompts
        assert "traceback" not in answer.lower()
        assert "exception" not in answer.lower()
        assert "api_key" not in answer.lower()
        assert "gemini" not in answer.lower()
        assert "prompt" not in answer.lower()

        # 3. Clearly indicates response is generated from available weather data
        assert "[Automated Weather Data Report - MoES / IMD]" in answer

        # 4. Contains useful weather information
        assert "Current Conditions:" in answer
        assert "°C" in answer
        assert "Rainfall:" in answer
        assert "Wind:" in answer
        assert "Humidity:" in answer
        assert "Forecast:" in answer

        print("[PASS] Fallback correctly delivers all core weather metrics without leaking internals:")
        print(f"       Fallback response sample:\n{answer}")

    finally:
        # Restore normal operation
        llm_service.simulate_llm_failure = False


def test_multilingual_fallback():
    client = TestClient(app)

    try:
        llm_service.simulate_llm_failure = True

        # Telugu fallback
        resp_te = client.post(
            "/api/v1/chat",
            json={"session_id": "test-fallback-session-te", "message": "కర్నూలు వాతావరణం చెప్పండి", "language": "te"},
        )
        assert resp_te.status_code == 200
        ans_te = resp_te.json()["answer"]
        assert "[ప్రత్యక్ష వాతావరణ సమాచార నివేదిక" in ans_te
        assert "ఉష్ణోగ్రత:" in ans_te
        assert "వర్షపాతం:" in ans_te
        print("[PASS] Telugu fallback provides structured meteorological data.")

        # Hindi fallback
        resp_hi = client.post(
            "/api/v1/chat",
            json={"session_id": "test-fallback-session-hi", "message": "दिल्ली का मौसम कैसा है?", "language": "hi"},
        )
        assert resp_hi.status_code == 200
        ans_hi = resp_hi.json()["answer"]
        assert "[प्रत्यक्ष मौसम डेटा रिपोर्ट" in ans_hi
        assert "तापमान:" in ans_hi
        assert "वर्षा:" in ans_hi
        print("[PASS] Hindi fallback provides structured meteorological data.")

    finally:
        llm_service.simulate_llm_failure = False


def test_restoration_to_normal_operation():
    client = TestClient(app)
    llm_service.simulate_llm_failure = False

    resp = client.post(
        "/api/v1/chat",
        json={"session_id": "test-fallback-session-restored", "message": "Will it rain in Chennai tomorrow?"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "answer" in data and len(data["answer"]) > 10
    print("[PASS] Normal chat functionality remains operational after fallback.")


if __name__ == "__main__":
    test_normal_llm_request()
    test_simulated_llm_failure_triggers_weather_fallback()
    test_multilingual_fallback()
    test_restoration_to_normal_operation()
    print("\n[SUCCESS] ALL PROMPT 17C LLM FALLBACK TESTS PASSED!")
