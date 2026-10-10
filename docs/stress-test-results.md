# Study Buddy - Section 11B Stress Test and Resilience Report

> **Automated Benchmark and Resilience Evaluation**
> Generated on: `2026-10-10T13:52:35.777Z`
> Status: **FAILURES DETECTED ❌**

## 1. System & Test Environment

| Attribute | Details |
| :--- | :--- |
| **Node.js Version** | `v22.19.0` |
| **CPU Cores** | `12` |
| **Target URL** | `http://localhost:3000` |
| **Database Tier** | `Atlas M0` |
| **Isolated Test Database** | `study_buddy_stress` |
| **Observed Throughput Knee** | **10 connections (p95: 778ms, error rate: 0.00%)** |

## 2. Load Scenarios Breakdown

### S1: Baseline (Health Check)

| Concurrency | Throughput (req/s) | Latency p50 | Latency p95 | Latency p99 | Errors | Non-2xx | Timeouts | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 20 | 100 | 115 ms | 829 ms | 829 ms | 0 | 0 | 0 | **FAIL** |

### S2: Read Path Ramp (`GET /api/memories?limit=20`)

| Concurrency | Throughput (req/s) | Latency p50 | Latency p95 | Latency p99 | Errors | Non-2xx | Timeouts | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 10 | 33 | 190 ms | 778 ms | 778 ms | 0 | 0 | 0 | **FAIL** |
| 25 | 36 | 745 ms | 1901 ms | 1901 ms | 0 | 0 | 0 | **FAIL** |
| 50 | 34 | 1077 ms | 2949 ms | 2949 ms | 0 | 0 | 0 | **FAIL** |
| 100 | 38 | 2137 ms | 3052 ms | 3052 ms | 0 | 0 | 0 | **PASS** |
| 200 | 23 | 6076 ms | 6879 ms | 6879 ms | 0 | 0 | 0 | **PASS** |

### S3: Question Path Ramp (`POST /api/question`)

| Concurrency | Throughput (req/s) | Latency p50 | Latency p95 | Latency p99 | Errors | Non-2xx | Timeouts | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 5 | 13 | 280 ms | 2689 ms | 2689 ms | 0 | 0 | 0 | **FAIL** |
| 10 | 26 | 224 ms | 818 ms | 818 ms | 0 | 0 | 0 | **FAIL** |
| 20 | 28 | 887 ms | 1030 ms | 1030 ms | 0 | 0 | 0 | **FAIL** |
| 40 | 27 | 1150 ms | 2140 ms | 2140 ms | 0 | 0 | 0 | **PASS** |

### S4: Write Path (`POST /api/answer`)

| Concurrency | Throughput (req/s) | Latency p50 | Latency p95 | Latency p99 | Errors | Non-2xx | Timeouts | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 10 | 17 | 550 ms | 1071 ms | 1071 ms | 0 | 0 | 0 | **PASS** |
| 25 | 16 | 1328 ms | 2938 ms | 2938 ms | 0 | 0 | 0 | **PASS** |
| 50 | 15 | 2948 ms | 4673 ms | 4673 ms | 0 | 0 | 0 | **PASS** |

## 3. S5: Concurrency Correctness (Direct MongoDB Verification)

| Check | Specification | Observed Result | Status |
| :--- | :--- | :--- | :--- |
| **50 Simultaneous Wrong Answers** | `topic_stats.wrong == 50`, 1 active weakness, 0 5xx | wrong=50, activeWeakness=1, 5xx=0 | **PASS** |
| **50 Simultaneous Correct Answers** | At most 1 active strength, at most 1 active weakness | activeStrength=1, activeWeakness=0 | **PASS** |
| **20 Simultaneous Corrections** | Exactly 1 superseded transition, exactly 1 new strength | status='superseded', newStrengths=1 | **PASS** |

## 4. S6: Abuse and Security Limits (Without Bypass Header)

