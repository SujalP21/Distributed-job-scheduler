# Design Tradeoffs

## PostgreSQL owns job claiming

The claim path uses PostgreSQL `FOR UPDATE SKIP LOCKED`. Redis is not involved
in ownership decisions.

This keeps queue concurrency checks, job selection, state transition, worker
assignment, attempt increment, and execution creation in one transaction. It
also avoids recovery logic for a Redis/PostgreSQL split-brain condition.

The cost is queue-row contention. Claims for one hot queue serialize while its
concurrency limit is checked. This is a reasonable assignment-scale choice.
At higher throughput, maintained counters, advisory locks, queue partitions,
or a dedicated broker would be evaluated with measured workloads.

## At-least-once delivery and idempotent handlers

The database prevents concurrent duplicate claims, but a worker can finish an
external side effect and fail before reporting completion. Recovery may then
run the job again. The scheduler therefore provides at-least-once execution,
not exactly-once side effects.

Production handlers should use an idempotency key based on job ID or a domain
operation ID. The `(jobId, attempt)` unique constraint protects execution
history but cannot make an external API or payment mutation idempotent.

## Redis is operational, not authoritative

Redis is connected, health-checked, and available for future caching or
coordination. Keeping it outside the correctness path reduces the number of
failure modes in the core scheduler.

## Normalized operational data

Mutable job state is kept on `jobs`; attempts, logs, heartbeat samples,
scheduled definitions, and permanent failures have separate tables. This
avoids repeated job configuration and preserves history.

Append-heavy tables will require retention or partitioning at production
scale. The current schema favors clarity and queryability over premature
partition management.

## Soft deletion is selective

Users, organizations, projects, and queues have `deletedAt` because restoring
or auditing those control-plane records can matter. Execution history, logs,
heartbeats, and DLQ entries are not soft-deleted. Retention jobs are a better
fit for those append-only records.

## Authentication before full authorization

JWT access tokens, refresh-token rotation, password hashing, and a protected
identity endpoint are implemented. Full organization/project authorization is
not applied to every scheduler route. Shipping partial policy checks would
create a false security boundary, so the limitation is explicit.

## Recurring jobs are definitions

The API stores cron expression, timezone, payload, status, and `nextRunAt`.
A dedicated dispatcher that atomically emits occurrences and advances
`nextRunAt` remains future work. Immediate, delayed, scheduled, and batch jobs
are directly executable today.

## Polling dashboard

The dashboard reads current state over REST. WebSockets were intentionally
left out because they are a bonus feature and would add connection lifecycle
and fan-out concerns. A production UI could poll on a short interval or add
server-sent events before adopting bidirectional WebSockets.

## Assignment deployment

The frontend container uses Vite preview to keep the repository small and easy
to inspect. A production deployment should serve the built assets through a
static host or Nginx/CDN and run migrations as a separate release step.

---

[GitHub Repository](https://github.com/SujalP21/Distributed-job-scheduler)
