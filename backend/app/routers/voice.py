import logging
from typing import Optional
from fastapi import APIRouter, File, Form, UploadFile, HTTPException
from google import genai
from google.genai import types

from app.core.config import settings
from app.services.llm_service import LANGUAGE_NAMES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice", tags=["Voice Interaction"])


@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(..., description="Audio file in WAV, MP3, WebM, or OGG format"),
    language: Optional[str] = Form("en", description="Target language hint code (e.g. te, hi, en)"),
):
    """
    Transcribes spoken audio into text using Gemini multimodal audio understanding.
    Supports Indian languages (Hindi, Telugu, Tamil, etc.) as a fallback for browsers
    without Web Speech API.
    """
    if not file:
        raise HTTPException(status_code=400, detail="No audio file provided.")

    try:
        audio_bytes = await file.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Audio file is empty.")

        mime_type = file.content_type or "audio/webm"
        # Standardize common webm/wav mime types
        if "webm" in mime_type:
            mime_type = "audio/webm"
        elif "wav" in mime_type:
            mime_type = "audio/wav"
        elif "mp3" in mime_type:
            mime_type = "audio/mp3"
        elif "ogg" in mime_type:
            mime_type = "audio/ogg"

        lang_label = LANGUAGE_NAMES.get(language, "English or Indian language")

        if not settings.GEMINI_API_KEY:
            return {
                "transcript": "Audio received (Gemini API key not configured for server transcription fallback)",
                "language": language,
                "confidence": 0.5,
            }

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        
        prompt = (
            f"Listen carefully to this audio recording of a user asking about weather conditions. "
            f"The user is likely speaking in {lang_label}. "
            f"Accurately transcribe the spoken words into written text in the native script or words. "
            f"Output ONLY the transcribed words, nothing else."
        )

        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=[
                types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                prompt,
            ],
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=100,
            ),
        )

        transcript = response.text.strip() if response and response.text else ""

        return {
            "transcript": transcript,
            "language": language,
            "filename": file.filename,
            "size_bytes": len(audio_bytes),
        }

    except Exception as e:
        logger.error(f"Voice transcription failed: {e}")
        # Graceful fallback response
        return {
            "transcript": "",
            "error": str(e),
            "language": language,
            "fallback": True,
        }
