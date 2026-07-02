# Database Design Review

## Overview

The schema is normalized around tenant ownership (`organizations` -> `projects`), execution boundaries (`queues` -> `jobs` -> `job_executions`), retry behavior (`retry_policies`), worker liveness (`workers` and `worker_heartbeats`), auditability (`job_logs`), scheduling (`scheduled_jobs`), and permanent failure inspection (`dead_letter_queue`).

Soft delete is used only for long-lived tenant/configuration records where audit history should survive account or project deactivation: users, organizations, projects, and queues. Jobs, executions, logs, heartbeats, and DLQ entries use immutable lifecycle states/timestamps instead.

## Foreign Keys And Cascades

- Organization membership and refresh tokens cascade when their owning user or organization is deleted.
- Projects cascade from organizations because projects are tenant-scoped.
- Queues, retry policies, workers, jobs, scheduled jobs, and DLQ entries cascade from projects.
- Job executions and logs cascade from jobs.
- Worker references on jobs/executions use `SET NULL` so historical execution records survive worker removal.
- Retry policy references on queues/jobs/scheduled jobs use `SET NULL` so jobs remain inspectable if a policy is retired.
- Creator references use `SET NULL` so project/job history survives user deletion.

## Index Explanation

### Users

- `users_email_key`: enforces one account per email and supports login lookup.
- `users_email_idx`: makes email lookups explicit for auth paths; redundant with the unique index and can be removed later if desired.
- `users_deletedAt_idx`: supports active/deactivated user administration screens.

### Organizations

- `organizations_slug_key`: enforces globally unique organization slugs.
- `organizations_slug_idx`: supports slug lookup; redundant with the unique index and can be removed later if desired.
- `organizations_deletedAt_idx`: supports filtering active versus soft-deleted organizations.

### Organization Memberships

- `organization_memberships_userId_organizationId_key`: prevents duplicate membership rows and supports user membership checks.
- `organization_memberships_organizationId_role_idx`: supports listing org members by role, especially owners/admin-style views.

### Refresh Tokens

- `refresh_tokens_tokenHash_key`: supports O(log n) refresh-token lookup and prevents storing duplicate token hashes.
- `refresh_tokens_userId_expiresAt_idx`: supports logout-all/session-management and cleanup by user.
- `refresh_tokens_revokedAt_expiresAt_idx`: supports cleanup of revoked/expired tokens.

### Projects

- `projects_organizationId_slug_key`: enforces unique project slugs per organization.
- `projects_organizationId_status_deletedAt_idx`: supports project filtering in an organization by active/archive/deleted state.
- `projects_createdById_idx`: supports audit queries for projects created by a user.

### Retry Policies

- `retry_policies_projectId_name_key`: enforces readable policy names per project.
- `retry_policies_projectId_strategy_idx`: supports filtering policies by project and strategy when configuring queues/jobs.

### Queues

- `queues_projectId_slug_key`: enforces unique queue slugs per project.
- `queues_projectId_status_deletedAt_idx`: supports queue filtering in project dashboards.
- `queues_retryPolicyId_idx`: supports finding queues affected by policy changes.
- `queues_status_deletedAt_priorityWeight_idx`: supports scheduler-side active queue scans ordered/grouped by priority.

### Jobs

- `jobs_queueId_state_availableAt_priority_createdAt_idx`: primary worker polling index for `WHERE queueId = ? AND state IN (...) AND availableAt <= now()` plus priority/age ordering.
- `jobs_state_availableAt_attempts_idx`: supports global retry lookup and scheduled eligibility scans.
- `jobs_projectId_state_createdAt_idx`: supports project-level job explorer filtering.
- `jobs_queueId_state_createdAt_idx`: supports queue-level job explorer filtering and queue statistics.
- `jobs_retryPolicyId_state_idx`: supports retry policy impact analysis and retry lookup.
- `jobs_claimedByWorkerId_state_lockedAt_idx`: supports abandoned job recovery for claimed/running jobs by worker and lock age.
- `jobs_batchId_idx`: supports batch job grouping and batch status aggregation.

