import logging
from typing import Optional, List
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel

from app.models.alert import AlertModel, AlertSeverity, AlertType
from app.models.subscription import SubscriptionModel
from app.services.repository import AlertRepository, SubscriptionRepository
from app.services.alert_service import alert_service
from app.services.websocket_manager import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Alerts & Early Warnings"])


class AlertSimulationRequest(BaseModel):
    region: str = "Hyderabad"
    alert_type: str = "heavy_rain"
    severity: str = "orange"
    lat: float = 17.3850
    lon: float = 78.4867
    custom_title: Optional[str] = None
    custom_description: Optional[str] = None


class SubscriptionRequest(BaseModel):
    session_id: str
    location_name: str
    lat: float
    lon: float
    radius_km: float = 50.0
    channel: str = "websocket"
    target: Optional[str] = None


@router.get("/alerts")
async def get_alerts(
    lat: Optional[float] = Query(None, description="Latitude for proximity query"),
    lon: Optional[float] = Query(None, description="Longitude for proximity query"),
    radius: float = Query(150.0, description="Radius in kilometers"),
    severity: Optional[str] = Query(None, description="Filter by severity: green, yellow, orange, red"),
):
    """
    Retrieves active weather alerts from MongoDB. Supports geo-proximity queries and severity filtering.
    """
    alerts = await AlertRepository.get_active_alerts(
        lat=lat,
        lon=lon,
        radius_km=radius,
        severity=severity,
    )
    return {
        "count": len(alerts),
        "alerts": alerts,
    }


@router.post("/alerts/simulate")
async def simulate_alert(req: AlertSimulationRequest):
    """
    Triggers an artificial or threshold-based alert and pushes it live to all
    connected WebSocket clients. Used for demonstration and verification.
    """
    try:
        sev = AlertSeverity(req.severity.lower())
    except ValueError:
        sev = AlertSeverity.ORANGE

    try:
        atype = AlertType(req.alert_type.lower())
    except ValueError:
        atype = AlertType.HEAVY_RAIN

    alert = await alert_service.simulate_alert(
        region=req.region,
        alert_type=atype,
        severity=sev,
        lat=req.lat,
        lon=req.lon,
        custom_title=req.custom_title,
        custom_description=req.custom_description,
    )
    return {
        "status": "success",
        "message": f"Simulated {sev.value.upper()} alert broadcasted successfully via WebSocket.",
        "alert": alert,
    }


class LoweredThresholdRequest(BaseModel):
    region: str = "Hyderabad"
    lat: float = 17.3850
    lon: float = 78.4867
    custom_rain_threshold: float = 0.0


@router.post("/alerts/evaluate-lowered-threshold")
async def trigger_lowered_threshold(req: LoweredThresholdRequest):
    """
    Evaluates live forecast using an artificially lowered threshold and broadcasts live alerts over WebSocket.
    Fulfills Prompt 10: 'Done when: an artificially lowered threshold triggers a live alert banner via WebSocket.'
    """
    alerts = await alert_service.evaluate_location_forecast(
        lat=req.lat,
        lon=req.lon,
        place_name=req.region,
        custom_rain_threshold=req.custom_rain_threshold,
    )
    return {
        "status": "success",
        "evaluated_alerts_count": len(alerts),
        "alerts": alerts,
    }


@router.post("/subscriptions")
async def create_subscription(req: SubscriptionRequest):
    """Subscribes a user session/location to live alerts."""
    sub = SubscriptionModel(
        session_id=req.session_id,
        location_name=req.location_name,
        lat=req.lat,
        lon=req.lon,
        radius_km=req.radius_km,
        channel=req.channel,
        target=req.target,
    )
    sub_id = await SubscriptionRepository.create_subscription(sub)
    return {
        "status": "subscribed",
        "subscription_id": sub_id,
        "location": req.location_name,
    }


@router.delete("/subscriptions/{subscription_id}")
async def delete_subscription(subscription_id: str):
    """Removes an active alert subscription."""
    deleted = await SubscriptionRepository.delete_subscription(subscription_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Subscription not found.")
    return {"status": "unsubscribed", "subscription_id": subscription_id}


# Live WebSocket Endpoint for real-time alert broadcasts
@router.websocket("/ws/alerts")
async def websocket_alerts_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        # Send initial confirmation message
        await websocket.send_json({
            "type": "CONNECTED",
            "message": "Connected to WeatherGPT Real-Time Alert Broadcast Stream",
        })
        while True:
            # Keep connection open and receive any ping/pong messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket connection error: {e}")
        ws_manager.disconnect(websocket)
