# 🎓 Study Buddy: Adaptive AI Study Companion
> **MongoDB Student Hackathon — Track 1: Agentic Memory**  
> *An AI companion that remembers your conceptual mistakes, adapts over time, and provides full student control over its memory via MongoDB Atlas.*

---

## 📌 1. Project Overview
* **One-Line Description:** An adaptive AI tutor that captures cognitive blind spots from quiz mistakes, indexes them in MongoDB Atlas, and uses Vector Search to proactively tailor future problems and analogies.
* **The Problem:** Modern LLM tutors suffer from total amnesia. Every session restarts from zero, forgetting previous mistakes, learning preferences, and boundary confusions. Naive context dumping inflates token costs and fails over time.
* **The Solution:** Study Buddy decouples reasoning from memory by creating an external, persistent cognitive memory store in MongoDB Atlas. It diagnoses root-cause misconceptions, semantically recalls them during future sessions, provides a live **Memory Inspector** for student agency, and auto-expires temporary cramming sessions using native **MongoDB TTL indexes**.

---

## 🌟 2. Key Features
1. **Persistent Agentic Memory:** Automatically diagnoses and extracts root-cause misconceptions from incorrect quiz answers into MongoDB documents.
2. **Visible In-Context Adaptation:** In subsequent sessions, MongoDB Atlas Vector Search semantically recalls active weaknesses and injects them into the prompt to generate tailored problems.
3. **Split-Screen Memory Inspector:** A live right-hand dashboard giving students full visibility into what the AI remembers about them.
4. **Student Sovereignty (Edit / Master / Delete):** Students can correct false diagnoses, delete memories (GDPR right to be forgotten), or mark topics as "Mastered."
5. **Exam Cram Mode (MongoDB TTL Index):** Creates temporary, high-intensity study memories that MongoDB automatically purges when time expires without any background cron jobs.

---

## 🛠️ 3. Tech Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend** | React 19 + Vite + Tailwind CSS + Lucide Icons | Rapid HMR, decoupled component state, and modern dark-mode cards. |
| **Backend** | Python + FastAPI + PyMongo + Uvicorn | Native handling of vector arrays and LLM SDKs, async speed, and `/docs` Swagger UI. |
| **Database** | **MongoDB Atlas** (M0 Cluster) | Native `$vectorSearch`, Document Model flexibility, and TTL Auto-Expiry indexes. |
| **AI / Embeddings** | Google Gemini 1.5 Flash (`text-embedding-004`) *or* OpenAI (`text-embedding-3-small`) | Fast, cost-efficient reasoning and normalized vector embeddings. |

---

## 🏗️ 4. System Architecture

```text
  [ Student Client ] (React + Vite + Tailwind)
        │
        ├── Left Screen: Interactive Quiz & Chat Workspace
        └── Right Screen: Live MongoDB Memory Inspector
        │
     (REST API)
        │
        ▼
  [ FastAPI Backend Service ] (Python)
        │
        ├── Memory Extractor Engine (LLM diagnostic prompt)
        ├── Dynamic Prompt Assembler (In-Context Injection)
        │
     (PyMongo)
        │
        ▼
  [ MongoDB Atlas Cluster ]
        ├── 'memories' collection
        │     ├── $vectorSearch index (Semantic recall of misconceptions)
        │     └── TTL index on 'expires_at' (Auto-expiring Cram Mode)
        └── Compound index on { student_id, status, created_at }
```

---

## 📂 5. Project Structure

```text
mongodb-study-buddy/
├── .env.example              # Template for environment secrets
├── .gitignore                # Ignores .env, node_modules, __pycache__
├── README.md                 # Project documentation
│
├── backend/
│   ├── main.py               # FastAPI application & REST endpoints
│   ├── database.py           # MongoDB connection & index initializers
│   ├── memory_service.py     # Atlas Vector Search, embedding generator & lifecycle
│   ├── seed_data.py          # Demo data seeding script
│   ├── requirements.txt      # Python dependencies
│   └── .env                  # Secrets (MONGODB_URI, GEMINI_API_KEY)
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Header.jsx           # Profile selector & Cram Mode TTL modal
    │   │   ├── QuizWorkspace.jsx    # Left screen: interactive quiz & feedback
    │   │   └── MemoryInspector.jsx  # Right screen: live MongoDB memory cards
    │   ├── App.jsx                  # Main split-screen container
    │   └── main.jsx                 # Entry point
    ├── package.json
    └── vite.config.js
```

---

## ⚡ 6. Quickstart: How to Run Locally

### Prerequisites
* Python 3.10+
* Node.js v18+ and npm

### 1. Configure Environment Variables
In `backend/.env` (copy from `.env.example`):
```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
DB_NAME=study_buddy_db
GEMINI_API_KEY=your_gemini_api_key_here
```
*(Note: If you run without keys, the backend automatically runs in a local offline simulation mode so you can test immediately without setup blockers!)*

### 2. Start the Backend
```bash
cd backend
python -m uvicorn main:app --reload --port 8000
```
*API documentation and interactive test bench will be available at:* `http://localhost:8000/docs`

### 3. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
*Open your browser at:* `http://localhost:5173`

---

## 🗄️ 7. MongoDB Atlas Configuration

### A. Creating the Vector Search Index
In MongoDB Atlas, navigate to your cluster $\rightarrow$ **Atlas Search** $\rightarrow$ **Create Search Index** $\rightarrow$ **JSON Editor**:
* **Database:** `study_buddy_db`
* **Collection:** `memories`
* **Index Name:** `vector_index`

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 768,
      "similarity": "cosine"
    },
    { "type": "filter", "path": "student_id" },
    { "type": "filter", "path": "status" }
  ]
}
```
*(If using OpenAI embeddings, set `numDimensions` to `1536`).*

### B. The TTL (Time-To-Live) Index
The backend automatically creates this on startup in `database.py`:
```python
db.memories.create_index("expires_at", expireAfterSeconds=0, name="cram_mode_ttl_index")
```

---

## 📡 8. REST API Specification

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Verifies backend and MongoDB connectivity status. |
| `GET` | `/api/memories` | Retrieves active, mastered, and TTL memories for the student. |
| `POST` | `/api/quiz/generate` | Uses Vector Search to recall past blind spots and generate an adaptive question. |
| `POST` | `/api/quiz/evaluate` | Evaluates answer, extracts conceptual misconception, and persists memory to Atlas. |
| `PATCH`| `/api/memories/{id}` | Updates memory diagnosis text or changes status to `mastered`. |
| `DELETE`| `/api/memories/{id}`| Purges a memory document from MongoDB Atlas (Right to be Forgotten). |
| `POST` | `/api/cram-mode` | Ingests a short-term memory document with an `expires_at` date for TTL deletion. |

---

## 👥 9. Team
* **Track:** MongoDB Student Hackathon — Track 1: Agentic Memory
* Built with ❤️ for student empowerment.
