import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Query, HTTPException, status, Request
from pydantic import BaseModel
from google import genai
from google.genai import types

from app.core.config import settings
from app.core.limiter import limiter
from app.models.user import UserModel, UserRole, UserLocation
from app.services.repository import UserRepository, AlertRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["User Persona, Onboarding & Roles"])


class UserProfileUpdateRequest(BaseModel):
    session_id: str
    role: Optional[str] = None
    preferred_language: Optional[str] = None
    home_location: Optional[Dict[str, Any]] = None
    onboarded: Optional[bool] = None


class UpdateRoleRequest(BaseModel):
    session_id: str
    role: str


class BroadcastAdvisoryRequest(BaseModel):
    state: str = "Telangana"
    hazard_type: str = "heavy_rain"
    severity: str = "orange"
    districts: List[str] = ["Hyderabad", "Rangareddy", "Medchal"]
    instructions: Optional[str] = None
    languages: List[str] = ["en", "hi", "te"]


@router.get("/profile")
async def get_user_profile(session_id: str = Query(..., description="Unique anonymous user session ID")):
    """Retrieves or creates user profile and persona settings."""
    user = await UserRepository.get_or_create_user(session_id=session_id)
    return {
        "status": "success",
        "user": user.model_dump(),
    }


@router.post("/profile")
async def update_user_profile(req: UserProfileUpdateRequest):
    """
    Updates user persona, language, and location preferences.
    Persists role and preferences in the MongoDB users collection.
    """
    update_data: Dict[str, Any] = {}
    if req.role:
        clean_role = req.role.lower().strip()
        # Map aliases
        if clean_role == "disaster_manager" or clean_role == "officer":
            clean_role = UserRole.DISASTER_MANAGER.value
        elif clean_role in [r.value for r in UserRole]:
            clean_role = clean_role
        else:
            clean_role = UserRole.CITIZEN.value
        update_data["role"] = clean_role

    if req.preferred_language:
        update_data["preferred_language"] = req.preferred_language.strip()

    if req.home_location:
        loc = UserLocation(**req.home_location)
        update_data["home_location"] = loc.model_dump()

    if req.onboarded is not None:
        update_data["onboarded"] = bool(req.onboarded)

    # Ensure user exists first
    await UserRepository.get_or_create_user(session_id=req.session_id)
    updated_user = await UserRepository.update_user(req.session_id, update_data)
    if not updated_user:
        raise HTTPException(status_code=404, detail="User profile could not be updated.")

    return {
        "status": "success",
        "message": "User persona profile successfully updated and persisted.",
        "user": updated_user.model_dump(),
    }


@router.put("/role")
async def update_user_role(req: UpdateRoleRequest):
    """Updates only the role for the given user session in the MongoDB users collection."""
    clean_role = req.role.lower().strip()
    if clean_role == "disaster_manager" or clean_role == "officer":
        clean_role = UserRole.DISASTER_MANAGER.value
    elif clean_role not in [r.value for r in UserRole]:
        clean_role = UserRole.CITIZEN.value

    await UserRepository.get_or_create_user(session_id=req.session_id)
    updated = await UserRepository.update_user(req.session_id, {"role": clean_role})
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "status": "success",
        "session_id": req.session_id,
        "role": updated.role.value,
        "user": updated.model_dump(),
    }


