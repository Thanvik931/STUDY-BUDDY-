# Study Buddy - Section 11B Stress Test and Resilience Report

> **Automated Benchmark and Resilience Evaluation**
> Generated on: `2026-10-10T13:38:48.382Z`
> Status: **FAILURES DETECTED ❌**

## 1. System & Test Environment

| Attribute | Details |
| :--- | :--- |
| **Node.js Version** | `v22.19.0` |
| **CPU Cores** | `12` |
| **Target URL** | `http://localhost:3000` |
| **Database Tier** | `Atlas M0` |
| **Isolated Test Database** | `study_buddy_stress` |
| **Observed Throughput Knee** | **10 connections (p95: 2127ms, error rate: 0.00%)** |

## 2. Load Scenarios Breakdown

### S1: Baseline (Health Check)

| Concurrency | Throughput (req/s) | Latency p50 | Latency p95 | Latency p99 | Errors | Non-2xx | Timeouts | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 20 | 47 | 284 ms | 1288 ms | 1288 ms | 0 | 0 | 0 | **FAIL** |

### S2: Read Path Ramp (`GET /api/memories?limit=20`)

| Concurrency | Throughput (req/s) | Latency p50 | Latency p95 | Latency p99 | Errors | Non-2xx | Timeouts | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 10 | 31 | 163 ms | 2127 ms | 2127 ms | 0 | 0 | 0 | **FAIL** |
| 25 | 29 | 843 ms | 2125 ms | 2125 ms | 0 | 0 | 0 | **FAIL** |
| 50 | 20 | 1773 ms | 2867 ms | 2867 ms | 0 | 0 | 0 | **FAIL** |
| 100 | 23 | 2872 ms | 3032 ms | 3032 ms | 0 | 0 | 0 | **PASS** |
| 200 | 0 | 0 ms | 0 ms | 0 ms | 0 | 0 | 0 | **PASS** |

### S3: Question Path Ramp (`POST /api/question`)

| Concurrency | Throughput (req/s) | Latency p50 | Latency p95 | Latency p99 | Errors | Non-2xx | Timeouts | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 5 | 0 | 0 ms | 0 ms | 0 ms | 0 | 0 | 0 | **PASS** |
| 10 | 14 | 369 ms | 1790 ms | 1790 ms | 0 | 0 | 0 | **FAIL** |
| 20 | 24 | 864 ms | 948 ms | 948 ms | 0 | 0 | 0 | **FAIL** |
| 40 | 13 | 1735 ms | 2453 ms | 2453 ms | 0 | 0 | 0 | **PASS** |

### S4: Write Path (`POST /api/answer`)

| Concurrency | Throughput (req/s) | Latency p50 | Latency p95 | Latency p99 | Errors | Non-2xx | Timeouts | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 10 | 12 | 760 ms | 1009 ms | 1009 ms | 0 | 0 | 0 | **PASS** |
| 25 | 7 | 2120 ms | 2497 ms | 2497 ms | 0 | 0 | 0 | **PASS** |
| 50 | 0 | 2394 ms | 2394 ms | 2394 ms | 0 | 0 | 0 | **PASS** |

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
| **delayAiMs = 20000** | Returns within 17s via fallback without hanging | elapsed=15.13s, degraded=true | **PASS** |
| **Concurrent Health Check** | p95 < 200ms, zero 5xx errors during faults | p95=48ms, 5xx=0 | **PASS** |

## 7. Honest Limitations & Operational Scope

> **Important Disclaimer:** These benchmark measurements evaluate backend and database behavior, concurrency control, and failure fallbacks under simulated conditions. **These are not production capacity claims.**

1. **Single Server Instance:** All tests were conducted against a single Node.js 20+ Express process on a single development machine.
2. **Local Network Loopback:** Client traffic originated over the local network loopback interface, eliminating WAN transit latency and public internet jitter.
3. **Fake Embeddings in Stress Mode:** In `STRESS_MODE`, numerical embeddings are generated deterministically via string hashing to avoid external API costs. Fake vectors carry no semantic meaning; retrieval accuracy cannot be evaluated from stress runs.
4. **No External Claude API Calls:** AI question generation during stress tests is served from local curated question banks through the same timeout and retry wrappers, exercising concurrency without incurring third-party LLM rate limits.
5. **Shared Free-Tier Database Limits:** Atlas M0 free tier has connection and IOPS throttles; production scale requires dedicated Atlas M10+ instances with sharded clusters.
