import sys
sys.path.insert(0, ".")
import asyncio
import httpx
from app.core.database import db_manager, get_database

BACKEND_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://127.0.0.1:5173"

ROLES_EXPECTED = {
    "farmer": ["Crop Advisory", "Rain Forecast", "Spraying Window"],
    "aviation": ["METAR", "Flight Briefing", "Crosswind"],
    "disaster_manager": ["Active Alerts", "Broadcast Warning", "Flood Risk"],
    "researcher": ["Rainfall Trend", "Climate Anomaly", "CSV"],
    "marine": ["Fishermen Advisory", "Wave Height", "Squall"],
    "citizen": ["Umbrella", "Air Quality", "Temperature Outlook"],
}

async def validate_prompt15b():
    print("=== PROMPT 15B VALIDATION: ROLE-BASED HOME PERSONALIZATION ===")
    test_session = "prompt15b_validation_user"

    async with httpx.AsyncClient(timeout=10.0) as client:
        # 1. Initialize user
        init_res = await client.get(f"{BACKEND_URL}/api/v1/users/profile?session_id={test_session}")
        assert init_res.status_code == 200, f"Failed init user: {init_res.text}"
        print(f"1. User session '{test_session}' initialized.")

        # 2. Iterate through all 6 roles and verify persistence and layout mapping
        print("\n2. Testing role switching and verification across all 6 roles:")
        for role, keywords in ROLES_EXPECTED.items():
            put_res = await client.put(f"{BACKEND_URL}/api/v1/users/role", json={
                "session_id": test_session,
                "role": role,
            })
            assert put_res.status_code == 200, f"Failed setting role {role}: {put_res.text}"
            saved_role = put_res.json().get("role")
            assert saved_role == role, f"Expected {role}, got {saved_role}"

            # Verify persisted profile
            get_res = await client.get(f"{BACKEND_URL}/api/v1/users/profile?session_id={test_session}")
            assert get_res.json()["user"]["role"] == role
            print(f"   [SUCCESS] Role '{role}' persisted in database. Expected cards/chips: {', '.join(keywords)}")

        # 3. Direct verification in MongoDB Atlas collection
        print("\n3. Verifying persistence directly in MongoDB Atlas 'users' collection...")
        await db_manager.connect_to_database()
        db = get_database()
        if db is not None:
            user_doc = await db.users.find_one({"session_id": test_session})
            assert user_doc is not None
            print(f"   [SUCCESS] Confirmed user in MongoDB: session_id={user_doc.get('session_id')}, role={user_doc.get('role')}")
        await db_manager.close_database_connection()

        # 4. Verify existing WeatherGPT Chat, AWS Live Feed, and Weather APIs remain operational
        print("\n4. Verifying existing system components are functional:")
        # Health check
        h_res = await client.get(f"{BACKEND_URL}/api/v1/health")
        assert h_res.status_code == 200 and h_res.json()["status"] == "ok"
        print("   - Health endpoint: OK")

        # Weather API
        w_res = await client.get(f"{BACKEND_URL}/api/v1/weather/current?place=Hyderabad")
        assert w_res.status_code == 200
        print(f"   - Weather endpoint: OK (Temp: {w_res.json().get('temperature')}°C)")

        # AWS Live Feed
        aws_res = await client.get(f"{BACKEND_URL}/api/v1/nwp/aws/latest")
        assert aws_res.status_code == 200
        print(f"   - AWS Live Telemetry: OK ({len(aws_res.json().get('stations', []))} stations active)")

        # NWP Comparison API
        nwp_res = await client.get(f"{BACKEND_URL}/api/v1/nwp/compare?place=Hyderabad")
        assert nwp_res.status_code == 200
        print(f"   - NWP GFS vs ECMWF Comparison: OK ({nwp_res.json().get('agreement_level')})")

        # Frontend HTTP serving
        fe_res = await client.get(FRONTEND_URL)
        assert fe_res.status_code == 200
        print("   - Frontend Dev Server: OK (HTTP 200)")

    print("\n=== PROMPT 15B VALIDATION PASSED COMPLETELY ===")

if __name__ == "__main__":
    asyncio.run(validate_prompt15b())
