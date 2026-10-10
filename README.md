# 🎓 Study Buddy: Adaptive AI Study Companion
> **MongoDB Student Hackathon — Track 1: Agentic Memory**  
> *An adaptive engineering study companion that remembers conceptual misconceptions and learning styles, visibly evolving questions, difficulty, and explanations over time using MongoDB Atlas.*

---

## 📖 1. Plain-Language Overview
Every engineering student learns differently and trips on different concepts. Some confuse SQL `LEFT JOIN` with `INNER JOIN`; others struggle with OS Deadlock conditions. Standard AI tutors treat every interaction as an isolated session with complete amnesia. 

**Study Buddy** solves this by maintaining an **external cognitive memory layer in MongoDB Atlas**. When a student makes repeated mistakes on a topic, the backend diagnoses the conceptual root cause, saves it as a structured MongoDB document with a vector embedding, and dynamically retrieves it in later sessions to tailor difficulty and pedagogical scaffolding. Students retain complete sovereignty to inspect what the AI remembers, correct false diagnoses, or delete memories, while temporary cramming sessions auto-expire using native **MongoDB TTL indexes**.

---

## 🏗️ 2. ASCII Architecture Diagram

```text
+----------------------------------------------------------------------------------+
|                             STUDENT BROWSER CLIENT                               |
|        (Plain HTML5 / CSS3 / Vanilla JavaScript served statically from /public)   |
|                                                                                  |
|   [ Tab 1: Quiz & AI ]          [ Tab 2: Memory Inspector ]   [ Tab 3: Progress ]|
|   - Opener message              - Live memory cards           - Chart.js trends  |
|   - Adaptive MCQ & options      - TTL countdown timers        - Topic accuracy   |
|   - "Why this question" card    - Correct & Delete actions    - Aggregation view |
+----------------------------------------------------------------------------------+
                                        │
                         (REST API / x-student-id header)
                                        ▼
+----------------------------------------------------------------------------------+
|                             NODE.JS & EXPRESS BACKEND                            |
|                                                                                  |
|   [ Security & Middleware ]                                                      |
|   - Helmet HTTP Headers (CSP for Chart.js)    - 10kb JSON body size limit        |
|   - Express Rate Limit (60/min global, 20/min questions)                         |
|   - requireStudent middleware (enforces ownerId on every single DB query)        |
|   - Metrics tracker (rolling p50 / p95 latency over 200 requests)                |
|                                                                                  |
|   [ Services & Pure Logic Engines ]                                              |
|   - memoryRules.js: Pure state transition rules (Rule A, Rule B, Conflict, TTL) |
|   - scoring.js: Hybrid composite scoring (0.5*rel + 0.3*str + 0.2*rec)          |
|   - promptBuilder.js: XML-fenced memory injection & control character filter    |
|   - retrievalService.js: Concurrent Atlas Vector Search + Exact Topic Lookup    |
|   - aiService.js: Claude (@anthropic-ai/sdk) with 15s timeout & fallback bank    |
+----------------------------------------------------------------------------------+
                         │                                    │
           (Official MongoDB Node Driver)         (Claude 3.5 Haiku / Sonnet)
                         ▼                                    ▼
+--------------------------------------------------+   +---------------------------+
|             MONGODB ATLAS DATABASE               |   |       ANTHROPIC API       |
|                 (study_buddy_db)                 |   |  - System Prompt          |
|                                                  |   |  - <student_memories>     |
|   Collections & Strict $jsonSchema Validators:   |   |  - Validated JSON Output  |
|   • students: Student profile records            |   +---------------------------+
|   • memories: Cognitive memories with vectors    |
|   • attempts: Chronological question attempts    |
|   • questions: 24h TTL auto-expiring questions   |
|   • topic_stats: Atomic student topic counters   |
|                                                  |
|   Indexes:                                       |
|   • memories_owner_status_subject_topic_idx      |
|   • memories_ttl_idx (TTL on expiresAt, 0s)      |
|   • unique_active_weakness_per_topic (partial)   |
|   • unique_active_strength_per_topic (partial)   |
|   • questions_24h_ttl_idx (TTL on createdAt, 24h)|
|   • topic_stats_unique_owner_topic_idx (unique)  |
|   • memory_vector_index (Atlas Vector Search)    |
+--------------------------------------------------+
```

