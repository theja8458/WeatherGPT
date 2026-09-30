import sys
import os
import time
import json
import httpx

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.abspath("backend"))

from app.services.llm_service import llm_service


def validate_prompt17c():
    print("=== PROMPT 17C LLM FAILURE FALLBACK VALIDATION ===")
    base_url = "http://127.0.0.1:8000"
    client = httpx.Client(base_url=base_url, timeout=25.0)

    # 1. Normal LLM Request
    print("\n--- 1. Testing Normal LLM Request ---")
    llm_service.simulate_llm_failure = False
    r_norm = client.post(
        "/api/v1/chat",
        json={"session_id": "val-17c-norm", "message": "What is the weather in Hyderabad today?"},
    )
    assert r_norm.status_code == 200, f"Normal request failed: {r_norm.status_code}"
    norm_data = r_norm.json()
    assert "answer" in norm_data and len(norm_data["answer"]) > 10
    print(f"[PASS] Normal LLM answer generated successfully ({len(norm_data['answer'])} chars)")
    print(f"       Sample snippet: '{norm_data['answer'][:80]}...'")

    # 2. Simulated LLM Failure (Timeout / Quota / Network / Key Unavailable)
    print("\n--- 2. Simulating LLM Failure (Timeout / Unavailable Service) ---")
    try:
        llm_service.simulate_llm_failure = True

        r_fall = client.post(
            "/api/v1/chat",
            json={"session_id": "val-17c-fail", "message": "Give me the weather in Kurnool."},
            headers={"X-Simulate-LLM-Failure": "true"},
        )
        assert r_fall.status_code == 200, f"Expected 200 from fallback handler, got {r_fall.status_code}"
        fall_data = r_fall.json()
        fallback_answer = fall_data["answer"]

        print("\n--- 3. Verifying Structured Fallback Response Content ---")
        print("Fallback Output:")
        print("--------------------------------------------------")
        print(fallback_answer)
        print("--------------------------------------------------")

        # Must not be blank
        assert fallback_answer and len(fallback_answer.strip()) > 30, "Fallback response was blank or too short"
        print("[PASS] Fallback is not blank.")

        # Must clearly indicate it is generated from available weather data
        assert "[Automated Weather Data Report - MoES / IMD]" in fallback_answer
        print("[PASS] Clear telemetry attribution header present.")

        # Answers common weather questions:
        assert "Current Conditions:" in fallback_answer
        assert "°C" in fallback_answer
        assert "Rainfall:" in fallback_answer
        assert "Wind:" in fallback_answer
        assert "Humidity:" in fallback_answer
        assert "Forecast:" in fallback_answer
        print("[PASS] Contains all core metrics: temperature, condition, rainfall, wind, humidity, forecast.")

        # 4. Verify No Sensitive Internal Information is Exposed
        print("\n--- 4. Verifying No Sensitive Information Exposed ---")
        forbidden_terms = [
            "traceback", "exception", "api_key", "secret", "password",
            "mongodb://", "gemini", "model_name", "system_instruction", "internal error"
        ]
        for term in forbidden_terms:
            assert term not in fallback_answer.lower(), f"Sensitive internal term '{term}' exposed in response!"
        print("[PASS] Zero stack traces, credentials, keys, or internal prompts exposed.")

    finally:
        # Restore normal state
        llm_service.simulate_llm_failure = False

    # 5. Verify Existing Chat Functionality Remains Operational
    print("\n--- 5. Verifying Chat Functionality Remains Operational ---")
    r_restored = client.post(
        "/api/v1/chat",
        json={"session_id": "val-17c-restored", "message": "Will it rain tomorrow in Chennai?"},
    )
    assert r_restored.status_code == 200
    restored_data = r_restored.json()
    assert "answer" in restored_data and len(restored_data["answer"]) > 10
    print("[PASS] Normal chat execution verified fully restored.")

    print("\n=======================================================")
    print("[SUCCESS] ALL PROMPT 17C REQUIREMENTS VALIDATED SAFELY!")
    print("=======================================================")

if __name__ == "__main__":
    validate_prompt17c()
