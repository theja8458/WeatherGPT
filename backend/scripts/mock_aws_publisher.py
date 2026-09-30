"""
Mock IMD Automatic Weather Station (AWS) Publisher (WIS 2.0 / MQTT Simulator).
Emulates real-time telemetry from 5 Indian Automatic Weather Stations:
1. IMD AWS Hyderabad Begumpet (Telangana)
2. IMD AWS Kurnool Collectorate (Andhra Pradesh)
3. IMD AWS Anantapur RARS (Andhra Pradesh)
4. IMD AWS Visakhapatnam Port (Andhra Pradesh)
5. IMD AWS New Delhi Safdarjung (Delhi)

Mirrors WMO WIS 2.0 publish/subscribe architecture:
Mock AWS Station -> MQTT Broker -> Backend MQTT Subscriber -> MongoDB -> WebSocket -> UI
"""

import sys
import time
import json
import random
from datetime import datetime, timezone
import httpx
import paho.mqtt.client as mqtt

sys.stdout.reconfigure(encoding="utf-8")

MQTT_BROKER_HOST = "broker.emqx.io"
MQTT_BROKER_PORT = 1883
BACKEND_HTTP_FALLBACK_URL = "http://127.0.0.1:8000/api/v1/nwp/aws/publish-mock"

AWS_STATIONS = [
    {
        "station_id": "IMD_AWS_43295_BEGUMPET",
        "station_name": "IMD AWS Hyderabad Begumpet",
        "district": "Hyderabad",
        "state": "Telangana",
        "lat": 17.4531,
        "lon": 78.4676,
        "base_temp": 31.5,
        "base_humidity": 62,
        "base_wind": 13.5,
    },
    {
        "station_id": "IMD_AWS_43243_KURNOOL",
        "station_name": "IMD AWS Kurnool Collectorate",
        "district": "Kurnool",
        "state": "Andhra Pradesh",
        "lat": 15.8281,
        "lon": 78.0373,
        "base_temp": 33.2,
        "base_humidity": 54,
        "base_wind": 10.2,
    },
    {
        "station_id": "IMD_AWS_43245_ANANTAPUR",
        "station_name": "IMD AWS Anantapur RARS",
        "district": "Anantapur",
        "state": "Andhra Pradesh",
        "lat": 14.6819,
        "lon": 77.6006,
        "base_temp": 32.8,
        "base_humidity": 51,
        "base_wind": 11.8,
    },
    {
        "station_id": "IMD_AWS_43149_VIZAG",
        "station_name": "IMD AWS Visakhapatnam Port",
        "district": "Visakhapatnam",
        "state": "Andhra Pradesh",
        "lat": 17.6868,
        "lon": 83.2185,
        "base_temp": 30.2,
        "base_humidity": 78,
        "base_wind": 16.5,
    },
    {
        "station_id": "IMD_AWS_42182_SAFDARJUNG",
        "station_name": "IMD AWS New Delhi Safdarjung",
        "district": "New Delhi",
        "state": "Delhi",
        "lat": 28.5847,
        "lon": 77.2078,
        "base_temp": 29.8,
        "base_humidity": 65,
        "base_wind": 9.2,
    },
]


def generate_station_reading(station: dict) -> dict:
    temp_noise = random.uniform(-0.8, 1.2)
    hum_noise = random.uniform(-4, 5)
    wind_noise = random.uniform(-2, 3)
    rain_rate = round(random.uniform(0.0, 4.5), 1) if random.random() < 0.25 else 0.0

    return {
        "station_id": station["station_id"],
        "station_name": station["station_name"],
        "district": station["district"],
        "state": station["state"],
        "lat": station["lat"],
        "lon": station["lon"],
        "temperature_c": round(station["base_temp"] + temp_noise, 1),
        "humidity_percent": max(30, min(95, int(station["base_humidity"] + hum_noise))),
        "pressure_hpa": round(1011.5 + random.uniform(-0.6, 0.6), 1),
        "wind_speed_kmh": max(2.0, round(station["base_wind"] + wind_noise, 1)),
        "wind_direction_deg": int(random.choice([160, 180, 200, 220, 240])),
        "rain_rate_mmh": rain_rate,
        "accumulated_rain_mm": round(rain_rate * 2.0, 1),
        "battery_v": round(12.7 + random.uniform(-0.2, 0.3), 2),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "protocol": "WIS2.0 / MQTT",
    }


def publish_telemetry(iterations: int = 1, delay_sec: float = 2.0, use_mqtt: bool = True):
    print(f"🛰️  Starting WIS 2.0 / MQTT Mock AWS Telemetry Publisher ({iterations} iterations)...")
    
    mqtt_client = None
    mqtt_connected = False
    
    if use_mqtt:
        try:
            client_id = f"weathergpt_mock_pub_{int(time.time())}"
            mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id)
            mqtt_client.connect(MQTT_BROKER_HOST, MQTT_BROKER_PORT, keepalive=30)
            mqtt_client.loop_start()
            time.sleep(1.0)  # Brief wait for connect handshake
            mqtt_connected = True
            print(f"🌐 Connected to MQTT Broker: {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}")
        except Exception as err:
            print(f"⚠️  MQTT broker direct connection failed ({err}). Falling back to HTTP backend relay.")
            mqtt_connected = False

    http_client = httpx.Client(timeout=10.0)

    try:
        for it in range(iterations):
            print(f"\n--- Batch {it + 1} of {iterations} ---")
            for station in AWS_STATIONS:
                reading = generate_station_reading(station)
                payload_str = json.dumps(reading)
                
                # 1. Publish directly over MQTT if connected
                published_mqtt = False
                if mqtt_connected and mqtt_client:
                    try:
                        topic = f"weathergpt/aws/{reading['station_id']}"
                        mqtt_client.publish(topic, payload_str, qos=0)
                        published_mqtt = True
                    except Exception as mq_err:
                        print(f"⚠️  MQTT publish error: {mq_err}")
                
                # 2. Also relay to HTTP backend endpoint to guarantee delivery & trigger WebSocket
                try:
                    res = http_client.post(BACKEND_HTTP_FALLBACK_URL, json=reading)
                    status_text = "HTTP 200 & WebSocket broadcast" if res.status_code == 200 else f"HTTP {res.status_code}"
                except Exception as http_err:
                    status_text = f"HTTP failed ({http_err})"

                transport = "MQTT & Backend HTTP" if published_mqtt else "Backend HTTP"
                print(
                    f"📡 [{transport}] {reading['station_name']} -> "
                    f"{reading['temperature_c']}°C, Humidity: {reading['humidity_percent']}%, "
                    f"Wind: {reading['wind_speed_kmh']} km/h, Rain: {reading['rain_rate_mmh']} mm/h "
                    f"({status_text})"
                )

            if it < iterations - 1:
                time.sleep(delay_sec)
    finally:
        http_client.close()
        if mqtt_client:
            mqtt_client.loop_stop()
            mqtt_client.disconnect()

    print("\n✅ WIS 2.0 / MQTT AWS Telemetry transmission successfully completed.")


if __name__ == "__main__":
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    interval = float(sys.argv[2]) if len(sys.argv) > 2 else 2.0
    publish_telemetry(iterations=count, delay_sec=interval)