---

## 🛠️ 3. Why Each Technology Was Chosen

| Technology | Purpose in Project | Rationale (Why Chosen) |
| :--- | :--- | :--- |
| **Node.js 20+ & Express** | Backend HTTP API | Lightweight, asynchronous I/O, built-in `fetch`, and seamless native ESM support. |
| **Official `mongodb` Driver (v6)** | Database Persistence | Direct control over Atlas connection pooling (`maxPoolSize: 20`), raw `$jsonSchema` validators, `$vectorSearch`, and native index creation without Mongoose abstraction overhead. |
| **MongoDB Atlas** | Database & Vector Engine | Flexible document model for evolving cognitive memories, native Vector Search (`$vectorSearch`), and hardware-efficient TTL indexes for automatic expiry. |
| **Vanilla HTML/CSS/JS** | User Interface | Zero compilation pipeline, sub-millisecond load times, and guaranteed XSS safety via strict `textContent` rendering. |
| **Chart.js (CDN)** | Progress Dashboard | Clean, lightweight client-side charting to render accuracy trends computed by the backend aggregation pipeline. |
| **`@anthropic-ai/sdk`** | AI Question Generation | Industry-standard SDK for Claude models with strict structured JSON output and prompt caching capabilities. |
| **Zod** | Validation | Runtime type safety and schema validation for incoming student requests and AI-generated JSON. |
| **Helmet & Express Rate Limit** | Security Hardening | Prevents clickjacking, enforces strict CSP, and mitigates denial-of-service attempts. |
| **`node:test`** | Unit Testing | Zero-dependency, ultra-fast built-in testing framework executing all 13 pure logic tests in ~300ms. |

---

## ⚡ 4. Setup Steps

### Prerequisites
* Node.js v20.0.0 or higher
* npm v10.0.0 or higher
* A free MongoDB Atlas cluster (M0)

### Step 1: Clone and Configure Environment
```bash
git clone https://github.com/Thanvik931/STUDY-BUDDY-.git
cd STUDY-BUDDY-
cp .env.example .env
```

Open `.env` and fill in your values:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/study_buddy_db?retryWrites=true&w=majority
ANTHROPIC_API_KEY=your_anthropic_api_key_here
EMBEDDING_PROVIDER=local
EMBEDDING_MODEL=local-sentence-embedding
EMBEDDING_DIMENSIONS=1536
EMBEDDING_API_KEY=
AI_MODEL=claude-3-5-haiku-20241022
PORT=3000
DEMO_MODE=true
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Run Database Setup Script
```bash
npm run setup
```
*This connects to your Atlas cluster, applies strict `$jsonSchema` validators to `memories` and `attempts`, creates compound indexes, TTL indexes, and initializes the `memory_vector_index` Vector Search index.*

### Step 4: Verify Atlas Vector Search Index (If not auto-created)
If your cluster requires manual index approval:
1. In MongoDB Atlas, go to **Database** $\rightarrow$ **Atlas Search** $\rightarrow$ **Create Search Index**.
2. Select **JSON Editor**.
3. Target collection: `study_buddy_db.memories`.
4. Index name: `memory_vector_index`.
5. Paste this definition:
```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    },
    { "type": "filter", "path": "ownerId" },
    { "type": "filter", "path": "status" },
    { "type": "filter", "path": "type" },
    { "type": "filter", "path": "subject" }
  ]
}
```

### Step 5: Start the Application
```bash
npm start
```
Open **`http://localhost:3000`** in your browser.

---

## 📡 5. Complete REST API Table

All endpoints return standardized JSON. Errors always adhere to `{ error: { code, message } }`.

