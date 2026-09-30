from typing import Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from app.models.feedback import FeedbackModel
from app.services.repository import FeedbackRepository

router = APIRouter(prefix="/feedback", tags=["Feedback"])


class FeedbackRequest(BaseModel):
    message_id: str
    rating: int = Field(..., ge=1, le=5, description="1 for thumbs down, 5 for thumbs up")
    comment: Optional[str] = None
    session_id: Optional[str] = None


class FeedbackResponse(BaseModel):
    success: bool
    feedback_id: str
    message: str = "Feedback recorded successfully"


@router.post("", response_model=FeedbackResponse)
async def submit_feedback(payload: FeedbackRequest):
    try:
        fb_model = FeedbackModel(
            message_id=payload.message_id,
            session_id=payload.session_id,
            rating=payload.rating,
            comment=payload.comment,
        )
        fb_id = await FeedbackRepository.save_feedback(fb_model)
        return FeedbackResponse(success=True, feedback_id=fb_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record feedback: {str(e)}"
        )
