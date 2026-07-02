# Phase 4 Core Scheduler Design

## Worker Claiming

Job claiming is implemented in `WorkerService.claimNextJob` as a single PostgreSQL transaction:

1. Find the online worker scope.
2. Lock one eligible active queue row with `FOR UPDATE SKIP LOCKED`.
3. Check queue concurrency by counting `CLAIMED` and `RUNNING` jobs for that queue.
4. Lock one eligible job row with `FOR UPDATE SKIP LOCKED`.
5. Update the job to `CLAIMED`, assign the worker, set `lockedAt`, and increment `attempts`.
6. Insert the matching `job_executions` attempt.
7. Commit both state changes together.

This prevents duplicate execution because competing workers skip locked job rows and cannot observe a partially claimed job.

## Ordering Rules

- Queue must be `ACTIVE` and not soft-deleted.
- Job state must be `QUEUED`, `SCHEDULED`, or `RETRYING`.
- `availableAt <= now()` must be true.
- `scheduledFor` must be null or due.
- `attempts < maxAttempts` must be true.
- Jobs order by `priority DESC, createdAt ASC`, giving highest priority first and FIFO within the same priority.

## Retry Behavior

- Fixed delay: always uses `baseDelaySeconds`.
- Linear backoff: `baseDelaySeconds * attempts`.
- Exponential backoff: `baseDelaySeconds * 2^(attempts - 1)`.
- Delay is capped by `maxDelaySeconds`.
- Exhausted jobs move to `DEAD_LETTER` and create/update a DLQ record.

## Complexity And Query Count

- Claim operation query count: one raw SQL claim statement plus one execution insert and one job fetch, all inside one transaction.
- Claim lookup complexity: `O(log n)` index seek on queue/job indexes, plus a small active-job count for the selected queue.
- Completion operation query count: one execution lookup, one execution update, one job update.
- Retry failure operation query count: one execution/job/policy lookup, one execution update, one job update, and optionally one DLQ upsert.

## Indexes Used

- `jobs_queueId_state_availableAt_priority_createdAt_idx`: main worker polling path.
- `jobs_state_availableAt_attempts_idx`: retry/scheduled availability scans.
- `jobs_claimedByWorkerId_state_lockedAt_idx`: abandoned claim recovery.
- `queues_status_deletedAt_priorityWeight_idx`: active queue discovery.
- `job_executions_jobId_attempt_key`: prevents duplicate attempt rows.
- `workers_projectId_status_lastHeartbeatAt_idx` and `workers_queueId_status_lastHeartbeatAt_idx`: worker liveness and queue capacity views.

## Potential Bottlenecks

- Queue concurrency uses `COUNT(*)` over active jobs. It is correct, but a very hot queue may eventually need a maintained counter or advisory-lock strategy.
- The queue row lock serializes claims per queue to keep concurrency correct. This favors correctness over maximum throughput.
- `job_logs`, `worker_heartbeats`, and `job_executions` will need retention or partitioning at high volume.
- JSON payload fields are not indexed; add GIN indexes only if payload search becomes a product requirement.
