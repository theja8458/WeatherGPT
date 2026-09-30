import json
import logging
from typing import List, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketAlertManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket client disconnected. Remaining connections: {len(self.active_connections)}")

    async def broadcast_alert(self, alert_data: dict):
        """Broadcasts an alert payload to all connected WebSocket clients."""
        if not self.active_connections:
            logger.debug("No active WebSocket clients to broadcast to.")
            return

        message = json.dumps({
            "type": "NEW_ALERT",
            "alert": alert_data,
        }, default=str)

        dead_connections = []
        for connection in list(self.active_connections):
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.warning(f"Error sending alert to WebSocket client: {e}")
                dead_connections.append(connection)

        for dead in dead_connections:
            self.active_connections.discard(dead)

        logger.info(f"Broadcast alert '{alert_data.get('title')}' to {len(self.active_connections)} client(s).")

    async def broadcast_json(self, payload: dict):
        """Broadcasts generic JSON payload (e.g. AWS live updates, telemetry) to all connected WebSocket clients."""
        if not self.active_connections:
            return

        message = json.dumps(payload, default=str)
        dead_connections = []
        for connection in list(self.active_connections):
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.warning(f"Error sending message to WebSocket client: {e}")
                dead_connections.append(connection)

        for dead in dead_connections:
            self.active_connections.discard(dead)


ws_manager = WebSocketAlertManager()
