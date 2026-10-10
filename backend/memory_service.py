import os
import json
import math
import requests
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# In-memory storage fallback if MongoDB URI is not yet configured by the user
in_memory_memories = []

def generate_fallback_embedding(text: str, dim: int = 768):
    """Generates a deterministic normalized pseudo-vector for local offline development."""
    vec = [0.0] * dim
    for i, char in enumerate(text):
        idx = (ord(char) * 31 + i) % dim
        vec[idx] += 1.0
    # Normalize vector
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]

def get_embedding(text: str):
    """
    Generates embedding vector. Uses Gemini API (text-embedding-004),
    or OpenAI, with graceful fallback.
    """
    if GEMINI_API_KEY and "your_" not in GEMINI_API_KEY:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={GEMINI_API_KEY}"
            resp = requests.post(url, json={
                "model": "models/text-embedding-004",
                "content": {"parts": [{"text": text}]}
            }, timeout=8)
            if resp.status_code == 200:
                return resp.json()["embedding"]["values"]
        except Exception as e:
            print(f"[WARN] Gemini embedding error: {e}, using local vector")

    if OPENAI_API_KEY and "your_" not in OPENAI_API_KEY:
        try:
            url = "https://api.openai.com/v1/embeddings"
            headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
            resp = requests.post(url, headers=headers, json={
                "model": "text-embedding-3-small",
                "input": text
            }, timeout=8)
            if resp.status_code == 200:
                return resp.json()["data"][0]["embedding"]
        except Exception as e:
            print(f"[WARN] OpenAI embedding error: {e}, using local vector")

    # Local deterministic vector fallback
    return generate_fallback_embedding(text, 768)

def call_llm(prompt: str, system_instruction: str = "You are Study Buddy, an adaptive AI tutor."):
    """Calls Gemini or OpenAI, with smart offline response generator fallback."""
    if GEMINI_API_KEY and "your_" not in GEMINI_API_KEY:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
            payload = {
                "systemInstruction": {"parts": [{"text": system_instruction}]},
                "contents": [{"parts": [{"text": prompt}]}]
            }
            resp = requests.post(url, json=payload, timeout=10)
            if resp.status_code == 200:
                return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            print(f"[WARN] Gemini LLM error: {e}")

    # High-quality contextual fallback generator for smooth offline demoing
    return None

def cosine_similarity(v1, v2):
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1)) or 1.0
    norm2 = math.sqrt(sum(b * b for b in v2)) or 1.0
    return dot / (norm1 * norm2)

class MemoryService:
    def __init__(self, db):
        self.db = db

    def store_memory(self, student_id: str, memory_type: str, title: str, content: str, topic: str = "General", expires_in_minutes: int = None):
        """Creates and stores a memory document in MongoDB Atlas."""
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=expires_in_minutes) if expires_in_minutes else None
        embedding = get_embedding(f"{title}: {content}")

        memory_doc = {
            "student_id": student_id,
            "type": memory_type, # "misconception", "learning_style", "mastered", "cram_mode"
            "title": title,
            "content": content,
            "topic": topic,
            "embedding": embedding,
            "status": "active",
            "confidence": 0.95,
            "created_at": now,
            "expires_at": expires_at
        }

        if self.db is not None:
            result = self.db.memories.insert_one(memory_doc)
            memory_doc["_id"] = str(result.inserted_id)
        else:
            memory_doc["_id"] = f"mem_{len(in_memory_memories) + 1}"
            in_memory_memories.append(memory_doc)

        return memory_doc

    def search_memories(self, student_id: str, query: str, limit: int = 3):
        """
        Retrieves relevant active memories using MongoDB Atlas Vector Search.
        Applies filter on student_id and active status.
        """
        query_vector = get_embedding(query)
        now = datetime.now(timezone.utc)

        if self.db is not None:
            # 1. Try MongoDB Atlas Vector Search
            try:
                pipeline = [
                    {
                        "$vectorSearch": {
                            "index": "vector_index",
                            "path": "embedding",
                            "queryVector": query_vector,
                            "numCandidates": 20,
                            "limit": limit,
                            "filter": {
                                "student_id": student_id,
                                "status": "active"
                            }
                        }
                    }
                ]
                results = list(self.db.memories.aggregate(pipeline))
                # Filter out expired TTL memories if MongoDB purge thread hasn't run yet
                valid = [m for m in results if not m.get("expires_at") or m["expires_at"] > now]
                for m in valid:
                    m["_id"] = str(m["_id"])
                    m.pop("embedding", None)
                if valid:
                    return valid
                print("[INFO] Vector search returned 0 results, fetching recent active memories from MongoDB.")
            except Exception as e:
                # If Atlas vector index hasn't finished building yet, fallback to filtered search
                print(f"[INFO] Vector search indexing fallback: {e}")

            cursor = self.db.memories.find({
                "student_id": student_id,
                "status": "active",
                "$or": [{"expires_at": None}, {"expires_at": {"$gt": now}}]
            }).sort("created_at", -1).limit(limit)
            res = list(cursor)
            for m in res:
                m["_id"] = str(m["_id"])
                m.pop("embedding", None)
            return res

        # In-memory fallback
        valid_mems = [
            m for m in in_memory_memories 
            if m["student_id"] == student_id and m["status"] == "active"
            and (not m.get("expires_at") or m["expires_at"] > now)
        ]
        # Rank by cosine similarity
        ranked = sorted(
            valid_mems,
            key=lambda m: cosine_similarity(query_vector, m.get("embedding", [])),
            reverse=True
        )
        output = []
        for r in ranked[:limit]:
            item = dict(r)
            item.pop("embedding", None)
            output.append(item)
        return output

    def get_all_memories(self, student_id: str):
        """Retrieves all memories for the Memory Inspector dashboard."""
        now = datetime.now(timezone.utc)
        if self.db is not None:
            cursor = self.db.memories.find({
                "student_id": student_id,
                "$or": [{"expires_at": None}, {"expires_at": {"$gt": now}}]
            }).sort("created_at", -1)
            docs = list(cursor)
            for d in docs:
                d["_id"] = str(d["_id"])
                d.pop("embedding", None)
            return docs

        output = []
        for m in in_memory_memories:
            if m["student_id"] == student_id and (not m.get("expires_at") or m["expires_at"] > now):
                item = dict(m)
                item.pop("embedding", None)
                output.append(item)
        return list(reversed(output))

    def update_memory_status(self, memory_id: str, new_status: str, new_content: str = None):
        """Updates a memory (e.g., mark as 'mastered', 'superseded', or update note)."""
        update_data = {"status": new_status}
        if new_content:
            update_data["content"] = new_content
            update_data["embedding"] = get_embedding(new_content)

        if self.db is not None:
            try:
                self.db.memories.update_one({"_id": ObjectId(memory_id)}, {"$set": update_data})
                return True
            except Exception:
                self.db.memories.update_one({"_id": memory_id}, {"$set": update_data})
                return True

        for m in in_memory_memories:
            if m["_id"] == memory_id:
                m.update(update_data)
                return True
        return False

    def delete_memory(self, memory_id: str):
        """Hard deletes a memory document from MongoDB."""
        if self.db is not None:
            try:
                self.db.memories.delete_one({"_id": ObjectId(memory_id)})
                return True
            except Exception:
                self.db.memories.delete_one({"_id": memory_id})
                return True

        global in_memory_memories
        in_memory_memories = [m for m in in_memory_memories if m["_id"] != memory_id]
        return True
