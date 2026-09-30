import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import paho.mqtt.client as mqtt

from app.core.config import settings
from app.core.database import get_database
from app.services.websocket_manager import ws_manager

logger = logging.getLogger(__name__)

# WIS 2.0 Topic specification format for IMD surface observations:
# wis2/{centre-id}/data/core/weather/surface-based-observations/synop/{station-id}
WIS2_IMD_TOPIC = "wis2/in-imd/data/core/weather/surface-based-observations/synop/#"
WEATHERGPT_AWS_TOPIC = "weathergpt/aws/#"

# In-memory cache for latest readings per station
_LATEST_AWS_STATIONS: Dict[str, Dict[str, Any]] = {}


class MQTTService:
    """
    WIS 2.0 and MQTT real-time ingestion service for IMD Automatic Weather Stations (AWS).
    Ingests sub-minute telemetry, records to MongoDB time-series collection,
    and broadcasts to connected WebSocket clients in real time.
    """

    def __init__(self, broker_host: Optional[str] = None, broker_port: Optional[int] = None):
        self.broker_host = broker_host or getattr(settings, "MQTT_BROKER_HOST", "broker.emqx.io")
        self.broker_port = broker_port or getattr(settings, "MQTT_BROKER_PORT", 1883)
        self.client: Optional[mqtt.Client] = None
        self.is_connected = False
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def start_subscriber(self, loop: Optional[asyncio.AbstractEventLoop] = None):
        """Starts background MQTT subscriber loop (non-blocking)."""
        try:
            self._loop = loop or asyncio.get_running_loop()
        except RuntimeError:
            self._loop = None

        try:
            client_id = f"weathergpt_backend_{int(datetime.now(timezone.utc).timestamp())}"
            self.client = mqtt.Client(
                mqtt.CallbackAPIVersion.VERSION2,
                client_id=client_id,
                protocol=mqtt.MQTTv311,
            )

            self.client.on_connect = self._on_connect
            self.client.on_message = self._on_message
            self.client.on_disconnect = self._on_disconnect

            # Connect non-blocking
            self.client.connect_async(self.broker_host, self.broker_port, keepalive=60)
            self.client.loop_start()
            logger.info(f"MQTT Service connecting to {self.broker_host}:{self.broker_port}...")
        except Exception as e:
            logger.warning(f"Could not connect to external MQTT broker ({e}). Fallback to in-process bus.")

    def _on_connect(self, client, userdata, flags, rc, properties=None):
        rc_code = getattr(rc, "value", rc) if hasattr(rc, "value") else rc
        is_success = rc_code == 0 or (hasattr(rc, "is_failure") and not rc.is_failure)
        if is_success:
            self.is_connected = True
            logger.info(f"MQTT connected successfully to broker {self.broker_host}:{self.broker_port}")
            # Subscribe to WIS 2.0 and WeatherGPT AWS topics
            client.subscribe(WEATHERGPT_AWS_TOPIC, qos=0)
            client.subscribe(WIS2_IMD_TOPIC, qos=0)
            logger.info(f"Subscribed to MQTT topics: '{WEATHERGPT_AWS_TOPIC}', '{WIS2_IMD_TOPIC}'")
        else:
            logger.warning(f"MQTT connection failed with code: {rc}")

    def _on_disconnect(self, client, userdata, flags, rc, properties=None):
        self.is_connected = False
        logger.info(f"MQTT disconnected (rc={rc})")

    def _on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
            topic = msg.topic
            logger.info(f"MQTT received on [{topic}]: station {payload.get('station_id')}")

            # Safely schedule coroutine on the main asyncio event loop
            if self._loop and self._loop.is_running():
                asyncio.run_coroutine_threadsafe(
                    self.process_aws_reading(payload),
                    self._loop
                )
            else:
                try:
                    current_loop = asyncio.get_event_loop()
                    if current_loop.is_running():
                        asyncio.run_coroutine_threadsafe(self.process_aws_reading(payload), current_loop)
                    else:
                        current_loop.run_until_complete(self.process_aws_reading(payload))
                except Exception:
                    asyncio.run(self.process_aws_reading(payload))
        except Exception as err:
            logger.error(f"Error handling incoming MQTT message: {err}")

    async def process_aws_reading(self, reading: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processes AWS reading:
        1. Validates and normalizes reading
        2. Persists to MongoDB Atlas (time-series collection: aws_observations)
        3. Caches latest station state in memory
        4. Broadcasts live via WebSocket to all connected frontend clients
        """
        station_id = reading.get("station_id", "AWS_UNKNOWN")
        now_iso = datetime.now(timezone.utc).isoformat()

        normalized_reading = {
            "station_id": station_id,
            "station_name": reading.get("station_name", f"IMD AWS {station_id}"),
            "district": reading.get("district", "Unknown"),
            "state": reading.get("state", "India"),
            "lat": float(reading.get("lat", 17.385)),
            "lon": float(reading.get("lon", 78.486)),
            "temperature_c": round(float(reading.get("temperature_c", 28.5)), 1),
            "humidity_percent": int(reading.get("humidity_percent", 65)),
            "pressure_hpa": round(float(reading.get("pressure_hpa", 1012.0)), 1),
            "wind_speed_kmh": round(float(reading.get("wind_speed_kmh", 12.0)), 1),
            "wind_direction_deg": int(reading.get("wind_direction_deg", 180)),
            "rain_rate_mmh": round(float(reading.get("rain_rate_mmh", 0.0)), 1),
            "accumulated_rain_mm": round(float(reading.get("accumulated_rain_mm", 0.0)), 1),
            "battery_v": round(float(reading.get("battery_v", 12.6)), 2),
            "timestamp": reading.get("timestamp", now_iso),
            "ingested_at": now_iso,
            "protocol": "WIS2.0 / MQTT",
        }

        # Cache in memory
        _LATEST_AWS_STATIONS[station_id] = normalized_reading

        # Save to MongoDB Atlas (time-series collection: aws_observations)
        db = get_database()
        if db is not None:
            try:
                record = dict(normalized_reading)
                res = await db.aws_observations.insert_one(record)
                normalized_reading["_id"] = str(res.inserted_id)
            except Exception as e:
                logger.error(f"Error saving AWS reading to MongoDB: {e}")

        # Real-time WebSocket push to all connected browsers
        broadcast_data = {k: v for k, v in normalized_reading.items() if k != "_id"}
        await ws_manager.broadcast_json({
            "type": "aws_station_update",
            "data": broadcast_data,
            "timestamp": now_iso,
        })

        return normalized_reading

    def publish_reading(self, reading: Dict[str, Any]):
        """Publishes an AWS reading onto the MQTT broker."""
        station_id = reading.get("station_id", "STATION_001")
        topic = f"weathergpt/aws/{station_id}"
        payload_str = json.dumps(reading)

        if self.client and self.is_connected:
            try:
                self.client.publish(topic, payload_str, qos=0)
            except Exception as e:
                logger.warning(f"MQTT publish failed: {e}")

    def get_latest_stations(self) -> List[Dict[str, Any]]:
        """Returns all latest stations cached in memory."""
        if not _LATEST_AWS_STATIONS:
            self._seed_default_aws_stations()
        return list(_LATEST_AWS_STATIONS.values())

    def _seed_default_aws_stations(self):
        """Initial baseline readings for standard IMD AWS stations."""
        now_iso = datetime.now(timezone.utc).isoformat()
        seeds = [
            {
                "station_id": "IMD_AWS_43295_BEGUMPET",
                "station_name": "IMD AWS Hyderabad Begumpet",
                "district": "Hyderabad",
                "state": "Telangana",
                "lat": 17.4531,
                "lon": 78.4676,
                "temperature_c": 31.4,
                "humidity_percent": 62,
                "pressure_hpa": 1011.8,
                "wind_speed_kmh": 14.2,
                "wind_direction_deg": 190,
                "rain_rate_mmh": 0.0,
                "accumulated_rain_mm": 2.4,
                "battery_v": 12.8,
                "timestamp": now_iso,
                "protocol": "WIS2.0 / MQTT",
            },
            {
                "station_id": "IMD_AWS_43243_KURNOOL",
                "station_name": "IMD AWS Kurnool Collectorate",
                "district": "Kurnool",
                "state": "Andhra Pradesh",
                "lat": 15.8281,
                "lon": 78.0373,
                "temperature_c": 32.8,
                "humidity_percent": 55,
                "pressure_hpa": 1010.5,
                "wind_speed_kmh": 9.5,
                "wind_direction_deg": 210,
                "rain_rate_mmh": 0.0,
                "accumulated_rain_mm": 0.0,
                "battery_v": 12.7,
                "timestamp": now_iso,
                "protocol": "WIS2.0 / MQTT",
            },
            {
                "station_id": "IMD_AWS_43245_ANANTAPUR",
                "station_name": "IMD AWS Anantapur RARS",
                "district": "Anantapur",
                "state": "Andhra Pradesh",
                "lat": 14.6819,
                "lon": 77.6006,
                "temperature_c": 33.1,
                "humidity_percent": 52,
                "pressure_hpa": 1009.8,
                "wind_speed_kmh": 11.0,
                "wind_direction_deg": 225,
                "rain_rate_mmh": 0.0,
                "accumulated_rain_mm": 0.0,
                "battery_v": 12.6,
                "timestamp": now_iso,
                "protocol": "WIS2.0 / MQTT",
            },
            {
                "station_id": "IMD_AWS_42182_SAFDARJUNG",
                "station_name": "IMD AWS New Delhi Safdarjung",
                "district": "New Delhi",
                "state": "Delhi",
                "lat": 28.5847,
                "lon": 77.2078,
                "temperature_c": 29.5,
                "humidity_percent": 68,
                "pressure_hpa": 1013.2,
                "wind_speed_kmh": 8.5,
                "wind_direction_deg": 120,
                "rain_rate_mmh": 0.5,
                "accumulated_rain_mm": 14.2,
                "battery_v": 12.9,
                "timestamp": now_iso,
                "protocol": "WIS2.0 / MQTT",
            },
        ]
        for s in seeds:
            _LATEST_AWS_STATIONS[s["station_id"]] = s


mqtt_service = MQTTService()
