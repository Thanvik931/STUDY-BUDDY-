import os
import sys
from datetime import datetime, timezone
from pymongo import MongoClient, ASCENDING
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "")
DB_NAME = os.getenv("DB_NAME", "study_buddy_db")

client = None
db = None

def get_database():
    global client, db
    if db is not None:
        return db

    if not MONGODB_URI or "your_username" in MONGODB_URI:
        print("[WARN] MONGODB_URI is not configured in .env. Using mock in-memory fallback for local testing.")
        return None

    try:
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        # Verify connection
        client.admin.command('ping')
        db = client[DB_NAME]
        print(f"[SUCCESS] Connected to MongoDB Atlas: {DB_NAME}")
        init_indexes(db)
        return db
    except Exception as e:
        print(f"[ERROR] Failed to connect to MongoDB Atlas: {e}")
        return None

def init_indexes(database):
    """
    Initializes required MongoDB indexes:
    1. TTL Index on 'expires_at' (for automatic Cram Mode memory expiry)
    2. Compound index on (student_id, status)
    """
    if database is None:
        return

    try:
        # TTL Index: Documents with an expires_at date will automatically be deleted by MongoDB
        database.memories.create_index("expires_at", expireAfterSeconds=0, name="cram_mode_ttl_index")
        
        # Compound Metadata Index for efficient student-scoped retrieval
        database.memories.create_index(
            [("student_id", ASCENDING), ("status", ASCENDING), ("created_at", ASCENDING)],
            name="student_status_idx"
        )
        print("[SUCCESS] MongoDB indexes initialized (TTL + Compound metadata index).")
    except Exception as e:
        print(f"[WARN] Error initializing indexes: {e}")