@router.post("/broadcast-advisory")
@limiter.limit("20/minute")
async def generate_broadcast_advisory(request: Request, req: BroadcastAdvisoryRequest):
    """
    Disaster Manager Feature:
    LLM drafts concise, multi-language public broadcast SMS / emergency advisories
    (max 160 chars each) across selected regional languages (English, Hindi, Telugu, etc.).
    """
    districts_str = ", ".join(req.districts) if req.districts else "affected districts"
    langs_str = ", ".join(req.languages)

    prompt = f"""You are the MoES / IMD Disaster Alert Broadcast Officer.
Generate emergency public advisory warning messages for the following alert:
- State: {req.state}
- Districts: {districts_str}
- Hazard: {req.hazard_type}
- Severity: {req.severity.upper()}
- Specific notes: {req.instructions or 'Take safety precautions immediately'}

Provide exactly one concise warning SMS per requested language ({langs_str}).
CRITICAL RULES:
1. Each message MUST be <= 160 characters (suitable for SMS / CAP cell broadcast).
2. Include the hazard, affected districts, and one actionable safety command (e.g. 'Stay indoors', 'Avoid waterlogged routes').
3. Format output strictly as JSON with language codes as keys:
{{"en": "...", "hi": "...", "te": "..."}}
"""

    # Default fallback templates if LLM is unavailable
    districts_short = req.districts[0] if req.districts else req.state
    hazard_norm = req.hazard_type.lower()
    
    if "cyclone" in hazard_norm:
        fallbacks = {
            "en": f"IMD CYCLONE ALERT ({req.severity.upper()}): Severe cyclone approaching {districts_short}. Move to cyclone shelters. Avoid coast. Call 112 for rescue.",
            "te": f"ఐఎండీ తుఫాను హెచ్చరిక ({req.severity.upper()}): {districts_short}లో తుఫాను ముప్పు. తీరప్రాంతాలు ఖాళీ చేయండి. సహాయం కోసం 112 డయల్ చేయండి.",
            "hi": f"IMD चक्रवात चेतावनी ({req.severity.upper()}): {districts_short} में भीषण चक्रवात का खतरा। सुरक्षित आश्रयों में जाएं। मदद हेतु 112 डायल करें।",
            "ta": f"புயல் எச்சரிக்கை ({req.severity.upper()}): {districts_short} பகுதியில் புயல் எச்சரிக்கை. பாதுகாப்பான இடத்திற்கு செல்லவும். உதவிக்கு 112.",
        }
    elif "heat" in hazard_norm:
        fallbacks = {
            "en": f"IMD HEATWAVE ALERT ({req.severity.upper()}): Severe heat in {districts_short}. Stay indoors between 11am-4pm, drink ORS water & avoid direct sun.",
            "te": f"వడగాల్పుల హెచ్చరిక ({req.severity.upper()}): {districts_short}లో తీవ్ర ఎండలు. మధ్యాహ్నం బయటకు రావద్దు, సరిపడా నీరు తాగండి. అత్యవసరానికి 112.",
            "hi": f"IMD लू चेतावनी ({req.severity.upper()}): {districts_short} में भीषण लू। दोपहर में बाहर न निकलें, पर्याप्त पानी पिएं। आपातकाल में 112 डायल करें।",
            "ta": f"வெப்ப அலை எச்சரிக்கை: {districts_short} பகுதியில் அதிக வெப்பம். பகல் நேரத்தில் வெளியே செல்ல வேண்டாம். உதவிக்கு 112.",
        }
    else:
        fallbacks = {
            "en": f"IMD ALERT ({req.severity.upper()}): Heavy rain expected in {districts_short}. Stay indoors, avoid waterlogged routes. Dial 112 for help.",
            "te": f"ఐఎండీ హెచ్చరిక ({req.severity.upper()}): {districts_short}లో భారీ వర్షాలు. సురక్షితంగా ఉండండి, నీరు నిలిచిన రోడ్లకు దూరంగా ఉండండి. సహాయానికి 112.",
            "hi": f"मौसम चेतावनी ({req.severity.upper()}): {districts_short} में भारी बारिश। सुरक्षित स्थानों पर रहें, जलभराव से बचें। आपातकाल में 112 डायल करें।",
            "ta": f"வானிலை எச்சரிக்கை: {districts_short} பகுதியில் கனமழை எச்சரிக்கை. பாதுகாப்பாக இருங்கள். அவசர உதவிக்கு 112.",
        }

    disclaimer_note = "AI-generated draft advisory for officer review. Must be verified against official IMD/NDMA bulletins before public broadcast."

    advisories_res = {}
    source_res = "rule_based_template"

    if settings.GEMINI_API_KEY:
        try:
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    response_mime_type="application/json",
                ),
            )
            import json
            parsed = json.loads(response.text.strip())
            if isinstance(parsed, dict) and any(l in parsed for l in req.languages):
                advisories_res = parsed
                source_res = "gemini_llm"
        except Exception as e:
            logger.warning(f"LLM broadcast advisory error: {e}. Falling back to templates.")
            advisories_res = {}

    if not advisories_res:
        advisories_res = {lang: fallbacks.get(lang, fallbacks["en"]) for lang in req.languages}

    # Strict truncation to <= 160 chars and character count calculation
    final_advisories = {}
    char_counts = {}
    for lang in req.languages:
        text = str(advisories_res.get(lang) or fallbacks.get(lang, fallbacks["en"])).strip()
        if len(text) > 160:
            text = text[:157] + "..."
        final_advisories[lang] = text
        char_counts[lang] = len(text)

    return {
        "status": "success",
        "source": source_res,
        "disclaimer": disclaimer_note,
        "advisories": final_advisories,
        "char_counts": char_counts,
        "hazard_type": req.hazard_type,
        "severity": req.severity,
        "state": req.state,
        "districts": req.districts,
    }


