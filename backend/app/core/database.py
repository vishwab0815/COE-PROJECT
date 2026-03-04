"""
Async MongoDB connection via Motor.
"""

import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

client: AsyncIOMotorClient = None
db = None


async def connect_db():
    """Initialize the MongoDB connection and create indexes."""
    global client, db
    client = AsyncIOMotorClient(
        settings.MONGO_URI,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=10000,
    )
    db = client[settings.DB_NAME]

    # Verify connection
    await client.admin.command("ping")
    print(f"  [DB] Connected to MongoDB: {settings.DB_NAME}")

    # Create indexes for fast lookups
    await db.students.create_index("roll_no", unique=True)
    await db.attendance.create_index([("roll_no", 1), ("date", 1)])
    await db.attendance.create_index("date")
    print("  [DB] Indexes created")

    # Initialize dynamic global config for shift times
    config = await db.settings.find_one({"_id": "global_config"})
    if not config:
        await db.settings.insert_one({
            "_id": "global_config",
            "login_time": getattr(settings, "LOGIN_TIME", "09:30:00"),
            "logout_time": getattr(settings, "LOGOUT_TIME", "16:30:00")
        })
        print("  [DB] Initialized global shift settings")


async def close_db():
    """Close the MongoDB connection."""
    global client
    if client:
        client.close()
        print("  [DB] Connection closed")


def get_db():
    """Get the database instance."""
    return db
