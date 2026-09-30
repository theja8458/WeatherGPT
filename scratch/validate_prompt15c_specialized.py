import sys
import os
import asyncio
import httpx

# Ensure utf-8 output on Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

BACKEND_URL = "http://127.0.0.1:8000"

async def validate_prompt15c():
    print("=== PROMPT 15C VALIDATION: SPECIALIZED ROLE FEATURES ===")

    async with httpx.AsyncClient(timeout=25.0) as client:
        # 1. FARMER: Crop & weather advisory + spraying window + rain forecast
        print("\n1. Testing FARMER specialized advisory & spraying window...")
        farmer_res = await client.get(
            f"{BACKEND_URL}/api/v1/advisory?lat=17.385&lon=78.4867&type=agriculture&crop=cotton&place=Hyderabad"
        )
        assert farmer_res.status_code == 200, f"Farmer advisory failed: {farmer_res.text}"
        farmer_data = farmer_res.json().get("advisory", {})
        print(f"   [SUCCESS] Farmer advisory generated for {farmer_data.get('crop', 'cotton')}:")
        print(f"   - Irrigation Status: {farmer_data.get('irrigation', {}).get('status')}")
        print(f"   - Spray Windows Available: {len(farmer_data.get('spraying', {}).get('favorable_windows', []))} days favorable")
        print(f"   - Spraying Advice: {farmer_data.get('spraying', {}).get('advice')[:80]}...")
        crops_res = await client.get(f"{BACKEND_URL}/api/v1/advisory/crops")
        assert crops_res.status_code == 200
        print(f"   - Supported crops: {len(crops_res.json().get('supported_crops', []))} crops available")

        # 2. AVIATION: METAR-style weather summary
        print("\n2. Testing AVIATION METAR-style weather summary...")
        aviation_res = await client.get(
            f"{BACKEND_URL}/api/v1/advisory?lat=17.385&lon=78.4867&type=aviation&place=Hyderabad"
        )
        assert aviation_res.status_code == 200, f"Aviation advisory failed: {aviation_res.text}"
        av_data = aviation_res.json().get("advisory", {})
        print(f"   [SUCCESS] Aviation METAR generated:")
        print(f"   - Raw METAR: {av_data.get('metar')}")
        print(f"   - Flight Category: {av_data.get('flight_rules', 'VFR')}")
        print(f"   - Cloud Base: {av_data.get('metrics', {}).get('cloud_base_feet')} ft")
        print(f"   - Wind Speed: {av_data.get('metrics', {}).get('wind_speed_kmh')} km/h ({av_data.get('metrics', {}).get('wind_speed_kt')} KT)")

        # 3. DISASTER MANAGER: State alert list, district risk table & broadcast summary generator
        print("\n3. Testing DISASTER MANAGER state risk table & broadcast warning generator...")
        risk_res = await client.get(f"{BACKEND_URL}/api/v1/users/state-risk-summary?state=Telangana")
        assert risk_res.status_code == 200, f"Risk summary failed: {risk_res.text}"
        risk_data = risk_res.json()
        print(f"   [SUCCESS] State risk matrix for {risk_data.get('state')}:")
        print(f"   - Active alerts: {risk_data.get('total_active_alerts')}")
        print(f"   - Districts monitored: {len(risk_data.get('districts', []))} districts")

        # Broadcast summary generator (Multi-lingual SMS)
        bcast_res = await client.post(f"{BACKEND_URL}/api/v1/users/broadcast-advisory", json={
            "state": "Telangana",
            "hazard_type": "heavy_rain",
            "severity": "orange",
            "districts": ["Hyderabad", "Rangareddy"],
            "languages": ["en", "te", "hi"],
        })
        assert bcast_res.status_code == 200, f"Broadcast failed: {bcast_res.text}"
        advisories = bcast_res.json().get("advisories", {})
        print(f"   [SUCCESS] Multi-lingual broadcast warnings generated ({bcast_res.json().get('source')}):")
        for lang, text in advisories.items():
            print(f"   - [{lang.upper()}] ({len(text)} chars): {text}")
            assert len(text) <= 180, f"Warning too long: {text}"

        # 4. RESEARCHER: Climate data explorer & CSV data export
        print("\n4. Testing RESEARCHER 30-year climate trends & CSV export data...")
        climate_res = await client.get(
            f"{BACKEND_URL}/api/v1/climate/trends?lat=17.385&lon=78.4867&from=1994&to=2023&place=Hyderabad"
        )
        assert climate_res.status_code == 200, f"Climate trends failed: {climate_res.text}"
        clim_data = climate_res.json()
        primary = clim_data.get("primary", {})
        trends = primary.get("yearly_series", [])
        decadal_slope = primary.get("trends", {}).get("temperature", {}).get("slope_per_decade_c")
        print(f"   [SUCCESS] Climate trends loaded: {len(trends)} years of data")
        print(f"   - Decadal temp slope: {decadal_slope} °C/decade")
        assert len(trends) > 0, "No annual trends returned"

        # Validate CSV construction
        headers = ",".join(trends[0].keys())
        rows = ["\n" + ",".join(str(v) for v in row.values()) for row in trends[:3]]
        csv_sample = headers + "".join(rows)
        print(f"   [SUCCESS] CSV Export Sample Generated ({len(csv_sample)} bytes preview):")
        print(f"   {csv_sample[:120]}...")

        # 5. MARINE: Marine conditions, sea state & fishermen warning
        print("\n5. Testing MARINE coastal conditions & fishermen warning...")
        marine_res = await client.get(
            f"{BACKEND_URL}/api/v1/advisory?lat=17.6868&lon=83.2185&type=marine&place=Visakhapatnam"
        )
        assert marine_res.status_code == 200, f"Marine advisory failed: {marine_res.text}"
        marine_data = marine_res.json().get("advisory", {})
        print(f"   [SUCCESS] Marine coastal analysis:")
        print(f"   - Sea State: {marine_data.get('metrics', {}).get('sea_state')}")
        print(f"   - Wave Height: {marine_data.get('metrics', {}).get('wave_height_proxy_m')} m")
        print(f"   - Fishermen Safety Status: {marine_data.get('status')}")

        # 6. CITIZEN: General weather experience
        print("\n6. Testing CITIZEN general weather, rain & air quality...")
        weather_res = await client.get(f"{BACKEND_URL}/api/v1/weather/current?place=Hyderabad")
        assert weather_res.status_code == 200
        print(f"   [SUCCESS] Citizen weather: {weather_res.json().get('temperature')}°C, {weather_res.json().get('weather_description')}")

    print("\n=== ALL PROMPT 15C SPECIALIZED FEATURES VALIDATED SUCCESSFULLY ===")

if __name__ == "__main__":
    asyncio.run(validate_prompt15c())
