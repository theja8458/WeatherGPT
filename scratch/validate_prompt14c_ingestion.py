import sys
import asyncio
import json
import httpx
import websockets

BACKEND_BASE = "http://127.0.0.1:8000"
WS_URL = "ws://127.0.0.1:8000/ws/alerts"

async def validate_pipeline():
    print("=== PROMPT 14C VALIDATION: REAL-TIME AWS INGESTION ===")
    
    # 1. Test GET /api/v1/nwp/aws/latest
    print("\n1. Testing GET /api/v1/nwp/aws/latest...")
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.get(f"{BACKEND_BASE}/api/v1/nwp/aws/latest")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert data.get("status") == "success", f"Invalid response: {data}"
        stations = data.get("stations", [])
        print(f"   [SUCCESS] Received {len(stations)} AWS stations from latest telemetry cache.")
        for s in stations[:3]:
            print(f"   - {s['station_name']} ({s['district']}, {s['state']}): {s.get('temperature_c')}°C")

    # 2. Connect to WebSocket and listen for live telemetry broadcast
    print("\n2. Connecting to WebSocket broadcast stream (/ws/alerts)...")
    received_aws_event = None

    async def ws_listener():
        nonlocal received_aws_event
        try:
            async with websockets.connect(WS_URL) as ws:
                # First receive connection ack
                init_msg = await ws.recv()
                print(f"   [WebSocket Connected] {init_msg}")

                # Listen for incoming events
                while True:
                    raw = await ws.recv()
                    parsed = json.loads(raw)
                    if parsed.get("type") == "aws_station_update":
                        received_aws_event = parsed
                        print(f"   [WebSocket Event Received] Station: {parsed['data']['station_name']} -> {parsed['data']['temperature_c']}°C")
                        break
        except Exception as e:
            print(f"   [WebSocket Listener Error] {e}")

    # Launch listener in background
    listener_task = asyncio.create_task(ws_listener())
    await asyncio.sleep(1.0)

    # 3. Simulate / Publish AWS Telemetry
    print("\n3. Triggering AWS station observation via POST /api/v1/nwp/aws/publish-mock...")
    test_reading = {
        "station_id": "IMD_AWS_43295_BEGUMPET",
        "station_name": "IMD AWS Hyderabad Begumpet",
        "district": "Hyderabad",
        "state": "Telangana",
        "lat": 17.4531,
        "lon": 78.4676,
        "temperature_c": 34.6,
        "humidity_percent": 58,
        "pressure_hpa": 1012.3,
        "wind_speed_kmh": 16.5,
        "rain_rate_mmh": 2.8,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        pub_res = await client.post(f"{BACKEND_BASE}/api/v1/nwp/aws/publish-mock", json=test_reading)
        assert pub_res.status_code == 200, f"Publish failed: {pub_res.text}"
        pub_data = pub_res.json()
        print(f"   [SUCCESS] Published reading: {pub_data['reading']['station_id']}, Temp={pub_data['reading']['temperature_c']}°C")

    # 4. Wait for WebSocket message to be received
    print("\n4. Awaiting WebSocket delivery...")
    try:
        await asyncio.wait_for(listener_task, timeout=5.0)
        assert received_aws_event is not None, "Did not receive aws_station_update over WebSocket!"
        assert received_aws_event["data"]["temperature_c"] == 34.6, f"Mismatch in received data: {received_aws_event}"
        print("   [SUCCESS] Verified WebSocket received exact updated telemetry data!")
    except asyncio.TimeoutError:
        print("   [ERROR] Timed out waiting for WebSocket telemetry message.")
        sys.exit(1)

    print("\n=== PROMPT 14C END-TO-END PIPELINE VALIDATION PASSED ===")

if __name__ == "__main__":
    asyncio.run(validate_pipeline())