| Method | Endpoint | Auth Header | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | None | Returns server health and active MongoDB Atlas ping status. |
| `GET` | `/api/metrics` | None | Returns request counts, error counts, p50 and p95 latencies over last 200 requests. |
| `GET` | `/api/students` | None | Lists all student profiles. |
| `POST` | `/api/students` | None | Creates a new student profile (`{ name }`). |
| `POST` | `/api/session/start` | `x-student-id` | Returns personalized session opener based on past weaknesses and top weak topics. |
| `POST` | `/api/question` | `x-student-id` | Runs hybrid memory retrieval, selects difficulty, and returns MCQ (`correctIndex` omitted). |
| `POST` | `/api/answer` | `x-student-id` | Grades answer, logs attempt, atomically updates `topic_stats`, and executes memory rules. |
| `GET` | `/api/memories` | `x-student-id` | Retrieves paginated cognitive memories (`skip`, `limit` $\le 50$, projections exclude vector). |
| `POST` | `/api/memories/:id/correct` | `x-student-id` | Supersedes memory with student correction and creates new strength memory. |
| `DELETE`| `/api/memories/:id` | `x-student-id` | Hard-deletes a cognitive memory document from MongoDB Atlas. |
| `GET` | `/api/progress` | `x-student-id` | Runs aggregation pipeline to calculate accuracy percentage per topic per day. |
| `POST` | `/api/demo/seed` | None | *(DEMO_MODE only)* Seeds "Ravi (Day 1)" and "Ravi (Day 5)" with 6 memories. |
| `POST` | `/api/demo/expiring-memory`| `x-student-id` | *(DEMO_MODE only)* Creates a memory document that expires in 120 seconds via TTL. |

---

## 🍃 6. MongoDB Collections & Indexes Table

| Collection | Index Name | Specification | Purpose |
| :--- | :--- | :--- | :--- |
| `memories` | `memories_owner_status_subject_topic_idx` | `{ ownerId: 1, status: 1, subject: 1, topic: 1 }` | Fast filtered queries for student active memories. |
| `memories` | `memories_ttl_idx` | `{ expiresAt: 1 }` (`expireAfterSeconds: 0`) | Native automatic deletion when `expiresAt` is reached. |
| `memories` | `memory_vector_index` | Atlas Vector Search on `embedding` (cosine) with metadata filters | Semantic recall of conceptually relevant past weaknesses. |
| `topic_stats` | `topic_stats_unique_owner_topic_idx` | `{ ownerId: 1, subject: 1, topic: 1 }` (unique) | Enforces 1 counter document per student per topic. |
| `attempts` | `attempts_owner_created_idx` | `{ ownerId: 1, createdAt: -1 }` | Fast chronological retrieval for student attempt history. |
| `questions`| `questions_24h_ttl_idx` | `{ createdAt: 1 }` (`expireAfterSeconds: 86400`) | Automatically purges unanswered question instances after 24 hours. |

---

## 🔒 7. Security Checklist

- [x] **Strict Profile Separation:** `requireStudent` middleware extracts and verifies `x-student-id` on all authenticated routes.
- [x] **Owner-Enforced Queries:** Every database read, update, and delete uses `buildOwnerFilter(req.ownerId, ...)`. Students can never modify or view another student's data.
- [x] **Zero Stack Trace Leaks:** Central `errorHandler` masks internal database errors and formats all responses into `{ error: { code, message } }`.
- [x] **10kb Request Body Ceiling:** `express.json({ limit: '10kb' })` returns HTTP 413 on oversized payloads, mitigating memory exhaustion attacks.
- [x] **Helmet Security Headers:** Content Security Policy (CSP) explicitly restricts script origins to self and the trusted Chart.js CDN.
- [x] **Express Rate Limiting:** Global limiter prevents request floods (60 req/min); `/api/question` is restricted to 20 req/min.
- [x] **Strict $jsonSchema Validation:** MongoDB database-level schemas reject malformed documents on `memories` and `attempts` with `validationLevel: 'strict'`.
- [x] **Strict DOM Safety:** All frontend code in `public/app.js` strictly manipulates DOM text nodes via `textContent` (zero `innerHTML` on user or database content).
- [x] **Secrets Isolation:** `.env` is strictly excluded by `.gitignore`; `.env.example` contains only empty template keys.

---

## ⚡ 8. Performance & Scalability Notes

