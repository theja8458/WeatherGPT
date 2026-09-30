import logging
from typing import Optional
import certifi
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
import pymongo
from app.core.config import settings

logger = logging.getLogger(__name__)


async def init_db_indexes(db: AsyncIOMotorDatabase):
    """
    Initializes indexes on MongoDB collections:
    - users: unique session_id
    - conversations: session_id
    - weather_cache: 15-minute TTL index on fetched_at, unique key
    - alerts: 2dsphere index on geometry, index on severity and valid_to
    - subscriptions: session_id, is_active
    - locations: text index on name, district, state, aliases
    - feedback: message_id
    """
    try:
        logger.info("Initializing MongoDB indexes...")

        # 1. users
        await db.users.create_index("session_id", unique=True)

        # 2. conversations
        await db.conversations.create_index("session_id", unique=True)
        await db.conversations.create_index("updated_at")

        # 3. weather_cache (15 minute TTL)
        await db.weather_cache.create_index("key", unique=True)
        await db.weather_cache.create_index("fetched_at", expireAfterSeconds=900)

        # 4. alerts (2dsphere index for geo-queries)
        await db.alerts.create_index([("geometry", pymongo.GEOSPHERE)])
        await db.alerts.create_index([("severity", pymongo.ASCENDING), ("valid_to", pymongo.ASCENDING)])

        # 5. subscriptions
        await db.subscriptions.create_index("session_id")
        await db.subscriptions.create_index([("is_active", pymongo.ASCENDING)])

        # 6. locations (Text index for search + geo index)
        await db.locations.create_index([
            ("name", pymongo.TEXT),
            ("district", pymongo.TEXT),
            ("state", pymongo.TEXT),
            ("aliases", pymongo.TEXT)
        ], name="locations_text_search")
        await db.locations.create_index("name")

        # 7. feedback
        await db.feedback.create_index("message_id")

        # 8. aws_observations (time-series index by station_id and timestamp)
        await db.aws_observations.create_index([("station_id", pymongo.ASCENDING), ("timestamp", pymongo.DESCENDING)])
        await db.aws_observations.create_index([("timestamp", pymongo.DESCENDING)])

        logger.info("MongoDB indexes successfully created/verified.")
    except Exception as e:
        logger.warning(f"Error initializing indexes (might already exist or degraded mode): {e}")


class DatabaseManager:
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None
    is_connected: bool = False

    async def connect_to_database(self):
        logger.info(f"Connecting to MongoDB at {settings.MONGODB_URI.split('@')[-1]}...")
        try:
            self.client = AsyncIOMotorClient(
                settings.MONGODB_URI,
                minPoolSize=settings.MONGODB_MIN_POOL_SIZE,
                maxPoolSize=settings.MONGODB_MAX_POOL_SIZE,
                serverSelectionTimeoutMS=8000,
                tlsCAFile=certifi.where(),
            )
            # Verify connection with ping
            await self.client.admin.command("ping")
            self.db = self.client[settings.MONGODB_DB_NAME]
            self.is_connected = True
            logger.info("Connected to MongoDB Atlas successfully.")
            
            # Create indexes on startup
            await init_db_indexes(self.db)
        except Exception as e:
            self.is_connected = False
            logger.warning(
                f"Failed to connect to MongoDB: {e}. Running in degraded/in-memory mode until Atlas connection is provided."
            )

    async def close_database_connection(self):
        if self.client:
            logger.info("Closing MongoDB connection...")
            self.client.close()
            self.is_connected = False
            logger.info("MongoDB connection closed.")


db_manager = DatabaseManager()


def get_database() -> Optional[AsyncIOMotorDatabase]:
    return db_manager.db
