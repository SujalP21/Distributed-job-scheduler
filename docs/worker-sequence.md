# Worker Claim Sequence

```mermaid
sequenceDiagram
  participant Worker
  participant API
  participant Postgres

  Worker->>API: POST /api/workers/:id/claim
  API->>Postgres: BEGIN
  API->>Postgres: Lock eligible queue row FOR UPDATE SKIP LOCKED
  API->>Postgres: Count CLAIMED/RUNNING jobs for queue concurrency
  API->>Postgres: Select eligible job FOR UPDATE SKIP LOCKED
  API->>Postgres: Update job to CLAIMED, assign worker, increment attempt
  API->>Postgres: Insert job_execution attempt
  API->>Postgres: COMMIT
  API-->>Worker: Claimed job + execution id
  Worker->>API: mark RUNNING
  Worker->>API: complete or fail execution
```

The queue row lock serializes concurrency checks per queue. The job row lock prevents duplicate claims while allowing other workers to skip locked rows and continue polling.