* **Connection Pooling:** Single shared `MongoClient` with `maxPoolSize: 20` and `serverSelectionTimeoutMS: 5000` eliminates connection churn.
* **Vector Projection Optimization:** List queries (`GET /api/memories`) use projections `{ embedding: 0 }` to avoid transmitting megabytes of vector float arrays across the network.
* **In-Memory Embedding LRU Cache:** 500-slot LRU cache avoids duplicate embedding API calls for identical subject/topic query phrases.
* **Parallel Hybrid Retrieval:** Executes `$vectorSearch` and exact topic lookup concurrently using `Promise.all`.
* **Stateless Application Server:** No sessions or student state stored in Node.js process memory; horizontal scaling behind a round-robin load balancer requires zero sticky sessions.
* **Design Note on Sharding (Scale Out):**
  > *In a massive production deployment with millions of students, the `memories`, `attempts`, and `topic_stats` collections would be sharded using a hashed shard key on `{ ownerId: "hashed" }`. Because every query in Study Buddy contains `ownerId`, all operations would be targeted single-shard queries, preventing scatter-gather overhead across the cluster.*

---

## 🎬 9. Live Demo Script (4-Minute Presentation Flow)

| Step | Action on Screen | Spoken Explanation |
| :--- | :--- | :--- |
| **1. Baseline State** | Open app, switch to **"Ravi (Day 1 - Blank Slate)"**. Notice 0 memories in Tab 2. | *"Ravi is on Day 1. The AI has no prior memories. When he requests a question on SQL Joins, it generates a standard Medium diagnostic question."* |
| **2. Making Mistakes** | Answer incorrectly twice on DBMS SQL Joins. | *"Ravi submits two incorrect answers. Rule A triggers atomically in MongoDB: a new weakness memory is formed with strength 0.5 and a 30-day TTL expiry."* |
| **3. Visible Adaptation** | Request a new question on SQL Joins in Session 2. | *"Notice what happened! The difficulty dropped to EASY, the explanation includes an intuitive real-world analogy, and the 'Why this question' box explicitly shows the memory recalled from Atlas."* |
| **4. Student Sovereignty** | Navigate to Tab 2 (Cognitive Memory). Click **"✏️ Correct"** on the memory. | *"The student has full agency. We click Correct to explain that Ravi now understands joins. The old weakness is marked superseded, wrong counters are reset, and a strength memory is created."* |
| **5. The Difficult Case (TTL Expiry)** | Click **"⚡ Toggle Cram Mode"** (or call `/api/demo/expiring-memory`). | *"For exam prep, Ravi sets a 120-second Cram Mode memory. Using MongoDB's native TTL index on expiresAt, the database automatically purges this document when the timer expires without any server cron jobs."* |
| **6. Visual Progress** | Navigate to Tab 3 (Progress). | *"Our MongoDB aggregation pipeline computes accuracy per topic over time, rendered cleanly on Chart.js."* |

---

## 🔍 10. Honest Limitations & Trade-Offs

1. **Authentication:** The current system uses `x-student-id` header-based profile separation for frictionless hackathon demonstration. Production systems would require cryptographic JWTs or session cookies.
2. **Local Embedding Fallback:** When an external embedding API key is absent, the system uses deterministic normalized vector generation. While mathematically sound for local cosine similarity testing, production systems require hosted models like `text-embedding-3-small` or Voyage AI.
3. **Atlas Vector Search Sync Window:** MongoDB Atlas indexes vector embeddings asynchronously. While typically under 1–2 seconds, our parallel hybrid retrieval architecture ensures that brand-new memories are immediately captured via exact topic lookup even before Vector Search finishes indexing.

---

## 📊 11. Evidence & Evaluation

### 11A. Quality Evaluation (`scripts/evaluate.js`)
Demonstrates that the memory-driven policy detects recurring errors, adapts difficulty to foundational scaffolding, and produces significantly higher recovery on vulnerable topics (+46.7% accuracy boost on weak topics) compared to a random baseline tutor. Run via:
```bash
npm run evaluate
```

### 11B. High-Concurrency Stress Test (`scripts/stresstest.js`)
The stress test in Section 11B evaluates system throughput, connection pooling resilience (`maxPoolSize: 50`, `maxIdleTimeMS: 60000`), event-loop delay, concurrency correctness, and failure injection. Results are automatically published to [`docs/stress-test-results.md`](docs/stress-test-results.md). Run via:
```bash
npm run stress:quick    # Quick evaluation of S1-S7 at 1/3 duration (~75s)
npm run stress          # Full load benchmark ramps
npm run stress:soak     # Soak mode with 5-minute memory and event-loop monitoring
```

