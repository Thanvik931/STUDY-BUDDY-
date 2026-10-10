from database import get_database
from memory_service import MemoryService

def seed():
    print("[INFO] Seeding initial demonstration memories into MongoDB Atlas...")
    db = get_database()
    service = MemoryService(db)

    # Pre-seed 2 realistic student memories for demo
    m1 = service.store_memory(
        student_id="student_rahul",
        memory_type="misconception",
        title="0-Indexing Boundary Confusion",
        content="Rahul frequently assumes loops and arrays start at index 1 instead of index 0.",
        topic="Python Fundamentals"
    )

    m2 = service.store_memory(
        student_id="student_rahul",
        memory_type="learning_style",
        title="Visual & Analogy Learner",
        content="Responds strongly to culinary and vehicle metaphors rather than abstract equations.",
        topic="Learning Preference"
    )

    print("[SUCCESS] Seeding complete! Seeded memories:")
    print(f"- {m1['title']}")
    print(f"- {m2['title']}")

if __name__ == "__main__":
    seed()
