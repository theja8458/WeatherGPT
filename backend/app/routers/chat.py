from fastapi import APIRouter, Request, HTTPException, status
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.llm_service import llm_service
from app.core.limiter import limiter
from app.core.security import check_prompt_injection

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("", response_model=ChatResponse)
@limiter.limit("30/minute")
async def chat_message(request: Request, payload: ChatRequest):
    """
    Core WeatherGPT Conversational Intelligence Endpoint.
    Protected by:
    - SlowAPI Rate Limiter (30 requests/minute per client)
    - Prompt Injection Guard (blocks instruction override, credential exfiltration, role hijacking)
    - Input sanitization (null-byte and control-char filtering)
    - Grounded meteorological tools (zero hallucination, fallback templates)
    """
    # 1. Prompt Injection & Security Guard
    is_safe, reason, safe_response = check_prompt_injection(payload.message)
    if not is_safe:
        return ChatResponse(
            answer=safe_response,
            intent="security_guard",
            entities={"security_action": "blocked_injection"},
            sources=["Security Policy Engine"],
            data_cards=[],
            follow_up_suggestions=[
                "What is the weather today?",
                "Will it rain tomorrow?",
                "Give me the temperature in Kurnool",
            ],
            language="en",
        )

    # 2. Process Legitimate Weather Conversational Query
    try:
        force_fallback = request.headers.get("x-simulate-llm-failure", "").lower() == "true"
        response_data = await llm_service.process_chat(
            session_id=payload.session_id,
            message=payload.message,
            language=payload.language,
            lat=payload.lat,
            lon=payload.lon,
            force_fallback=force_fallback,
        )
        return ChatResponse(**response_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat processing failed: {str(e)}"
        )