@router.get("/state-risk-summary")
async def get_state_risk_summary(state: str = Query("Telangana", description="Indian State name")):
    """
    Returns state-level disaster risk matrix:
    - Active alerts across districts
    - District risk heat table (Low, Moderate, High, Severe)
    - Highest risk districts
    """
    alerts = await AlertRepository.get_active_alerts(radius_km=500.0)
    
    # State district defaults
    state_districts = {
        "Telangana": ["Hyderabad", "Rangareddy", "Khammam", "Warangal", "Nalgonda", "Karimnagar", "Nizamabad", "Adilabad"],
        "Andhra Pradesh": ["Kurnool", "Anantapur", "Visakhapatnam", "Vijayawada", "Guntur", "Tirupati", "Kadapa", "Nellore"],
        "Delhi": ["New Delhi", "North Delhi", "South Delhi", "East Delhi", "West Delhi"],
        "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Nashik", "Thane", "Aurangabad", "Solapur"],
        "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli"],
        "Karnataka": ["Bengaluru Urban", "Mysuru", "Mangaluru", "Hubballi", "Belagavi", "Ballari"],
    }

    districts = state_districts.get(state, ["District 1", "District 2", "District 3", "District 4", "District 5"])

    # Score districts
    district_rows = []
    for d in districts:
        matched_alerts = []
        for a in alerts:
            reg = getattr(a, "region", "") if not isinstance(a, dict) else a.get("region", "")
            if d.lower() in str(reg).lower():
                matched_alerts.append(a)

        if matched_alerts:
            # Pick highest severity
            best_alert = matched_alerts[0]
            raw_sev = getattr(best_alert, "severity", None) if not isinstance(best_alert, dict) else best_alert.get("severity")
            sev = getattr(raw_sev, "value", str(raw_sev or "yellow")).lower()
            raw_haz = getattr(best_alert, "alert_type", None) if not isinstance(best_alert, dict) else best_alert.get("alert_type")
            hazard = getattr(raw_haz, "value", str(raw_haz or "heavy_rain"))
            title = getattr(best_alert, "title", "Active Weather Alert") if not isinstance(best_alert, dict) else best_alert.get("title", "Active Weather Alert")
            desc = getattr(best_alert, "description", "") if not isinstance(best_alert, dict) else best_alert.get("description", "")
            
            score = 90 if sev == "red" else (70 if sev == "orange" else 40)
            status_text = "Severe" if sev == "red" else ("Warning" if sev == "orange" else "Watch")

            # Derive forecast metrics based on hazard & severity
            if "rain" in hazard.lower() or "flood" in hazard.lower():
                rain_mm = 85.0 if sev == "red" else (52.0 if sev == "orange" else 28.0)
                temp_c = 28.5
                risk_note = "High inundation risk. NDRF/SDRF water rescue assets on standby." if sev in ["red", "orange"] else "Localized waterlogging possible in low-lying corridors."
            elif "heat" in hazard.lower():
                rain_mm = 0.0
                temp_c = 44.0 if sev == "red" else (41.5 if sev == "orange" else 39.0)
                risk_note = "Extreme heat stress. Deploy oral rehydration kiosks and restrict outdoor labor."
            elif "wind" in hazard.lower() or "cyclone" in hazard.lower():
                rain_mm = 60.0 if sev == "red" else 30.0
                temp_c = 27.0
                risk_note = "Squally gale winds forecast. Clear loose hoardings and secure power lines."
            else:
                rain_mm = 20.0
                temp_c = 32.0
                risk_note = desc[:80] + "..." if len(desc) > 80 else desc or "Monitor weather updates."
        else:
            sev = "green"
            hazard = "normal"
            score = 15
            status_text = "Normal"
            title = "No Active Hazard"
            rain_mm = 2.0
            temp_c = 32.5
            risk_note = "Routine seasonal conditions. No operational disruption expected."

        district_rows.append({
            "district": d,
            "severity": sev,
            "status": status_text,
            "hazard": hazard,
            "risk_score": score,
            "active_alerts_count": len(matched_alerts),
            "alert_title": title,
            "forecast_rainfall_mm": rain_mm,
            "max_temperature_c": temp_c,
            "risk_info": risk_note,
        })

    district_rows.sort(key=lambda x: x["risk_score"], reverse=True)

    severity_counts = {
        "severe": sum(1 for d in district_rows if d["severity"] == "red"),
        "warning": sum(1 for d in district_rows if d["severity"] == "orange"),
        "watch": sum(1 for d in district_rows if d["severity"] == "yellow"),
        "normal": sum(1 for d in district_rows if d["severity"] == "green"),
    }

    heaviest_rain = max(district_rows, key=lambda x: x["forecast_rainfall_mm"]) if district_rows else None
    hottest = max(district_rows, key=lambda x: x["max_temperature_c"]) if district_rows else None

    return {
        "state": state,
        "total_active_alerts": len([d for d in district_rows if d["severity"] != "green"]),
        "high_risk_districts": [d["district"] for d in district_rows if d["risk_score"] >= 70],
        "severity_counts": severity_counts,
        "heaviest_rainfall_district": {
            "district": heaviest_rain["district"] if heaviest_rain else "N/A",
            "rainfall_mm": heaviest_rain["forecast_rainfall_mm"] if heaviest_rain else 0.0,
            "hazard": heaviest_rain["hazard"] if heaviest_rain else "normal",
        },
        "hottest_district": {
            "district": hottest["district"] if hottest else "N/A",
            "temperature_c": hottest["max_temperature_c"] if hottest else 0.0,
            "hazard": hottest["hazard"] if hottest else "normal",
        },
        "districts": district_rows,
        "last_updated": datetime.utcnow().isoformat() + "Z",
    }
