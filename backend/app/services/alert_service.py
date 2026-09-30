import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from bson import ObjectId

from app.core.database import get_database
from app.models.alert import AlertModel, AlertSeverity, AlertType, GeoGeometry
from app.services.repository import AlertRepository
from app.services.websocket_manager import ws_manager
from app.services.weather_service import weather_service

logger = logging.getLogger(__name__)


# IMD Safety action tips mapped by alert type and severity
SAFETY_TIPS = {
    "heavy_rain": {
        "red": "IMD Red Warning: Take immediate action. Avoid waterlogged areas and underpasses. Evacuate low-lying riverbeds. Keep emergency phone charged.",
        "orange": "IMD Orange Alert: Be prepared. Expect localized flooding, traffic disruptions, and power outages. Avoid non-essential outdoor travel.",
        "yellow": "IMD Yellow Watch: Be updated. Moderate to heavy showers likely. Carry umbrella and watch for slick road conditions.",
    },
    "heatwave": {
        "red": "IMD Red Warning: Severe heatwave. Extreme risk of heat stroke. Avoid outdoor exposure between 11 AM - 4 PM. Drink ORS, coconut water, and water frequently.",
        "orange": "IMD Orange Alert: High temperature with significant heat stress. Wear loose cotton clothes and cover head when outdoors.",
        "yellow": "IMD Yellow Watch: Heat illness symptoms possible in vulnerable groups (infants, elderly). Stay hydrated.",
    },
    "thunderstorm": {
        "orange": "IMD Orange Alert: Severe thunderstorm with lightning. Do NOT take shelter under isolated trees. Unplug sensitive electrical appliances.",
        "yellow": "IMD Yellow Watch: Thunder and lightning activity expected. Seek sturdy indoor shelter when thunder roars.",
    },
    "strong_wind": {
        "orange": "IMD Orange Alert: Strong squall / wind gusts. Secure loose rooftop objects, tin sheets, and beware of falling tree branches.",
        "yellow": "IMD Yellow Watch: Gusty winds expected. Drive carefully on bridges and open highways.",
    },
    "cold_wave": {
        "red": "IMD Red Warning: Severe cold wave conditions. Extreme risk of hypothermia. Cover completely with layers and protect livestock and infants.",
        "orange": "IMD Orange Alert: Significant cold wave. Keep warm indoor heating safe from carbon monoxide and wear thermal wear.",
        "yellow": "IMD Yellow Watch: Dropping temperatures. Vulnerable groups should avoid early morning exposure.",
    },
    "fog": {
        "orange": "IMD Orange Alert: Dense fog causing visibility below 200m. Drive slowly with low-beam fog lights, maintain safe distance on highways.",
        "yellow": "IMD Yellow Watch: Shallow to moderate fog. Drive with caution during early morning and late night.",
    },
    "general": {
        "red": "IMD Red Alert: Take action immediately and follow local disaster management authorities.",
        "orange": "IMD Orange Alert: Be prepared for adverse weather changes.",
        "yellow": "IMD Yellow Watch: Stay tuned to local weather advisories.",
    },
}