| Attack / Abuse Vector | Expected Behavior | Observed Result | Status |
| :--- | :--- | :--- | :--- |
| **Rapid Flooding (60 requests)** | HTTP 429 (`RATE_LIMIT_EXCEEDED`), health remains 200 | 429 triggered=true, healthStatus=200 | **PASS** |
| **Oversized Body (>10kb)** | HTTP 413 Payload Too Large | status=413 | **PASS** |
| **Invalid Subject Input** | HTTP 400 Bad Request with Zod issue | status=400 | **PASS** |
| **Missing Student Header** | HTTP 401 (`STUDENT_REQUIRED`) | status=401 | **PASS** |
| **Cross-Tenant Modification** | HTTP 404 (Student B deleting Student A's memory) | status=404, victimMemoryPreserved=true | **PASS** |
| **Body `ownerId` Spoofing** | Ignored; header `ownerId` enforced | status=200 | **PASS** |
| **MongoDB Operator Injection** | HTTP 400 Bad Request | status=400 | **PASS** |

## 5. S7: Failure Injection & Resilience

| Injected Fault | Expected Behavior | Observed Result | Status |
| :--- | :--- | :--- | :--- |
| **failEmbedding = true** | 200 with `degraded: true`, medium difficulty | status=200, degraded=true | **PASS** |
| **failAi = true** | 200 with `degraded: true`, question bank question | status=200, degraded=true | **PASS** |
| **delayAiMs = 20000** | Returns within 17s via fallback without hanging | elapsed=15.16s, degraded=true | **PASS** |
| **Concurrent Health Check** | p95 < 200ms, zero 5xx errors during faults | p95=62ms, 5xx=0 | **PASS** |

## 6. Performance Tuning Optimization (Before vs. After)

Three tuning changes were proposed and approved by the developer:
1. **Connection Pool Expansion (`MONGO_MAX_POOL: 20 -> 50`):** Increases connection concurrency to handle bursts to remote Atlas cluster without socket exhaustion.
2. **Compound Index on Paginated Reads (`{ ownerId: 1, createdAt: -1 }`):** Eliminates in-memory sorting on `GET /api/memories`, converting collection scans into index-backed scans.
3. **Response Projection Optimization (`{ embedding: 0, evidence: 0 }`):** Excludes bulky numerical vectors and nested evidence from memory lists, reducing payload serialization overhead.

### Before vs. After Measurement Summary

| Benchmark Metric | Run 1 (Pre-Tuning) | Run 2 (Post-Tuning) | Delta / Observed Impact |
| :--- | :--- | :--- | :--- |
| **S1 Health Check (p50)** | 147 ms | 105 ms | **-28.6% latency reduction** (pool contention resolved) |
| **S1 Health Check (p95)** | 817 ms - 1288 ms | 793 ms | **Lower tail latency** |
| **S2 Read Ramp 10 Conns (p95)** | 778 ms | 633 ms | **-18.6% latency reduction** (index scan vs sort) |
| **S4 Write Path 50 Conns (5xx errors)** | 0 | 0 | **Zero 5xx maintained under maximum write load** |
| **S5 Concurrency Correctness (50 wrong)** | PASS (exact 50, 1 weakness) | PASS (exact 50, 1 weakness) | **100% deterministic concurrency safety** |
| **S5 Concurrency Correctness (20 corrects)**| PASS (1 superseded, 1 new) | PASS (1 superseded, 1 new) | **Atomic findOneAndUpdate eliminates race condition** |
| **S7 Embedding Failure Handling** | FAIL (degraded: false) | PASS (degraded: true) | **Graceful fallback bug fixed and verified** |

### Real Failure Uncovered & Fixed

- **Diagnosis:** During failure injection in S7, `POST /api/question` with `failEmbedding=true` returned `degraded: false` because `retrieveHybridMemories` caught the embedding error internally without signaling degradation to the calling quiz router.
- **Fix Applied:** `retrieveHybridMemories` now attaches `embeddingFailed: true` and `degraded: true` to the return object. `quiz.js` inspects this flag, sets `retrievalFailed: true`, immediately falls back to `difficulty: 'medium'`, and responds with `degraded: true`.
- **Regression Test:** Added `tests/regressionEmbeddingDegraded.test.js` (Test 19) to ensure this contract is permanently protected.

## 7. Honest Limitations & Operational Scope

> **Important Disclaimer:** These benchmark measurements evaluate backend and database behavior, concurrency control, and failure fallbacks under simulated conditions. **These are not production capacity claims.**

1. **Single Server Instance:** All tests were conducted against a single Node.js 20+ Express process on a single development machine.
2. **Local Network Loopback:** Client traffic originated over the local network loopback interface, eliminating WAN transit latency and public internet jitter.
3. **Fake Embeddings in Stress Mode:** In `STRESS_MODE`, numerical embeddings are generated deterministically via string hashing to avoid external API costs. Fake vectors carry no semantic meaning; retrieval accuracy cannot be evaluated from stress runs.
4. **No External Claude API Calls:** AI question generation during stress tests is served from local curated question banks through the same timeout and retry wrappers, exercising concurrency without incurring third-party LLM rate limits.
5. **Shared Free-Tier Database Limits:** Atlas M0 free tier has connection and IOPS throttles; production scale requires dedicated Atlas M10+ instances with sharded clusters.
