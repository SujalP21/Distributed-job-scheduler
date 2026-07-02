# Database Design

## Model boundaries

The schema is normalized around four concerns:

1. Identity and tenancy: users, organizations, memberships, projects, and refresh tokens.
2. Scheduler configuration: queues, retry policies, and scheduled job definitions.
3. Runtime state: jobs and workers.
4. History: executions, heartbeats, logs, and dead-letter entries.

Mutable job status lives in `jobs`. Each attempt is recorded in
`job_executions`; process output belongs in `job_logs`. This keeps the polling
row compact while preserving operational history.

## Keys and constraints

- CUID strings are application-generated primary keys.
- User email, organization slug, refresh-token hash, and DLQ job ID are unique.
- Project and queue slugs are unique inside their parent scope.
- Organization membership is unique for `(userId, organizationId)`.
- Retry policy names are unique inside a project.
- Execution attempts are unique for `(jobId, attempt)`.
- Foreign keys prevent cross-record orphans.

Project/queue ownership is also checked in service code when creating jobs and
workers because independent foreign keys cannot express that both selected
records belong to the same project.

## Cascading behavior

- Deleting an organization cascades to memberships and projects.
- Deleting a project cascades to its scheduler records.
- Deleting a queue cascades to jobs and queue-owned history.
- Deleting a job cascades to attempts, logs, and its DLQ entry.
- Optional creator, worker, and retry-policy references use `SET NULL` so
  operational records remain readable.

Control-plane deletion is normally soft deletion. Physical cascades mainly
protect explicit administrative cleanup and test isolation.

## Indexes

| Index                                                    | Query supported                     | Reason                                                                        |
| -------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| `jobs(queueId, state, availableAt, priority, createdAt)` | Worker polling                      | Narrows to one queue and eligible states/times before priority/FIFO ordering. |
| `jobs(state, availableAt, attempts)`                     | Retry/due-job scans                 | Finds retryable jobs without scanning completed history.                      |
| `jobs(projectId, state, createdAt)`                      | Project job explorer                | Supports project filtering and recent-first state views.                      |
| `jobs(queueId, state, createdAt)`                        | Queue job explorer and active count | Supports queue filtering and concurrency checks.                              |
| `jobs(retryPolicyId, state)`                             | Retry policy inspection             | Locates affected active/failed jobs.                                          |
| `jobs(claimedByWorkerId, state, lockedAt)`               | Abandoned claim recovery            | Finds stale claimed/running work by worker and lock age.                      |
| `jobs(batchId)`                                          | Batch lookup                        | Groups jobs created in one batch request.                                     |
| `queues(projectId, status, deletedAt)`                   | Project queue listing               | Excludes archived/deleted queues efficiently.                                 |
| `queues(status, deletedAt, priorityWeight)`              | Queue selection                     | Supports active queue filtering and priority weighting.                       |
| `workers(projectId, status, lastHeartbeatAt)`            | Project worker status               | Lists live or stale workers in a project.                                     |
| `workers(queueId, status, lastHeartbeatAt)`              | Queue worker status                 | Finds workers assigned to a queue.                                            |
| `workers(lastHeartbeatAt, status)`                       | Liveness sweep                      | Locates workers that should be marked stale/offline.                          |
| `worker_heartbeats(workerId, heartbeatAt)`               | Worker heartbeat history            | Reads recent samples in time order.                                           |
| `scheduled_jobs(status, nextRunAt)`                      | Scheduler polling                   | Finds active definitions due to emit a job.                                   |
| `scheduled_jobs(queueId, status, nextRunAt)`             | Queue-scoped schedules              | Supports queue scheduling views and dispatch.                                 |
| `job_executions(jobId, startedAt)`                       | Job history                         | Reads attempts chronologically.                                               |
| `job_executions(workerId, status, startedAt)`            | Worker execution history            | Supports worker diagnostics and active execution lookup.                      |
| `job_logs(jobId, createdAt)`                             | Job log stream                      | Reads logs in event order.                                                    |
| `dead_letter_queue(projectId, failedAt)`                 | Project DLQ                         | Lists recent permanent failures for a project.                                |
| `dead_letter_queue(queueId, failedAt)`                   | Queue DLQ                           | Filters permanent failures by queue.                                          |
| `dead_letter_queue(reason, failedAt)`                    | Failure analysis                    | Groups recent DLQ entries by reason.                                          |

PostgreSQL may still sort after filtering because Prisma's portable indexes do
not encode descending priority. At larger scale, a partial index limited to
eligible job states with descending priority would be considered from
`EXPLAIN ANALYZE` evidence.

## Normalization review

The design is in third normal form for core relational attributes. JSON is
limited to workload payloads, results, log metadata, and worker metadata where
the shape is intentionally job-specific.

`projectId` and `queueId` are both stored on jobs and DLQ entries. The project
value is derivable from the queue, but retaining it makes tenant filtering and
retention operations direct. Service validation prevents mismatched values.
This is a deliberate, controlled denormalization.

## Race conditions and controls

- Competing claims: job and queue rows are locked with `SKIP LOCKED`.
- Queue capacity: checked while the queue row is locked.
- Duplicate attempts: protected by `(jobId, attempt)`.
- Retry exhaustion: evaluated in the same failure transaction that records
  the attempt outcome and DLQ entry.
- Abandoned work: recovered by lock age; handlers must remain idempotent
  because completion acknowledgements can be lost.
- Recurring emission: the future dispatcher must lock each schedule while
  creating the occurrence and advancing `nextRunAt`.

---

[GitHub Repository](https://github.com/SujalP21/Distributed-job-scheduler)