class AlertService:
    @staticmethod
    def get_safety_tip(alert_type: str, severity: str) -> str:
        type_tips = SAFETY_TIPS.get(alert_type, SAFETY_TIPS["general"])
        return type_tips.get(severity, SAFETY_TIPS["general"].get(severity, "Stay alert and follow official IMD advisories."))

    async def evaluate_location_forecast(
        self,
        lat: float,
        lon: float,
        place_name: str,
        custom_rain_threshold: Optional[float] = None,
    ) -> List[AlertModel]:
        """
        Evaluates live meteorological forecast data against official IMD thresholds.
        Optionally accepts custom_rain_threshold to test artificially lowered thresholds.
        """
        generated_alerts: List[AlertModel] = []

        try:
            # 1. Fetch current weather and 7-day daily forecast
            current_w = await weather_service.get_current(lat, lon, place_name)
            daily_f = await weather_service.get_daily_forecast(lat, lon, days=3, place_name=place_name)

            today_forecast = daily_f["forecast"][0] if daily_f and "forecast" in daily_f and len(daily_f["forecast"]) > 0 else {}
            now = datetime.now(timezone.utc)
            valid_until = now + timedelta(hours=24)

            precip_sum = today_forecast.get("precipitation_sum", 0.0) or 0.0
            precip_prob = today_forecast.get("precipitation_probability_max", 0) or 0
            temp_max = today_forecast.get("temp_max", current_w.get("temperature", 30)) or 30
            temp_min = today_forecast.get("temp_min", current_w.get("temperature", 20)) or 20
            wind_gusts = today_forecast.get("wind_gusts_max", current_w.get("wind_speed", 10)) or 10
            weather_code = current_w.get("weather_code", 0)
            visibility = current_w.get("visibility", 10000) or 10000

            # Test Hook: Artificially lowered threshold support
            effective_red_rain = custom_rain_threshold if custom_rain_threshold is not None else 204.4
            effective_orange_rain = (custom_rain_threshold * 0.6) if custom_rain_threshold is not None else 115.6
            effective_yellow_rain = (custom_rain_threshold * 0.3) if custom_rain_threshold is not None else 64.5

            # A. HEAVY RAINFALL CHECKS (IMD categories: >64.5 yellow, >115.6 orange, >204.4 red)
            if precip_sum >= effective_red_rain:
                alert = AlertModel(
                    type=AlertType.HEAVY_RAIN,
                    severity=AlertSeverity.RED,
                    region=place_name,
                    geometry=GeoGeometry(type="Point", coordinates=[lon, lat]),
                    lat=lat,
                    lon=lon,
                    title=f"IMD Red Warning: Extremely Heavy Rainfall in {place_name}",
                    description=f"Predicted 24h rainfall: {precip_sum:.1f} mm. High risk of inundation and flash flooding. {self.get_safety_tip('heavy_rain', 'red')}",
                    source="IMD / MoES Rule-Based Engine",
                    valid_from=now,
                    valid_to=valid_until,
                )
                generated_alerts.append(alert)
            elif precip_sum >= effective_orange_rain:
                alert = AlertModel(
                    type=AlertType.HEAVY_RAIN,
                    severity=AlertSeverity.ORANGE,
                    region=place_name,
                    geometry=GeoGeometry(type="Point", coordinates=[lon, lat]),
                    lat=lat,
                    lon=lon,
                    title=f"IMD Orange Alert: Heavy to Very Heavy Rainfall in {place_name}",
                    description=f"Predicted 24h rainfall: {precip_sum:.1f} mm (Chance: {precip_prob}%). {self.get_safety_tip('heavy_rain', 'orange')}",
                    source="IMD / MoES Rule-Based Engine",
                    valid_from=now,
                    valid_to=valid_until,
                )
                generated_alerts.append(alert)
            elif precip_sum >= effective_yellow_rain:
                alert = AlertModel(
                    type=AlertType.HEAVY_RAIN,
                    severity=AlertSeverity.YELLOW,
                    region=place_name,
                    geometry=GeoGeometry(type="Point", coordinates=[lon, lat]),
                    lat=lat,
                    lon=lon,
                    title=f"IMD Yellow Watch: Heavy Rainfall Expected in {place_name}",
                    description=f"Isolated spells of heavy rain ({precip_sum:.1f} mm). {self.get_safety_tip('heavy_rain', 'yellow')}",
                    source="IMD / MoES Rule-Based Engine",
                    valid_from=now,
                    valid_to=valid_until,
                )
                generated_alerts.append(alert)

            # B. HEATWAVE CHECKS (>= 40°C threshold and departures)
            if temp_max >= 45.0:
                alert = AlertModel(
                    type=AlertType.HEATWAVE,
                    severity=AlertSeverity.RED,
                    region=place_name,
                    geometry=GeoGeometry(type="Point", coordinates=[lon, lat]),
                    lat=lat,
                    lon=lon,
                    title=f"IMD Red Warning: Severe Heatwave in {place_name}",
                    description=f"Dangerous maximum temperature reaching {temp_max:.1f}°C. {self.get_safety_tip('heatwave', 'red')}",
                    source="IMD / MoES Rule-Based Engine",
                    valid_from=now,
                    valid_to=valid_until,
                )
                generated_alerts.append(alert)
            elif temp_max >= 42.0:
                alert = AlertModel(
                    type=AlertType.HEATWAVE,
                    severity=AlertSeverity.ORANGE,
                    region=place_name,
                    geometry=GeoGeometry(type="Point", coordinates=[lon, lat]),
                    lat=lat,
                    lon=lon,
                    title=f"IMD Orange Alert: Heatwave Conditions in {place_name}",
                    description=f"Maximum temperature expected to touch {temp_max:.1f}°C. {self.get_safety_tip('heatwave', 'orange')}",
                    source="IMD / MoES Rule-Based Engine",
                    valid_from=now,
                    valid_to=valid_until,
                )
                generated_alerts.append(alert)
            elif temp_max >= 40.0:
                alert = AlertModel(
                    type=AlertType.HEATWAVE,
                    severity=AlertSeverity.YELLOW,
                    region=place_name,
                    geometry=GeoGeometry(type="Point", coordinates=[lon, lat]),
                    lat=lat,
                    lon=lon,
                    title=f"IMD Yellow Watch: High Heat in {place_name}",
                    description=f"Maximum temperature reaching {temp_max:.1f}°C. {self.get_safety_tip('heatwave', 'yellow')}",
                    source="IMD / MoES Rule-Based Engine",
                    valid_from=now,
                    valid_to=valid_until,
                )
                generated_alerts.append(alert)

            # C. THUNDERSTORM & LIGHTNING CHECKS
            if weather_code in [95, 96, 99]:
                severity = AlertSeverity.ORANGE if weather_code in [96, 99] else AlertSeverity.YELLOW
                alert = AlertModel(
                    type=AlertType.THUNDERSTORM,
                    severity=severity,
                    region=place_name,
                    geometry=GeoGeometry(type="Point", coordinates=[lon, lat]),
                    lat=lat,
                    lon=lon,
                    title=f"IMD {severity.value.upper()} Alert: Thunderstorm & Lightning in {place_name}",
                    description=f"Convective activity and lightning strikes detected. {self.get_safety_tip('thunderstorm', severity.value)}",
                    source="IMD / MoES Rule-Based Engine",
                    valid_from=now,
                    valid_to=valid_until,
                )
                generated_alerts.append(alert)

            # D. STRONG WIND GUSTS (> 50 km/h)
            if wind_gusts >= 70.0:
                alert = AlertModel(
                    type=AlertType.STRONG_WIND,
                    severity=AlertSeverity.ORANGE,
                    region=place_name,
                    geometry=GeoGeometry(type="Point", coordinates=[lon, lat]),
                    lat=lat,
                    lon=lon,
                    title=f"IMD Orange Alert: Severe Wind Gusts in {place_name}",
                    description=f"Peak wind gusts up to {wind_gusts:.1f} km/h expected. {self.get_safety_tip('strong_wind', 'orange')}",
                    source="IMD / MoES Rule-Based Engine",
                    valid_from=now,
                    valid_to=valid_until,
                )
                generated_alerts.append(alert)
            elif wind_gusts >= 50.0:
                alert = AlertModel(
                    type=AlertType.STRONG_WIND,
                    severity=AlertSeverity.YELLOW,
                    region=place_name,
                    geometry=GeoGeometry(type="Point", coordinates=[lon, lat]),
                    lat=lat,
                    lon=lon,
                    title=f"IMD Yellow Watch: Squally Winds in {place_name}",
                    description=f"Strong wind gusts exceeding {wind_gusts:.1f} km/h likely. {self.get_safety_tip('strong_wind', 'yellow')}",
                    source="IMD / MoES Rule-Based Engine",
                    valid_from=now,
                    valid_to=valid_until,
                )
                generated_alerts.append(alert)

            # E. COLD WAVE CHECKS
            if temp_min <= 4.0:
                alert = AlertModel(
                    type=AlertType.COLD_WAVE,
                    severity=AlertSeverity.RED,
                    region=place_name,
                    geometry=GeoGeometry(type="Point", coordinates=[lon, lat]),
                    lat=lat,
                    lon=lon,
                    title=f"IMD Red Warning: Severe Cold Wave in {place_name}",
                    description=f"Minimum temperature plunging to {temp_min:.1f}°C. {self.get_safety_tip('cold_wave', 'red')}",
                    source="IMD / MoES Rule-Based Engine",
                    valid_from=now,
                    valid_to=valid_until,
                )
                generated_alerts.append(alert)
            elif temp_min <= 7.0:
                alert = AlertModel(
                    type=AlertType.COLD_WAVE,
                    severity=AlertSeverity.ORANGE,
                    region=place_name,
                    geometry=GeoGeometry(type="Point", coordinates=[lon, lat]),
                    lat=lat,
                    lon=lon,
                    title=f"IMD Orange Alert: Cold Wave Conditions in {place_name}",
                    description=f"Minimum temperature down to {temp_min:.1f}°C. {self.get_safety_tip('cold_wave', 'orange')}",
                    source="IMD / MoES Rule-Based Engine",
                    valid_from=now,
                    valid_to=valid_until,
                )
                generated_alerts.append(alert)

            # F. LOW VISIBILITY / FOG CHECKS
            if weather_code == 48 or (visibility > 0 and visibility <= 200):
                alert = AlertModel(
                    type=AlertType.FOG,
                    severity=AlertSeverity.ORANGE,
                    region=place_name,
                    geometry=GeoGeometry(type="Point", coordinates=[lon, lat]),
                    lat=lat,
                    lon=lon,
                    title=f"IMD Orange Alert: Dense Fog in {place_name}",
                    description=f"Surface visibility reduced to {int(visibility)}m. {self.get_safety_tip('fog', 'orange')}",
                    source="IMD / MoES Rule-Based Engine",
                    valid_from=now,
                    valid_to=valid_until,
                )
                generated_alerts.append(alert)
            elif weather_code == 45 or (visibility > 200 and visibility <= 500):
                alert = AlertModel(
                    type=AlertType.FOG,
                    severity=AlertSeverity.YELLOW,
                    region=place_name,
                    geometry=GeoGeometry(type="Point", coordinates=[lon, lat]),
                    lat=lat,
                    lon=lon,
                    title=f"IMD Yellow Watch: Low Visibility Fog in {place_name}",
                    description=f"Surface visibility restricted to approximately {int(visibility)}m. {self.get_safety_tip('fog', 'yellow')}",
                    source="IMD / MoES Rule-Based Engine",
                    valid_from=now,
                    valid_to=valid_until,
                )
                generated_alerts.append(alert)

            # Process and broadcast generated alerts
            for alert in generated_alerts:
                await self.save_and_broadcast_if_new(alert)

        except Exception as e:
            logger.error(f"Error evaluating alerts for {place_name}: {e}")

        return generated_alerts

    async def fetch_imd_cap_feeds(self) -> List[Dict[str, Any]]:
        """
        Attempts to fetch public CAP / RSS warnings from IMD / NDMA feeds where accessible.
        Gracefully falls back to local rule-based warning engine if remote feeds are unreachable.
        """
        import httpx
        feed_url = "https://sachet.ndma.gov.in/cap_public_website/rss/all_india.xml"
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(feed_url)
                if res.status_code == 200:
                    logger.info("Successfully fetched public IMD/CAP feed.")
                    return [{"source": "CAP-RSS", "status": "active"}]
        except Exception as e:
            logger.debug(f"IMD CAP public feed not reachable directly ({e}), using rule-based alerts.")
        return []

    async def save_and_broadcast_if_new(self, alert: AlertModel) -> Optional[str]:
        """Deduplicates against active alerts in DB, saves, and broadcasts via WebSocket."""
        db = get_database()
        now = datetime.now(timezone.utc)

        # Deduplication check: same region + type active right now
        if db is not None:
            existing = await db.alerts.find_one({
                "region": alert.region,
                "type": alert.type.value,
                "valid_to": {"$gte": now},
            })
            if existing:
                logger.debug(f"Alert already active for {alert.region} ({alert.type.value}), skipping duplicate.")
                return str(existing["_id"])

        # Save to DB
        alert_id = await AlertRepository.create_alert(alert)
        alert_dict = alert.model_dump(by_alias=True)
        alert_dict["_id"] = alert_id
        alert_dict["id"] = alert_id

        # Real-time WebSocket push
        await ws_manager.broadcast_alert(alert_dict)
        logger.info(f"New alert created and broadcast: {alert.title} (ID: {alert_id})")
        return alert_id

    async def simulate_alert(
        self,
        region: str = "Hyderabad",
        alert_type: AlertType = AlertType.HEAVY_RAIN,
        severity: AlertSeverity = AlertSeverity.ORANGE,
        lat: float = 17.3850,
        lon: float = 78.4867,
        custom_title: Optional[str] = None,
        custom_description: Optional[str] = None,
    ) -> AlertModel:
        """
        Simulates an alert with an artificially lowered threshold or custom trigger
        and pushes it directly over WebSocket for demonstration/testing.
        """
        now = datetime.now(timezone.utc)
        valid_until = now + timedelta(hours=12)

        title = custom_title or f"IMD {severity.value.upper()} Warning: {alert_type.value.replace('_', ' ').title()} in {region}"
        description = custom_description or (
            f"Simulated {severity.value.upper()} weather warning for {region}. "
            f"{self.get_safety_tip(alert_type.value, severity.value)}"
        )

        alert = AlertModel(
            type=alert_type,
            severity=severity,
            region=region,
            geometry=GeoGeometry(type="Point", coordinates=[lon, lat]),
            lat=lat,
            lon=lon,
            title=title,
            description=description,
            source="IMD Simulated Early Warning",
            valid_from=now,
            valid_to=valid_until,
        )

        alert_id = await AlertRepository.create_alert(alert)
        alert_dict = alert.model_dump(by_alias=True)
        alert_dict["_id"] = alert_id
        alert_dict["id"] = alert_id

        # Real-time WebSocket push!
        await ws_manager.broadcast_alert(alert_dict)
        alert.id = alert_id
        return alert


alert_service = AlertService()
