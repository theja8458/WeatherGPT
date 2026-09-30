import logging
import math
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from google import genai
from google.genai import types

from app.core.config import settings
from app.services.weather_service import weather_service

logger = logging.getLogger(__name__)

SUPPORTED_CROPS = [
    "cotton",
    "rice",
    "groundnut",
    "chilli",
    "maize",
    "wheat",
    "sugarcane",
    "tomato",
]

ROLE_SECTOR_MAP = {
    "farmer": "agriculture",
    "agriculture": "agriculture",
    "pilot": "aviation",
    "aviator": "aviation",
    "aviation": "aviation",
    "fisherman": "marine",
    "marine": "marine",
    "fisheries": "marine",
    "health": "health",
    "travel": "health",
    "public": "health",
    "urban": "urban",
    "smart_city": "urban",
    "commuter": "urban",
}

# Crop-specific agronomic profiles
CROP_METADATA = {
    "cotton": {
        "name": "Cotton (కపాస్ / పత్తి)",
        "ideal_temp": (21, 35),
        "spray_pests": ["Bollworm (గులాబీ రంగు పురుగు)", "Whitefly (తెల్లదోమ)", "Aphids (పేనుబంక)"],
        "critical_moisture": "Flowering and boll formation stages require moderate moisture; excess water causes boll rotting.",
    },
    "rice": {
        "name": "Rice / Paddy (వరి / धान)",
        "ideal_temp": (20, 36),
        "spray_pests": ["Stem Borer (కాండం తొలుచు పురుగు)", "Blast (అగ్గితెగులు)", "Brown Plant Hopper (సుడిదోమ)"],
        "critical_moisture": "Maintain standing water of 2-5 cm during tillering; drain water 10 days before harvesting.",
    },
    "groundnut": {
        "name": "Groundnut (వేరుశనగ / मूंगफली)",
        "ideal_temp": (22, 33),
        "spray_pests": ["Tikka Leaf Spot (తిక్కా ఆకుమచ్చ తెగులు)", "Spodoptera / Leaf Miner"],
        "critical_moisture": "Critical for peg penetration; avoid water stagnation in root zones.",
    },
    "chilli": {
        "name": "Chilli (మిరప / मिर्च)",
        "ideal_temp": (20, 32),
        "spray_pests": ["Thrips (తామర పురుగులు)", "Dieback / Anthracnose", "Mites (నల్లి)"],
        "critical_moisture": "Sensitive to waterlogging; excessive moisture causes flower and fruit drop.",
    },
    "maize": {
        "name": "Maize / Corn (మొక్కజొన్న / मक्का)",
        "ideal_temp": (18, 32),
        "spray_pests": ["Fall Armyworm (కత్తెర పురుగు)", "Stem Borer"],
        "critical_moisture": "Tasseling and silking stages are critical for yield.",
    },
    "wheat": {
        "name": "Wheat (గోధుమ / गेहूं)",
        "ideal_temp": (15, 26),
        "spray_pests": ["Rust (కుంకుమ తెగులు)", "Aphids"],
        "critical_moisture": "Crown root initiation and grain filling stages.",
    },
    "sugarcane": {
        "name": "Sugarcane (చెరకు / गन्ना)",
        "ideal_temp": (24, 38),
        "spray_pests": ["Early Shoot Borer", "Pyrilla", "Red Rot"],
        "critical_moisture": "High water requirement; ensure proper drainage during heavy showers.",
    },
    "tomato": {
        "name": "Tomato (టమాటా / टमाटर)",
        "ideal_temp": (18, 30),
        "spray_pests": ["Early Blight (ముందస్తు తెగులు)", "Fruit Borer (కాయ తొలుచు పురుగు)", "Leaf Curl Virus"],
        "critical_moisture": "High humidity triggers fungal blights; avoid spraying before wet spells.",
    },
}


