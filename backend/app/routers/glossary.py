from fastapi import APIRouter, Query
from typing import Optional
from app.utils.translator import translation_service, WEATHER_GLOSSARY

router = APIRouter(prefix="/glossary", tags=["Multilingual Glossary"])


@router.get("")
async def get_weather_glossary(
    language: str = Query("en", description="Target Indian language code (en, te, hi, ta, kn, ml, mr, bn, gu, pa, or)")
):
    """
    Returns standardized IMD weather terms translated into the specified Indian language.
    """
    terms = translation_service.get_glossary(language=language)
    return {
        "language": language,
        "count": len(terms),
        "terms": terms,
    }


@router.get("/advisory")
async def get_advisory_template(
    template_id: str = Query("red_alert_advisory", description="Template identifier"),
    language: str = Query("en", description="Target language"),
    location: str = Query("Hyderabad", description="Location name to inject"),
):
    """
    Returns localized weather advisories or alerts cached in MongoDB.
    """
    rendered = await translation_service.get_translated_template(
        template_id=template_id,
        target_lang=language,
        params={"location": location},
    )
    return {
        "template_id": template_id,
        "language": language,
        "location": location,
        "advisory": rendered,
    }
