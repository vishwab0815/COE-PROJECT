"""
Seed the students collection from metadata.csv (idempotent via upsert).
"""

import os
import pandas as pd
from app.core.database import get_db

METADATA_CSV = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "metadata.csv")


async def seed_students():
    """Read metadata.csv and upsert all students into MongoDB."""
    db = get_db()

    if not os.path.exists(METADATA_CSV):
        print(f"  [Seed] WARNING: {METADATA_CSV} not found, skipping seed")
        return

    df = pd.read_csv(METADATA_CSV)
    print(f"  [Seed] Loading {len(df)} students from metadata.csv...")

    # Check if already seeded
    existing_count = await db.students.count_documents({})
    if existing_count >= len(df):
        print(f"  [Seed] Already seeded ({existing_count} students in DB), skipping")
        return

    # Bulk upsert
    from pymongo import UpdateOne

    operations = []
    for _, row in df.iterrows():
        operations.append(
            UpdateOne(
                {"roll_no": row["roll_no"]},
                {"$set": {
                    "roll_no": row["roll_no"],
                    "name": row["name"],
                    "branch": row["branch"],
                }},
                upsert=True,
            )
        )

    if operations:
        result = await db.students.bulk_write(operations)
        print(f"  [Seed] Upserted {result.upserted_count} new, modified {result.modified_count} existing")

    final_count = await db.students.count_documents({})
    print(f"  [Seed] Total students in DB: {final_count}")
