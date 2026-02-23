"""
Async MongoDB connection via Motor.
"""

from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

client: AsyncIOMotorClient = None
db = None


async def connect_db():
    """Initialize the MongoDB connection and create indexes."""
    global client, db
    client = AsyncIOMotorClient(settings.MONGO_URI)
    db = client[settings.DB_NAME]

    # Verify connection
    await client.admin.command("ping")
    print(f"  [DB] Connected to MongoDB: {settings.DB_NAME}")

    # Create indexes for fast lookups
    await db.students.create_index("roll_no", unique=True)
    await db.attendance.create_index([("roll_no", 1), ("date", 1)])
    await db.attendance.create_index("date")
    print("  [DB] Indexes created")


async def close_db():
    """Close the MongoDB connection."""
    global client
    if client:
        client.close()
        print("  [DB] Connection closed")


def get_db():
    """Get the database instance."""
    return db
