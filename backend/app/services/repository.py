import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from bson import ObjectId

from app.core.database import get_database
from app.models.user import UserModel, UserRole, UserLocation
from app.models.conversation import ConversationModel, MessageModel
from app.models.weather_cache import WeatherCacheModel
from app.models.alert import AlertModel, AlertSeverity, AlertType
from app.models.subscription import SubscriptionModel
from app.models.location import LocationModel
from app.models.feedback import FeedbackModel

logger = logging.getLogger(__name__)

# Resilient in-memory fallback stores for local testing / offline dev
_MEMORY_USERS: Dict[str, dict] = {}
_MEMORY_CONVERSATIONS: Dict[str, dict] = {}
_MEMORY_CACHE: Dict[str, dict] = {}
_MEMORY_ALERTS: List[dict] = []
_MEMORY_SUBSCRIPTIONS: Dict[str, dict] = {}
_MEMORY_LOCATIONS: List[dict] = []
_MEMORY_FEEDBACK: List[dict] = []


class UserRepository:
    @staticmethod
    async def get_or_create_user(
        session_id: str,
        preferred_language: str = "en",
        role: UserRole = UserRole.CITIZEN,
        home_location: Optional[UserLocation] = None,
    ) -> UserModel:
        db = get_database()
        if db is not None:
            user_doc = await db.users.find_one({"session_id": session_id})
            if user_doc:
                return UserModel(**user_doc)

            new_user = UserModel(
                session_id=session_id,
                preferred_language=preferred_language,
                role=role,
                home_location=home_location or UserLocation(),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            await db.users.insert_one(new_user.model_dump())
            return new_user
        else:
            if session_id in _MEMORY_USERS:
                return UserModel(**_MEMORY_USERS[session_id])
            new_user = UserModel(
                session_id=session_id,
                preferred_language=preferred_language,
                role=role,
                home_location=home_location or UserLocation(),
            )
            _MEMORY_USERS[session_id] = new_user.model_dump()
            return new_user

    @staticmethod
    async def update_user(session_id: str, update_fields: Dict[str, Any]) -> Optional[UserModel]:
        db = get_database()
        update_fields["updated_at"] = datetime.utcnow()
        if db is not None:
            res = await db.users.find_one_and_update(
                {"session_id": session_id},
                {"$set": update_fields},
                return_document=True,
            )
            return UserModel(**res) if res else None
        else:
            if session_id in _MEMORY_USERS:
                _MEMORY_USERS[session_id].update(update_fields)
                return UserModel(**_MEMORY_USERS[session_id])
            return None


class ConversationRepository:
    @staticmethod
    async def append_message(session_id: str, message: MessageModel) -> ConversationModel:
        db = get_database()
        msg_dict = message.model_dump()
        now = datetime.utcnow()

        if db is not None:
            await db.conversations.update_one(
                {"session_id": session_id},
                {
                    "$push": {"messages": msg_dict},
                    "$set": {"updated_at": now},
                    "$setOnInsert": {"created_at": now, "session_id": session_id},
                },
                upsert=True,
            )
            doc = await db.conversations.find_one({"session_id": session_id})
            return ConversationModel(**doc)
        else:
            if session_id not in _MEMORY_CONVERSATIONS:
                _MEMORY_CONVERSATIONS[session_id] = {
                    "session_id": session_id,
                    "messages": [],
                    "created_at": now,
                    "updated_at": now,
                }
            _MEMORY_CONVERSATIONS[session_id]["messages"].append(msg_dict)
            _MEMORY_CONVERSATIONS[session_id]["updated_at"] = now
            return ConversationModel(**_MEMORY_CONVERSATIONS[session_id])

    @staticmethod
    async def get_recent_messages(session_id: str, limit: int = 6) -> List[MessageModel]:
        db = get_database()
        if db is not None:
            doc = await db.conversations.find_one(
                {"session_id": session_id},
                {"messages": {"$slice": -limit}},
            )
            if doc and "messages" in doc:
                return [MessageModel(**m) for m in doc["messages"]]
            return []
        else:
            conv = _MEMORY_CONVERSATIONS.get(session_id)
            if conv and "messages" in conv:
                msgs = conv["messages"][-limit:]
                return [MessageModel(**m) for m in msgs]
            return []


class WeatherCacheRepository:
    @staticmethod
    async def get_cached(key: str) -> Optional[Dict[str, Any]]:
        db = get_database()
        if db is not None:
            doc = await db.weather_cache.find_one({"key": key})
            if doc:
                # Check 15-min validity
                fetched_at = doc.get("fetched_at")
                if fetched_at and (datetime.utcnow() - fetched_at) < timedelta(minutes=15):
                    return doc.get("data")
            return None
        else:
            cached = _MEMORY_CACHE.get(key)
            if cached:
                fetched_at = cached.get("fetched_at")
                if fetched_at and (datetime.utcnow() - fetched_at) < timedelta(minutes=15):
                    return cached.get("data")
            return None

    @staticmethod
    async def set_cached(key: str, data: Dict[str, Any], ttl_minutes: int = 15):
        now = datetime.utcnow()
        cache_item = {
            "key": key,
            "data": data,
            "fetched_at": now,
            "expires_at": now + timedelta(minutes=ttl_minutes),
        }
        db = get_database()
        if db is not None:
            await db.weather_cache.update_one(
                {"key": key},
                {"$set": cache_item},
                upsert=True,
            )
        else:
            _MEMORY_CACHE[key] = cache_item


class AlertRepository:
    @staticmethod
    async def create_alert(alert: AlertModel) -> str:
        db = get_database()
        doc = alert.model_dump(by_alias=True, exclude={"id"})
        if db is not None:
            res = await db.alerts.insert_one(doc)
            return str(res.inserted_id)
        else:
            doc["_id"] = str(len(_MEMORY_ALERTS) + 1)
            _MEMORY_ALERTS.append(doc)
            return doc["_id"]

    @staticmethod
    async def get_active_alerts(
        lat: Optional[float] = None,
        lon: Optional[float] = None,
        radius_km: float = 100.0,
        severity: Optional[str] = None,
    ) -> List[AlertModel]:
        now = datetime.utcnow()
        db = get_database()
        query: Dict[str, Any] = {"valid_to": {"$gte": now}}

        if severity:
            query["severity"] = severity

        if lat is not None and lon is not None and db is not None:
            # 2dsphere near query
            query["geometry"] = {
                "$near": {
                    "$geometry": {"type": "Point", "coordinates": [lon, lat]},
                    "$maxDistance": radius_km * 1000,
                }
            }

        if db is not None:
            cursor = db.alerts.find(query).sort("valid_to", 1)
            results = []
            async for doc in cursor:
                doc["_id"] = str(doc["_id"])
                results.append(AlertModel(**doc))
            return results
        else:
            results = []
            for doc in _MEMORY_ALERTS:
                if doc.get("valid_to", now) >= now:
                    if not severity or doc.get("severity") == severity:
                        results.append(AlertModel(**doc))
            return results


class SubscriptionRepository:
    @staticmethod
    async def create_subscription(sub: SubscriptionModel) -> str:
        db = get_database()
        doc = sub.model_dump(by_alias=True, exclude={"id"})
        if db is not None:
            res = await db.subscriptions.insert_one(doc)
            return str(res.inserted_id)
        else:
            sub_id = f"sub-{len(_MEMORY_SUBSCRIPTIONS)+1}"
            doc["_id"] = sub_id
            _MEMORY_SUBSCRIPTIONS[sub_id] = doc
            return sub_id

    @staticmethod
    async def delete_subscription(sub_id: str) -> bool:
        db = get_database()
        if db is not None:
            try:
                res = await db.subscriptions.delete_one({"_id": ObjectId(sub_id)})
                return res.deleted_count > 0
            except Exception:
                res = await db.subscriptions.delete_one({"_id": sub_id})
                return res.deleted_count > 0
        else:
            if sub_id in _MEMORY_SUBSCRIPTIONS:
                del _MEMORY_SUBSCRIPTIONS[sub_id]
                return True
            return False

    @staticmethod
    async def get_active_subscriptions() -> List[SubscriptionModel]:
        db = get_database()
        if db is not None:
            cursor = db.subscriptions.find({"is_active": True})
            results = []
            async for doc in cursor:
                doc["_id"] = str(doc["_id"])
                results.append(SubscriptionModel(**doc))
            return results
        else:
            return [
                SubscriptionModel(**s)
                for s in _MEMORY_SUBSCRIPTIONS.values()
                if s.get("is_active", True)
            ]


class LocationRepository:
    @staticmethod
    async def search_locations(query: str, limit: int = 10) -> List[LocationModel]:
        q = query.strip()
        if not q:
            return []

        db = get_database()
        if db is not None:
            # First attempt regex / text match
            regex = {"$regex": f"^{q}", "$options": "i"}
            cursor = db.locations.find({
                "$or": [
                    {"name": regex},
                    {"district": regex},
                    {"aliases": regex},
                    {"state": regex},
                ]
            }).limit(limit)

            docs = await cursor.to_list(length=limit)
            if not docs:
                # Fallback to full text search
                cursor = db.locations.find({"$text": {"$search": q}}).limit(limit)
                docs = await cursor.to_list(length=limit)

            return [LocationModel(**d) for d in docs]
        else:
            matches = []
            q_lower = q.lower()
            for loc in _MEMORY_LOCATIONS:
                name_match = q_lower in loc["name"].lower()
                dist_match = q_lower in loc["district"].lower()
                alias_match = any(q_lower in a.lower() for a in loc.get("aliases", []))
                if name_match or dist_match or alias_match:
                    matches.append(LocationModel(**loc))
                    if len(matches) >= limit:
                        break
            return matches

    @staticmethod
    async def get_by_name(name: str) -> Optional[LocationModel]:
        db = get_database()
        q = name.strip()
        if db is not None:
            doc = await db.locations.find_one({
                "$or": [
                    {"name": {"$regex": f"^{q}$", "$options": "i"}},
                    {"aliases": {"$regex": f"^{q}$", "$options": "i"}}
                ]
            })
            return LocationModel(**doc) if doc else None
        else:
            q_lower = q.lower()
            for loc in _MEMORY_LOCATIONS:
                if loc["name"].lower() == q_lower or any(a.lower() == q_lower for a in loc.get("aliases", [])):
                    return LocationModel(**loc)
            return None

    @staticmethod
    async def insert_many(locations: List[dict]):
        db = get_database()
        if db is not None and locations:
            # Upsert by name and state to avoid duplicate keys
            for loc in locations:
                await db.locations.update_one(
                    {"name": loc["name"], "state": loc["state"]},
                    {"$set": loc},
                    upsert=True
                )
        else:
            global _MEMORY_LOCATIONS
            _MEMORY_LOCATIONS = locations

    @staticmethod
    async def count() -> int:
        db = get_database()
        if db is not None:
            return await db.locations.count_documents({})
        return len(_MEMORY_LOCATIONS)


class FeedbackRepository:
    @staticmethod
    async def save_feedback(fb: FeedbackModel) -> str:
        db = get_database()
        doc = fb.model_dump()
        if db is not None:
            res = await db.feedback.insert_one(doc)
            return str(res.inserted_id)
        else:
            _MEMORY_FEEDBACK.append(doc)
            return str(len(_MEMORY_FEEDBACK))
