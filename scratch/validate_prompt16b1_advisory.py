import sys
import io
import asyncio
import httpx

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

BACKEND_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://127.0.0.1:5173"

async def validate_prompt16b1():
    print("=== PROMPT 16B-1 VALIDATION: OFFICER PUBLIC ADVISORY ONLY ===")

    async with httpx.AsyncClient(timeout=25.0) as client:
        # 1. Verify frontend /officer route is active
        print("\n1. Verifying /officer page accessibility...")
        fe_res = await client.get(f"{FRONTEND_URL}/officer")
        assert fe_res.status_code == 200
        print(f"   [SUCCESS] /officer accessible (HTTP {fe_res.status_code})")

        # 2. Test CYCLONE DEMO Warning Scenario (Red Severity)
        print("\n2. Testing CYCLONE DEMO Warning Scenario (English, Telugu, Hindi)...")
        cyclone_payload = {
            "state": "Andhra Pradesh",
            "hazard_type": "cyclone",
            "severity": "red",
            "districts": ["Visakhapatnam"],
            "instructions": "Super cyclonic storm approaching coast. Squally winds exceeding 120 km/h. Evacuate low-lying coastal zones immediately.",
            "languages": ["en", "te", "hi"],
        }

        cyc_res = await client.post(f"{BACKEND_URL}/api/v1/users/broadcast-advisory", json=cyclone_payload)
        assert cyc_res.status_code == 200, f"Cyclone advisory failed: {cyc_res.text}"
        cyc_data = cyc_res.json()

        advisories = cyc_data.get("advisories", {})
        char_counts = cyc_data.get("char_counts", {})
        disclaimer = cyc_data.get("disclaimer", "")

        print(f"   [SUCCESS] Cyclone Advisory generated (Source: {cyc_data.get('source')}):")
        print(f"   - Disclaimer: '{disclaimer}'")
        assert "officer review" in disclaimer.lower() or "ai-generated" in disclaimer.lower(), "Missing officer review disclaimer"

        # Validate each language
        for lang in ["en", "te", "hi"]:
            assert lang in advisories, f"Missing language {lang} in cyclone advisories"
            text = advisories[lang]
            c_len = len(text)
            print(f"   - [{lang.upper()}] ({c_len}/160 chars): {text}")
            assert c_len <= 160, f"Language {lang} exceeded 160 characters: {c_len} chars ('{text}')"
            assert len(text.strip()) > 10, f"Language {lang} text too short"

        # 3. Test HEAVY RAIN Scenario for another state (Telangana)
        print("\n3. Testing HEAVY RAINFALL Scenario for Telangana (Hyderabad)...")
        rain_payload = {
            "state": "Telangana",
            "hazard_type": "heavy_rain",
            "severity": "orange",
            "districts": ["Hyderabad", "Rangareddy"],
            "instructions": "Severe waterlogging in low-lying corridors. Avoid underpasses.",
            "languages": ["en", "te", "hi"],
        }

        rain_res = await client.post(f"{BACKEND_URL}/api/v1/users/broadcast-advisory", json=rain_payload)
        assert rain_res.status_code == 200
        rain_data = rain_res.json()
        rain_advisories = rain_data.get("advisories", {})

        print(f"   [SUCCESS] Heavy Rain Advisory generated (Source: {rain_data.get('source')}):")
        for lang in ["en", "te", "hi"]:
            text = rain_advisories[lang]
            c_len = len(text)
            print(f"   - [{lang.upper()}] ({c_len}/160 chars): {text}")
            assert c_len <= 160, f"Rain advisory in {lang} exceeded 160 chars"

        # 4. Verify existing state risk summary works uninterrupted
        print("\n4. Verifying existing Officer Dashboard risk matrix...")
        summary_res = await client.get(f"{BACKEND_URL}/api/v1/users/state-risk-summary?state=Telangana")
        assert summary_res.status_code == 200
        summary_data = summary_res.json()
        print(f"   [SUCCESS] State risk matrix active: {len(summary_data.get('districts', []))} districts, {summary_data.get('total_active_alerts')} active alerts")

    print("\n=== ALL PROMPT 16B-1 REQUIREMENTS VALIDATED SUCCESSFULLY ===")

if __name__ == "__main__":
    asyncio.run(validate_prompt16b1())