### Job Executions

- `job_executions_jobId_attempt_key`: enforces one execution record per job attempt.
- `job_executions_jobId_startedAt_idx`: supports execution history for a job details page.
- `job_executions_workerId_status_startedAt_idx`: supports worker execution history and active execution counts.
- `job_executions_status_startedAt_idx`: supports metrics such as running/failed/succeeded executions over time.

### Workers

- `workers_projectId_status_lastHeartbeatAt_idx`: supports project-level worker status pages and stale worker detection.
- `workers_queueId_status_lastHeartbeatAt_idx`: supports queue-level worker capacity and heartbeat lookup.
- `workers_lastHeartbeatAt_status_idx`: supports global abandoned-worker recovery scans.

### Worker Heartbeats

- `worker_heartbeats_workerId_heartbeatAt_idx`: supports heartbeat history for a worker.
- `worker_heartbeats_heartbeatAt_status_idx`: supports liveness analytics and stale heartbeat scans.

### Job Logs

- `job_logs_jobId_createdAt_idx`: supports ordered logs on job details.
- `job_logs_executionId_createdAt_idx`: supports logs for a single execution attempt.
- `job_logs_level_createdAt_idx`: supports filtering errors/warnings for operations dashboards.

### Scheduled Jobs

- `scheduled_jobs_status_nextRunAt_idx`: primary scheduler scan for active scheduled jobs due to fire.
- `scheduled_jobs_queueId_status_nextRunAt_idx`: supports queue-scoped scheduled job polling and dashboard filtering.
- `scheduled_jobs_projectId_status_idx`: supports project-level scheduled job management.
- `scheduled_jobs_retryPolicyId_idx`: supports policy impact analysis for scheduled templates.

### Dead Letter Queue

- `dead_letter_queue_jobId_key`: enforces one DLQ entry per permanently failed job.
- `dead_letter_queue_queueId_failedAt_idx`: supports queue-scoped DLQ inspection.
- `dead_letter_queue_projectId_failedAt_idx`: supports project-scoped DLQ dashboards.
- `dead_letter_queue_reason_failedAt_idx`: supports failure-reason analytics and filtering.

## Design Review

### Normalization

- The schema is in good normalized shape: retry policy config is separated from queues/jobs, execution attempts are separated from jobs, heartbeat history is separated from workers, and DLQ stores failure records without duplicating full job state.
- `jobs.projectId` is technically derivable through `queueId`, but it is intentionally denormalized for high-value project filtering and metrics. The application must enforce that `jobs.projectId` matches the queue's project.
- `dead_letter_queue.projectId` and `queueId` are also derivable from `jobId`, but intentionally stored for fast operational filtering. The application must enforce consistency.

### Missing Or Future Indexes

- For very large production tables, add partial indexes for hot polling paths, for example active queued jobs only: `(queueId, availableAt, priority, createdAt) WHERE state IN ('QUEUED','RETRYING','SCHEDULED')`.
- Add descending indexes for timeline pages if query plans show reverse scans becoming expensive.
- Consider GIN indexes on JSONB payload/result fields only if product requirements include payload search.
- Consider time partitioning for `job_logs`, `worker_heartbeats`, and `job_executions` when write volume grows.

### Race Conditions To Handle In Application Code

- Worker claiming must run in a transaction using `FOR UPDATE SKIP LOCKED`, update job state/worker/lock, and insert the execution attempt atomically.
- Queue concurrency must be checked in the same transaction as job claiming to avoid oversubscription.
- Retry scheduling must atomically increment `attempts`, set `availableAt`, and transition state to `RETRYING` or `DEAD_LETTER`.
- Worker recovery should only release stale claimed/running jobs when `lockedAt` or `lastHeartbeatAt` is older than a configured timeout.
- Recurring scheduled jobs need an atomic `nextRunAt` advance to avoid duplicate emission by concurrent schedulers.