class AdvisoryService:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.client = genai.Client(api_key=self.api_key) if self.api_key else None
        self.model_name = settings.GEMINI_MODEL

    async def generate_advisory(
        self,
        lat: float,
        lon: float,
        sector: str = "agriculture",
        crop: Optional[str] = None,
        role: Optional[str] = None,
        lang: str = "en",
        place_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generates sector-specific, dated, and data-backed advisories for Agriculture, Aviation,
        Marine, Health & Travel, or Urban sectors.
        """
        # Resolve sector using role-based default if provided
        if role and role.lower() in ROLE_SECTOR_MAP:
            target_sector = ROLE_SECTOR_MAP[role.lower()]
        else:
            target_sector = ROLE_SECTOR_MAP.get(sector.lower(), "agriculture")

        selected_crop = (crop or "cotton").lower()
        if selected_crop not in SUPPORTED_CROPS:
            selected_crop = "cotton"

        # 1. Fetch live meteorological context
        resolved_name = place_name or f"Coordinates ({lat:.2f}, {lon:.2f})"
        try:
            current_w = await weather_service.get_current(lat, lon, resolved_name)
        except Exception:
            current_w = {}

        try:
            daily_f = await weather_service.get_daily_forecast(lat, lon, days=7, place_name=resolved_name)
            forecast_days = daily_f.get("forecast", [])
        except Exception:
            forecast_days = []

        try:
            hourly_f = await weather_service.get_hourly_forecast(lat, lon, hours=24, place_name=resolved_name)
            hourly_points = hourly_f.get("forecast", [])
        except Exception:
            hourly_points = []

        try:
            air_q = await weather_service.get_air_quality(lat, lon, resolved_name)
        except Exception:
            air_q = {}

        # 2. Build sector-specific analytical assessment
        if target_sector == "agriculture":
            advisory_data = self._analyze_agriculture(
                crop=selected_crop,
                current=current_w,
                forecast_days=forecast_days,
                place_name=resolved_name,
            )
        elif target_sector == "aviation":
            advisory_data = self._analyze_aviation(
                current=current_w,
                hourly_points=hourly_points,
                forecast_days=forecast_days,
                place_name=resolved_name,
            )
        elif target_sector == "marine":
            advisory_data = self._analyze_marine(
                current=current_w,
                forecast_days=forecast_days,
                place_name=resolved_name,
            )
        elif target_sector == "health":
            advisory_data = self._analyze_health(
                current=current_w,
                air_q=air_q,
                forecast_days=forecast_days,
                place_name=resolved_name,
            )
        elif target_sector == "urban":
            advisory_data = self._analyze_urban(
                current=current_w,
                forecast_days=forecast_days,
                hourly_points=hourly_points,
                place_name=resolved_name,
            )
        else:
            advisory_data = self._analyze_agriculture(
                crop=selected_crop,
                current=current_w,
                forecast_days=forecast_days,
                place_name=resolved_name,
            )

        # 3. Generate dated narrative using LLM with deterministic fallback
        llm_narrative = await self._generate_narrative_with_llm(
            advisory_data=advisory_data,
            sector=target_sector,
            crop=selected_crop,
            place_name=resolved_name,
            lang=lang,
        )

        advisory_data["narrative"] = llm_narrative
        advisory_data["language"] = lang
        advisory_data["generated_at"] = datetime.now(timezone.utc).isoformat()
        advisory_data["source"] = "IMD Agro-Meteorological & NWP Guidance Engine"

        return advisory_data

    # --- SECTOR 1: AGRICULTURE ADVISORY ---
    def _analyze_agriculture(
        self,
        crop: str,
        current: Dict[str, Any],
        forecast_days: List[Dict[str, Any]],
        place_name: str,
    ) -> Dict[str, Any]:
        crop_info = CROP_METADATA.get(crop, CROP_METADATA["cotton"])

        # Aggregate 7-day data
        spray_windows = []
        avoid_spray_windows = []
        total_7d_rain = 0.0
        max_temp_week = 0.0

        for day in forecast_days:
            date_str = day.get("date", "")
            try:
                dt = datetime.fromisoformat(date_str)
                day_name = dt.strftime("%A (%d %b)")
            except Exception:
                day_name = date_str

            rain = day.get("precipitation_sum", 0.0) or 0.0
            total_7d_rain += rain
            pop = day.get("precipitation_probability_max", 0) or 0
            t_max = day.get("temp_max", 30.0) or 30.0
            if t_max > max_temp_week:
                max_temp_week = t_max
            wind = day.get("wind_gusts_max", 10.0) or 10.0

            # Spraying suitability rule: Rain < 1.0mm, pop <= 30%, wind <= 18 km/h
            if rain < 1.0 and pop <= 30 and wind <= 18:
                spray_windows.append({
                    "date": date_str,
                    "day": day_name,
                    "rain_mm": rain,
                    "wind_kmh": round(wind, 1),
                    "pop_pct": pop,
                    "status": "Safe for Spraying",
                })
            else:
                avoid_spray_windows.append({
                    "date": date_str,
                    "day": day_name,
                    "rain_mm": rain,
                    "wind_kmh": round(wind, 1),
                    "pop_pct": pop,
                    "reason": f"Expected rain {rain:.1f} mm (Chance: {pop}%) / wind {wind:.1f} km/h causes chemical runoff & drift",
                })

        # Irrigation recommendation
        first_3_days_rain = sum(
            d.get("precipitation_sum", 0.0) or 0.0 for d in forecast_days[:3]
        )
        if first_3_days_rain >= 25.0:
            irrigation_status = "HOLD / POSTPONE"
            irrigation_advice = (
                f"Postpone scheduled irrigation. Significant rainfall of {first_3_days_rain:.1f} mm "
                f"is forecasted over the next 72 hours. Ensure drainage channels are cleared to prevent waterlogging."
            )
        elif first_3_days_rain >= 8.0:
            irrigation_status = "LIGHT ONLY"
            irrigation_advice = (
                f"Moderate showers ({first_3_days_rain:.1f} mm) predicted. Apply only light irrigation if topsoil is dry."
            )
        else:
            irrigation_status = "RECOMMENDED"
            irrigation_advice = (
                f"Dry conditions with only {first_3_days_rain:.1f} mm rainfall expected. Proceed with scheduled "
                f"irrigation during evening hours to minimize evapotranspiration losses."
            )

        # Spraying recommendation summary
        if spray_windows:
            best_days = ", ".join([w["day"] for w in spray_windows[:2]])
            spraying_advice = (
                f"Favorable spraying window on {best_days}. Conditions feature low wind (<15 km/h) "
                f"and negligible rain (<1 mm). "
            )
            if avoid_spray_windows:
                avoid_days = ", ".join([a["day"] for a in avoid_spray_windows[:2]])
                spraying_advice += f"Avoid spraying on {avoid_days} due to wet weather/drift risks."
        else:
            spraying_advice = (
                "Continuous rainfall or elevated wind gusts forecast throughout the week. "
                "Postpone foliar pesticide/fungicide applications until a clear 24h dry spell opens."
            )

        # Sowing & Harvesting
        if total_7d_rain >= 40.0:
            sowing_advice = f"Favorable soil moisture build-up ({total_7d_rain:.1f} mm week sum). Prepare seedbeds for sowing once soil reaches field capacity."
            harvesting_advice = f"Not recommended for harvest due to {total_7d_rain:.1f} mm rain. Delay threshing and keep harvested produce covered."
        else:
            sowing_advice = f"Dry spell prevailing ({total_7d_rain:.1f} mm total rain). Ensure assured irrigation before sowing."
            harvesting_advice = "Dry weather provides optimal window for harvesting, picking, sun-drying, and safe grain storage."

        # Pest Risk
        curr_humidity = current.get("humidity", 65)
        curr_temp = current.get("temperature", 30)
        if curr_humidity >= 75 and 24 <= curr_temp <= 34:
            pest_risk_level = "HIGH"
            pests_str = ", ".join(crop_info["spray_pests"])
            pest_advice = f"High humidity ({curr_humidity}%) and warm temperatures ({curr_temp}°C) create favorable conditions for {pests_str}. Inspect fields and scout undersides of leaves."
        elif curr_humidity >= 60:
            pest_risk_level = "MODERATE"
            pest_advice = f"Moderate pest risk at {curr_humidity}% relative humidity. Regular monitoring advised."
        else:
            pest_risk_level = "LOW"
            pest_advice = f"Dry conditions ({curr_humidity}% humidity) suppress major fungal infections."

        # Heat Stress
        if max_temp_week >= 38.0:
            heat_stress_level = "SEVERE"
            heat_stress_advice = f"Peak temperature reaching {max_temp_week:.1f}°C this week. High risk of moisture stress and flower/fruit dropping in {crop}. Apply mulch or frequent light irrigation."
        elif max_temp_week >= 34.0:
            heat_stress_level = "MODERATE"
            heat_stress_advice = f"Warm temperatures up to {max_temp_week:.1f}°C expected. Monitor crop canopy hydration."
        else:
            heat_stress_level = "NORMAL"
            heat_stress_advice = f"Temperatures remain comfortable (Max: {max_temp_week:.1f}°C), well within {crop} growth range."

        return {
            "sector": "agriculture",
            "crop": crop,
            "crop_display_name": crop_info["name"],
            "location": place_name,
            "metrics": {
                "total_7d_rain_mm": round(total_7d_rain, 1),
                "first_3d_rain_mm": round(first_3_days_rain, 1),
                "max_temp_week_c": round(max_temp_week, 1),
                "current_humidity_pct": curr_humidity,
                "current_temp_c": curr_temp,
            },
            "irrigation": {
                "status": irrigation_status,
                "advice": irrigation_advice,
            },
            "spraying": {
                "advice": spraying_advice,
                "favorable_windows": spray_windows,
                "unfavorable_windows": avoid_spray_windows,
            },
            "sowing": {
                "advice": sowing_advice,
            },
            "harvesting": {
                "advice": harvesting_advice,
            },
            "pest_risk": {
                "level": pest_risk_level,
                "target_pests": crop_info["spray_pests"],
                "advice": pest_advice,
            },
            "heat_stress": {
                "level": heat_stress_level,
                "advice": heat_stress_advice,
            },
        }

    # --- SECTOR 2: AVIATION ADVISORY ---
    def _analyze_aviation(
        self,
        current: Dict[str, Any],
        hourly_points: List[Dict[str, Any]],
        forecast_days: List[Dict[str, Any]],
        place_name: str,
    ) -> Dict[str, Any]:
        temp = current.get("temperature", 28.0) or 28.0
        humidity = current.get("humidity", 60) or 60
        wind_kmh = current.get("wind_speed", 12.0) or 12.0
        wind_dir = current.get("wind_direction", 270) or 270
        pressure = current.get("surface_pressure", 1012.0) or 1012.0
        visibility_m = current.get("visibility", 8000.0) or 8000.0
        cloud_cover = current.get("cloud_cover", 40) or 40
        weather_code = current.get("weather_code", 1) or 1

        # Knots conversion
        wind_kt = round(wind_kmh * 0.539957)

        # Dew point approximation (Magnus-Tetens)
        a = 17.27
        b = 237.7
        alpha = ((a * temp) / (b + temp)) + math.log(max(humidity, 1) / 100.0)
        dew_point = round((b * alpha) / (a - alpha), 1)

        # Cloud base estimate (Henning's formula: base in feet = (T - Td) * 400)
        cloud_base_ft = max(round((temp - dew_point) * 400), 1000)

        # Cloud cover code
        if cloud_cover < 10:
            sky_cond = "SKC"
        elif cloud_cover < 25:
            sky_cond = f"FEW{str(cloud_base_ft // 100).zfill(3)}"
        elif cloud_cover < 50:
            sky_cond = f"SCT{str(cloud_base_ft // 100).zfill(3)}"
        elif cloud_cover < 85:
            sky_cond = f"BKN{str(cloud_base_ft // 100).zfill(3)}"
        else:
            sky_cond = f"OVC{str(cloud_base_ft // 100).zfill(3)}"

        # Turbulence & Thunderstorm risk
        if weather_code in [95, 96, 99]:
            ts_risk = "HIGH / SEVERE"
            ts_note = "Active CB / TS in vicinity. Moderate to severe low-level wind shear and convective turbulence expected."
            metar_wx = "TSRA"
        elif wind_kt >= 25:
            ts_risk = "MODERATE"
            ts_note = "Elevated wind gradient producing mechanical turbulence below 3000 ft AGL."
            metar_wx = "BLDU" if humidity < 30 else "RA"
        elif weather_code in [45, 48]:
            ts_risk = "LOW"
            ts_note = "Turbulence minimal; primary hazard is restricted RVR/visibility due to fog."
            metar_wx = "FG"
        else:
            ts_risk = "LOW / NIL"
            ts_note = "Smooth flight conditions expected with minimal convective activity."
            metar_wx = "NOSIG"

        now_utc = datetime.now(timezone.utc)
        day_str = now_utc.strftime("%d%H%M") + "Z"
        dir_str = str(wind_dir).zfill(3)
        kt_str = str(wind_kt).zfill(2) + "KT"
        vis_str = str(min(int(visibility_m), 9999)).zfill(4)
        t_str = f"{round(temp):02d}/{round(dew_point):02d}"
        qnh_str = f"Q{round(pressure)}"

        metar_code = f"METAR VOXX {day_str} {dir_str}{kt_str} {vis_str} {sky_cond} {t_str} {qnh_str} {metar_wx}"

        return {
            "sector": "aviation",
            "location": place_name,
            "metar": metar_code,
            "metrics": {
                "wind_direction_deg": wind_dir,
                "wind_speed_kt": wind_kt,
                "wind_speed_kmh": round(wind_kmh, 1),
                "visibility_meters": round(visibility_m),
                "temperature_c": round(temp, 1),
                "dew_point_c": dew_point,
                "cloud_base_feet": cloud_base_ft,
                "cloud_cover_pct": cloud_cover,
                "qnh_hpa": round(pressure),
            },
            "flight_rules": "VFR" if visibility_m >= 5000 and cloud_base_ft >= 3000 else "IFR",
            "thunderstorm_turbulence_risk": {
                "level": ts_risk,
                "briefing": ts_note,
            },
        }

    # --- SECTOR 3: MARINE & FISHERMEN ADVISORY ---
    def _analyze_marine(
        self,
        current: Dict[str, Any],
        forecast_days: List[Dict[str, Any]],
        place_name: str,
    ) -> Dict[str, Any]:
        wind_kmh = current.get("wind_speed", 15.0) or 15.0
        weather_code = current.get("weather_code", 1) or 1

        # Check peak wind gust in next 3 days
        max_gust = wind_kmh
        for d in forecast_days[:3]:
            g = d.get("wind_gusts_max", 0.0) or 0.0
            if g > max_gust:
                max_gust = g

        # Empirical wave height proxy: Hs = 0.025 * V^1.4
        wave_height_m = round(0.025 * (max_gust ** 1.4), 1)
        wave_height_m = max(0.5, min(wave_height_m, 8.0))

        # Go / No-Go guidance
        if max_gust >= 45.0 or wave_height_m >= 2.5 or weather_code in [95, 96, 99]:
            status = "NO-GO (WARNING)"
            badge_color = "red"
            advice = (
                f"DANGEROUS SEA CONDITIONS. Squally winds reaching {max_gust:.1f} km/h with estimated sea waves "
                f"of {wave_height_m} meters. Fishermen are strictly advised NOT to venture into deep sea or open waters. "
                f"Boats docked at coast should be securely moored."
            )
        elif max_gust >= 30.0 or wave_height_m >= 1.5:
            status = "CAUTION (YELLOW)"
            badge_color = "yellow"
            advice = (
                f"MODERATE TO ROUGH SEA. Wind gusts up to {max_gust:.1f} km/h and wave heights around {wave_height_m} m. "
                f"Small craft and country boats should exercise extreme caution and remain within 5 nautical miles of coast."
            )
        else:
            status = "GO (SAFE - GREEN)"
            badge_color = "green"
            advice = (
                f"FAVORABLE SEA STATE. Gentle breezes of {wind_kmh:.1f} km/h (Gusts: {max_gust:.1f} km/h), wave heights "
                f"under {wave_height_m} m. Safe for regular coastal fishing and maritime operations."
            )

        return {
            "sector": "marine",
            "location": place_name,
            "status": status,
            "badge_color": badge_color,
            "metrics": {
                "current_wind_kmh": round(wind_kmh, 1),
                "peak_gust_3d_kmh": round(max_gust, 1),
                "wave_height_proxy_m": wave_height_m,
                "sea_state": "Smooth" if wave_height_m < 1.25 else ("Slight to Moderate" if wave_height_m < 2.5 else "Rough to Very Rough"),
            },
            "advisory_bulletin": advice,
        }

    # --- SECTOR 4: HEALTH & TRAVEL ADVISORY ---
    def _analyze_health(
        self,
        current: Dict[str, Any],
        air_q: Dict[str, Any],
        forecast_days: List[Dict[str, Any]],
        place_name: str,
    ) -> Dict[str, Any]:
        temp = current.get("temperature", 31.0) or 31.0
        rh = current.get("humidity", 60) or 60
        uv = current.get("uv_index", 6.0) or 6.0

        # Steadman's Heat Index (apparent temperature)
        hi = current.get("feels_like", temp)
        if hi is None or hi == 0:
            hi = round(temp + 0.33 * (rh / 100.0 * 6.105 * math.exp(17.27 * temp / (237.7 + temp))) - 4.0, 1)

        aqi = air_q.get("aqi", 75)
        aqi_cat = air_q.get("category", "Moderate")

        if hi >= 42.0:
            heat_risk = "DANGER"
            hydration_rec = "Drink at least 3.5 - 4.0 liters of fluids with ORS or lemon water. Avoid outdoor activity between 11 AM - 4 PM."
        elif hi >= 35.0:
            heat_risk = "CAUTION"
            hydration_rec = "Drink 2.5 - 3.0 liters of water daily. Carry umbrella/sunscreen when stepping out."
        else:
            heat_risk = "COMFORTABLE"
            hydration_rec = "Standard hydration (2.0 liters/day). Favorable conditions for travel."

        travel_note = f"Overall travel comfort index is {heat_risk}. UV Index: {uv:.1f} (Wear sunglasses & UV hat). AQI: {aqi} ({aqi_cat})."

        return {
            "sector": "health",
            "location": place_name,
            "metrics": {
                "temperature_c": round(temp, 1),
                "heat_index_c": round(hi, 1),
                "humidity_pct": rh,
                "uv_index": round(uv, 1),
                "aqi": aqi,
                "aqi_category": aqi_cat,
            },
            "heat_risk": heat_risk,
            "hydration_tips": hydration_rec,
            "travel_guidance": travel_note,
        }

    # --- SECTOR 5: URBAN & SMART CITY ADVISORY ---
    def _analyze_urban(
        self,
        current: Dict[str, Any],
        forecast_days: List[Dict[str, Any]],
        hourly_points: List[Dict[str, Any]],
        place_name: str,
    ) -> Dict[str, Any]:
        today_f = forecast_days[0] if forecast_days else {}
        today_rain = today_f.get("precipitation_sum", 0.0) or 0.0
        pop = today_f.get("precipitation_probability_max", 0) or 0

        # Peak hourly rain rate in next 24h
        peak_hourly = 0.0
        for p in hourly_points:
            r = p.get("precipitation", 0.0) or 0.0
            if r > peak_hourly:
                peak_hourly = r

        if today_rain >= 64.5 or peak_hourly >= 20.0:
            waterlog_risk = "SEVERE"
            traffic_impact = (
                f"Severe waterlogging risk! Predicted daily rain: {today_rain:.1f} mm with peak hourly intensity "
                f"up to {peak_hourly:.1f} mm/h. Subways, low-lying underpasses, and arterial ring roads expected "
                f"to face inundation. Commuters advised to delay non-essential transit."
            )
        elif today_rain >= 25.0 or peak_hourly >= 10.0:
            waterlog_risk = "MODERATE"
            traffic_impact = (
                f"Moderate waterlogging likely at known drainage bottlenecks ({today_rain:.1f} mm rain, max {peak_hourly:.1f} mm/h). "
                f"Anticipate 15-30 min traffic delays during peak commute hours."
            )
        else:
            waterlog_risk = "LOW / MINIMAL"
            traffic_impact = (
                f"Minimal waterlogging risk (Predicted rain: {today_rain:.1f} mm). Urban transit networks and roads "
                f"are operating normally."
            )

        return {
            "sector": "urban",
            "location": place_name,
            "metrics": {
                "expected_24h_rain_mm": round(today_rain, 1),
                "peak_hourly_rate_mm_h": round(peak_hourly, 1),
                "rain_probability_pct": pop,
            },
            "waterlogging_risk": waterlog_risk,
            "traffic_impact": traffic_impact,
        }

    # --- LLM SYNTHESIS & MULTILINGUAL GROUNDING ---
    async def _generate_narrative_with_llm(
        self,
        advisory_data: Dict[str, Any],
        sector: str,
        crop: str,
        place_name: str,
        lang: str,
    ) -> str:
        """
        Uses Gemini to synthesize an authoritative, dated, and data-backed bulletin,
        falling back deterministically if offline or rate-limited.
        """
        metrics = advisory_data.get("metrics", {})

        prompt = f"""You are the India Meteorological Department (IMD) Senior Agro-Meteorological and Multi-Sectoral Advisor.
Generate an authoritative, dated, and strictly data-backed advisory bulletin for {place_name}.

Sector: {sector.upper()}
Target Subject: {crop.capitalize() if sector == 'agriculture' else sector.capitalize()}
Underlying Meteorological Numbers:
{metrics}

Full Analytical Rules:
{advisory_data}

Rules:
1. Language: Answer in {lang} (if 'te' write Telugu, if 'hi' write Hindi, if 'ta' write Tamil, if 'en' write English).
2. Always cite specific dates and numbers (exact rainfall in mm, temperatures in °C, wind speeds in km/h, and humidity in %).
3. Provide actionable guidance (e.g. for agriculture, explicitly state whether to spray or avoid spraying, citing the dry/rainy days; for aviation cite METAR; for marine cite Go/No-Go and wave height).
4. Keep the bulletin concise, professional, and easily readable with bullet points.
"""

        if self.client:
            try:
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.2,
                        max_output_tokens=300,
                        http_options=types.HttpOptions(timeout=10000),
                    ),
                )
                if response and response.text:
                    return response.text.strip()
            except Exception as e:
                logger.warning(f"Gemini API advisory generation fallback: {e}")

        # Deterministic grounded fallback in target language
        return self._build_deterministic_bulletin(advisory_data, sector, crop, place_name, lang)

    def _build_deterministic_bulletin(
        self,
        advisory_data: Dict[str, Any],
        sector: str,
        crop: str,
        place_name: str,
        lang: str,
    ) -> str:
        m = advisory_data.get("metrics", {})
        now = datetime.now()
        date_str = now.strftime("%d %B %Y")

        if sector == "agriculture":
            spraying = advisory_data.get("spraying", {})
            irrigation = advisory_data.get("irrigation", {})
            pest = advisory_data.get("pest_risk", {})
            total_rain = m.get("total_7d_rain_mm", 0.0)
            max_t = m.get("max_temp_week_c", 32.0)
            rh = m.get("current_humidity_pct", 65)

            if lang == "te":
                return (
                    f"🌾 **IMD వ్యవసాయ వాతావరణ సలహా ({place_name}) — {date_str}**\n\n"
                    f"• **పంట:** {crop.capitalize()} (పత్తి)\n"
                    f"• **వాతావరణ గణాంకాలు:** 7 రోజుల వర్షపాతం: {total_rain} mm | గరిష్ట ఉష్ణోగ్రత: {max_t}°C | తేమ: {rh}%\n"
                    f"• **పిచికారీ (Spraying):** {spraying.get('advice', '')}\n"
                    f"• **నీటిపారుదల (Irrigation):** {irrigation.get('advice', '')}\n"
                    f"• **తెగుళ్ల హెచ్చరిక (Pest Risk):** {pest.get('advice', '')}"
                )
            elif lang == "hi":
                return (
                    f"🌾 **आईएमडी कृषि मौसम सलाह ({place_name}) — {date_str}**\n\n"
                    f"• **फसल:** {crop.capitalize()}\n"
                    f"• **मौसम आंकड़े:** 7 दिनों की कुल वर्षा: {total_rain} मिमी | अधिकतम तापमान: {max_t}°C | आर्द्रता: {rh}%\n"
                    f"• **छिड़काव (Spraying):** {spraying.get('advice', '')}\n"
                    f"• **सिंचाई (Irrigation):** {irrigation.get('advice', '')}\n"
                    f"• **कीट प्रकोप (Pest Risk):** {pest.get('advice', '')}"
                )
            else:
                return (
                    f"🌾 **IMD Agro-Meteorological Advisory for {place_name} ({date_str})**\n\n"
                    f"• **Crop Target:** {crop.capitalize()}\n"
                    f"• **Observed & Forecast Metrics:** 7-day cumulative rainfall: {total_rain} mm | Peak Max Temp: {max_t}°C | Relative Humidity: {rh}%\n"
                    f"• **Spraying Advisory:** {spraying.get('advice', '')}\n"
                    f"• **Irrigation Guidance:** {irrigation.get('advice', '')}\n"
                    f"• **Pest & Disease Outlook:** {pest.get('advice', '')}"
                )

        elif sector == "aviation":
            metar = advisory_data.get("metar", "")
            fr = advisory_data.get("flight_rules", "VFR")
            wind_kt = m.get("wind_speed_kt", 8)
            vis = m.get("visibility_meters", 8000)
            return (
                f"✈️ **Aviation Meteorological Briefing for {place_name}**\n\n"
                f"• **Flight Rules:** {fr}\n"
                f"• **METAR:** `{metar}`\n"
                f"• **Surface Wind:** {m.get('wind_direction_deg', 270)}° at {wind_kt} KT (Visibility: {vis} m)\n"
                f"• **Convective Hazard:** {advisory_data.get('thunderstorm_turbulence_risk', {}).get('briefing', '')}"
            )

        elif sector == "marine":
            status = advisory_data.get("status", "GO")
            wave_h = m.get("wave_height_proxy_m", 1.0)
            wind_k = m.get("current_wind_kmh", 15.0)
            gust = m.get("peak_gust_3d_kmh", 20.0)
            return (
                f"⚓ **IMD Fishermen & Coastal Marine Advisory for {place_name}**\n\n"
                f"• **Operational Status:** **{status}**\n"
                f"• **Sea State:** Wave height ~{wave_h} m | Wind: {wind_k} km/h (Peak Gust: {gust} km/h)\n"
                f"• **Guidance:** {advisory_data.get('advisory_bulletin', '')}"
            )

        elif sector == "health":
            hi = m.get("heat_index_c", 30.0)
            aqi = m.get("aqi", 70)
            return (
                f"🏥 **Public Health & Travel Advisory ({place_name})**\n\n"
                f"• **Heat Index:** {hi}°C ({advisory_data.get('heat_risk', 'Normal')})\n"
                f"• **Air Quality:** AQI {aqi} ({m.get('aqi_category', 'Moderate')})\n"
                f"• **Hydration Advice:** {advisory_data.get('hydration_tips', '')}\n"
                f"• **Travel Note:** {advisory_data.get('travel_guidance', '')}"
            )

        else:  # urban
            risk = advisory_data.get("waterlogging_risk", "LOW")
            rain24 = m.get("expected_24h_rain_mm", 0.0)
            return (
                f"🏙️ **Smart City & Urban Flood Advisory ({place_name})**\n\n"
                f"• **Waterlogging Risk Level:** **{risk}**\n"
                f"• **Rainfall Inundation Potential:** {rain24} mm in 24 hours\n"
                f"• **Traffic Impact & Transit Advisory:** {advisory_data.get('traffic_impact', '')}"
            )


advisory_service = AdvisoryService()
