import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from database import get_database
from memory_service import MemoryService, call_llm

app = FastAPI(
    title="Study Buddy API",
    description="Adaptive AI Study Companion with Agentic Memory powered by MongoDB Atlas",
    version="1.0.0"
)

# Enable CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = get_database()
memory_service = MemoryService(db)

# ----------------- Models -----------------
class GenerateQuizRequest(BaseModel):
    student_id: str
    topic: str

class EvaluateAnswerRequest(BaseModel):
    student_id: str
    topic: str
    question_text: str
    student_answer: str
    correct_answer: str
    concept_tested: Optional[str] = "Python Fundamentals"

class UpdateMemoryRequest(BaseModel):
    status: str
    content: Optional[str] = None

class CramModeRequest(BaseModel):
    student_id: str
    duration_minutes: int
    focus_topic: str

# ----------------- Endpoints -----------------

@app.get("/api/health")
def health_check():
    connected_db = get_database()
    return {
        "status": "online",
        "database": "mongodb_atlas" if connected_db is not None else "in_memory_simulation",
        "service": "Study Buddy Agentic Memory Engine"
    }

@app.get("/api/memories")
def get_memories(student_id: str = "student_rahul"):
    """Returns all memories for the Memory Inspector dashboard."""
    mems = memory_service.get_all_memories(student_id)
    return {"memories": mems, "count": len(mems)}

@app.post("/api/quiz/generate")
def generate_adaptive_quiz(req: GenerateQuizRequest):
    """
    1. Recalls relevant active memories from MongoDB using Vector Search.
    2. Dynamically crafts an adaptive quiz question targeting the student's weaknesses.
    """
    relevant_memories = memory_service.search_memories(req.student_id, req.topic, limit=2)
    
    memory_context = ""
    memory_summaries = []
    for m in relevant_memories:
        memory_context += f"- [{m['type'].upper()}]: {m['title']} ({m['content']})\n"
        memory_summaries.append(f"{m['title']} {m.get('content', '')}")

    system_instruction = (
        "You are Study Buddy, an expert adaptive tutor. You specialize in testing students "
        "on their known blind spots while tailoring explanations to their learning preferences."
    )

    prompt = f"""
Topic: {req.topic}

The student has the following verified memories recorded in MongoDB Atlas:
{memory_context if memory_context else "No prior misconceptions recorded. Generate a standard foundational question."}

Task:
Generate a single multiple-choice question on '{req.topic}'.
If the student has recorded misconceptions, intentionally frame this question to test their specific blind spot.
If the student has learning style preferences (e.g., analogies), incorporate them into the question or options.

Return strictly valid JSON with this exact structure:
{{
  "question": "The question text",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct_answer": "Option A",
  "explanation": "Why this answer is correct",
  "targeted_weakness": "The misconception targeted, or none",
  "concept_tested": "{req.topic}"
}}
"""
    llm_output = call_llm(prompt, system_instruction)
    parsed_quiz = None

    if llm_output:
        try:
            clean_json = llm_output.strip()
            if clean_json.startswith("```json"):
                clean_json = clean_json[7:]
            if clean_json.endswith("```"):
                clean_json = clean_json[:-3]
            parsed_quiz = json.loads(clean_json.strip())
        except Exception as e:
            print(f"[WARN] JSON parse error from LLM: {e}")

    # Robust fallback adaptive generator for live demo resilience
    if not parsed_quiz:
        if any("0-indexing" in m.lower() or "boundary" in m.lower() for m in memory_summaries):
            parsed_quiz = {
                "question": "Chef Alex is baking bread using a timer: `for minute in range(3): print(minute)`. What numbers are printed, and what is the first number?",
                "options": [
                    "0, 1, 2 (First is 0)",
                    "1, 2, 3 (First is 1)",
                    "0, 1, 2, 3 (First is 0)",
                    "1, 2 (First is 1)"
                ],
                "correct_answer": "0, 1, 2 (First is 0)",
                "explanation": "In Python, range(3) starts at index 0 and stops before 3: producing 0, 1, 2.",
                "targeted_weakness": "Targeted: 0-indexing boundary confusion (from past session memory)",
                "concept_tested": req.topic
            }
        else:
            parsed_quiz = {
                "question": "What will `len(['apple', 'banana', 'cherry'])` return, and what is the index of 'cherry'?",
                "options": [
                    "Length 3, index 2",
                    "Length 3, index 3",
                    "Length 2, index 2",
                    "Length 3, index 1"
                ],
                "correct_answer": "Length 3, index 2",
                "explanation": "The list has 3 items, but indices are 0, 1, and 2.",
                "targeted_weakness": "Foundational diagnostic question",
                "concept_tested": req.topic
            }

    parsed_quiz["memories_used"] = relevant_memories
    return parsed_quiz

@app.post("/api/quiz/evaluate")
def evaluate_quiz_answer(req: EvaluateAnswerRequest):
    """
    Evaluates student answer. If incorrect, diagnoses root cause and saves
    a new memory into MongoDB Atlas!
    """
    is_correct = req.student_answer.strip().lower() == req.correct_answer.strip().lower()
    
    new_memory = None
    if not is_correct:
        # LLM diagnosis of misconception
        diag_prompt = f"""
Student made a mistake on topic: {req.topic}
Question: {req.question_text}
Student's Answer: {req.student_answer}
Correct Answer: {req.correct_answer}

In 1 short sentence, diagnose the student's underlying cognitive misconception or blind spot.
Example: 'Confuses list length with the last valid index (off-by-one error).'
"""
        diagnosis = call_llm(diag_prompt)
        if not diagnosis:
            if "1" in req.student_answer and "0" in req.correct_answer:
                diagnosis = "Confuses 0-indexing with 1-indexing (off-by-one boundary error)."
            else:
                diagnosis = f"Conceptual misunderstanding regarding {req.topic} execution logic."

        clean_diagnosis = diagnosis.strip().replace('"', '')
        
        # Store in MongoDB
        new_memory = memory_service.store_memory(
            student_id=req.student_id,
            memory_type="misconception",
            title=f"Misconception on {req.topic}",
            content=clean_diagnosis,
            topic=req.topic
        )

    return {
        "is_correct": is_correct,
        "explanation": f"Correct answer is '{req.correct_answer}'.",
        "new_memory_formed": new_memory
    }

@app.patch("/api/memories/{memory_id}")
def update_memory(memory_id: str, req: UpdateMemoryRequest):
    """Allows student to correct diagnosis or mark as 'mastered'."""
    success = memory_service.update_memory_status(memory_id, req.status, req.content)
    if not success:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"status": "updated", "memory_id": memory_id, "new_status": req.status}

@app.delete("/api/memories/{memory_id}")
def delete_memory(memory_id: str):
    """Allows student to delete memory (GDPR / right to be forgotten)."""
    success = memory_service.delete_memory(memory_id)
    if not success:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"status": "deleted", "memory_id": memory_id}

@app.post("/api/cram-mode")
def activate_cram_mode(req: CramModeRequest):
    """
    Satisfies Track 1's TTL Expiry requirement:
    Creates a temporary high-priority memory that MongoDB automatically deletes!
    """
    memory = memory_service.store_memory(
        student_id=req.student_id,
        memory_type="cram_mode",
        title=f"⚡ Cram Mode: {req.focus_topic}",
        content=f"Temporary intensive review. High-priority focus for next {req.duration_minutes} minutes.",
        topic=req.focus_topic,
        expires_in_minutes=req.duration_minutes
    )
    return {
        "message": f"Cram Mode active for {req.duration_minutes} minutes. Managed by MongoDB TTL Index.",
        "memory": memory
    }