---

## 🛡️ 12. Stress & Resilience Engineering

Study Buddy incorporates an honest, production-conscious resilience and stress testing harness (`scripts/stresstest.js`) designed to observe system behavior under extreme load, high concurrency, simulated external failures, and deliberate abuse.

### Safety Invariants (`STRESS_MODE`)
- **Database Isolation:** When `STRESS_MODE=true`, the server connects to an isolated `study_buddy_stress` database, guaranteeing demo and production records are never touched.
- **Cost Protection:** AI question generation uses curated question banks wrapped in the same `withTimeout` (15s) and retry wrappers; embedding generation uses deterministic vector hashing to avoid third-party API charges.
- **Fail-Safe Invariant:** When `STRESS_MODE=false`, all simulation flags (`FAIL_EMBEDDING`, `FAIL_AI`, `DELAY_AI_MS`), bypass headers, and test routes are strictly disabled and rejected (verified by unit test `tests/stressModeInvariants.test.js`).

### Summary of Benchmark Results (Atlas M0 Free Tier)

| Scenario | Tested Conditions | Observed Outcome & Verdict | Key Architectural Insight |
| :--- | :--- | :--- | :--- |
| **S1: Health Baseline** | `GET /api/health`, 20 conns, 10s | 87 req/s, p50: 105ms, p95: 793ms, 0 errors | Real `ping: 1` command to remote Atlas cloud over WAN latency. |
| **S2: Read Path Ramp** | `GET /api/memories` at 10..200 conns | Knee at 10 conns (p95: 633ms, 0% errors) | Optimized with compound index `{ ownerId: 1, createdAt: -1 }` to eliminate in-memory sorting. |
| **S3: Question Ramp** | `POST /api/question` at 5..40 conns | 26 req/s at 20 conns, 0% errors | Exercised AI timeout and retry wrappers with memory retrieval. |
| **S4: Write Path** | `POST /api/answer` at 10, 25, 50 conns | **Zero 5xx errors across all steps** | Safe, persistent writing of attempt records and stats. |
| **S5: Concurrency** | 50 concurrent wrong, 50 correct, 20 corrections | **100% exact atomic updates** | Handled with atomic `$inc` and unique partial indexes (`code 11000` retry). |
| **S6: Abuse Limits** | Rapid flood, 10kb body, invalid inputs, injection | **100% expected status codes** | 429 on rate limit flood, 413 on oversized body, 401 on missing auth, 400 on operator injection. |
| **S7: Failure Injection**| `failEmbedding`, `failAi`, `delayAiMs=20000` | **100% graceful degradation** | Degraded mode returns 200 with fallback questions within 15.5s; health p95 remained under 150ms. |

### Performance Tuning Applied
1. **Connection Pool Expansion (`MONGO_MAX_POOL: 20 -> 50`):** Reduces Atlas connection wait time under concurrent bursts.
2. **Compound Index on Memory Reads (`{ ownerId: 1, createdAt: -1 }`):** Eliminates in-memory sorting on paginated history reads.
3. **Response Projection in Memory List (`{ embedding: 0, evidence: 0 }`):** Shrinks memory payload size over WAN.

### Honest Limitations
> **These benchmark measurements evaluate backend and database behavior, concurrency control, and failure fallbacks under simulated conditions. These are not production capacity claims.**

1. **Single Node.js Process:** Run against a single instance on a local development workstation.
2. **Network Round-Trip Latency:** All pings and queries transit WAN loop to MongoDB Atlas M0 Free Tier (baseline ~100–150ms roundtrip).
3. **Deterministic Vectors:** Synthetic embedding vectors carry no semantic meaning; retrieval quality is measured separately in Section 11A.
4. **Atlas M0 Throttles:** Free-tier clusters enforce hardware and connection constraints; production deployments should utilize Atlas M10+ dedicated clusters.

### How to Run Stress Tests Locally
```bash
# 1. Enable STRESS_MODE in your .env
STRESS_MODE=true

# 2. Setup the isolated stress collections and indexes
npm run setup

# 3. Start the Study Buddy server
npm start

# 4. In a separate terminal, run the benchmark
npm run stress:quick
```

