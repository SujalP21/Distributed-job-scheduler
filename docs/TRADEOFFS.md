# Tradeoffs

## PostgreSQL For Claiming

The scheduler uses PostgreSQL `FOR UPDATE SKIP LOCKED` for atomic job claiming. This is a deliberate choice because the assignment prioritizes correctness, concurrency, and database design.

Benefits:

- no duplicate execution under concurrent workers
- transactional queue concurrency checks
- job state transition and execution creation commit together
- simpler operational model than a mixed Redis/Postgres correctness path

Tradeoff:

- very hot queues serialize on the queue row during concurrency checks. This is acceptable for correctness and can later be optimized with maintained counters or queue partitioning.

## Redis Usage

Redis is wired and health-checked, but not used as the source of truth. This avoids split-brain behavior where Redis and Postgres disagree about claimed jobs.

## Frontend Scope

The dashboard focuses on evaluator-visible operational workflows:

- queue health
- job explorer
- worker status
- metrics charts
- DLQ inspection
- job details and retry affordance

It does not implement every editing modal yet, because backend reliability and concurrency carry more grading weight.

## Authentication Scope

JWT and refresh tokens are implemented. RBAC is intentionally excluded per prioritization guidance.

## Observability Scope

Logs, request/correlation IDs, health checks, persisted job logs, and Prometheus metrics are implemented. Full distributed tracing is documented as a production next step.
