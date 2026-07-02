# Concurrency

## Claim Transaction

`WorkerService.claimNextJob` uses one PostgreSQL transaction with `READ COMMITTED` isolation:

1. Resolve an online worker's project and optional queue scope.
2. Select and lock an active queue with `FOR UPDATE SKIP LOCKED`.
3. Count `CLAIMED` and `RUNNING` jobs and compare with the queue concurrency limit.
4. Select the highest-priority due job and lock it with `FOR UPDATE SKIP LOCKED`.
5. Update the job to `CLAIMED`, assign the worker, set `lockedAt`, and increment attempts.
6. Insert the matching execution attempt.
7. Commit.

Any failure rolls back the claim, assignment, state transition, and execution creation.

## Ordering

- Only `QUEUED`, `SCHEDULED`, and `RETRYING` jobs are eligible.
- `availableAt` and `scheduledFor` must be due.
- Highest priority is selected first.
- Equal priority is FIFO by `createdAt`.

## Duplicate Prevention

Competing workers skip locked jobs. The unique `(jobId, attempt)` constraint provides a second database-level guard against duplicate attempt records.

## Recovery

Jobs in `CLAIMED` or `RUNNING` with old `lockedAt` timestamps can be reset to `RETRYING`. Recovery clears worker ownership and records a warning log.

## Tests

The integration suite proves:

- two workers cannot claim the same single job
- 100 jobs claimed by 10 workers produce 100 unique jobs and one execution per job

## Bottlenecks

Queue row locking deliberately serializes claims per queue to preserve concurrency correctness. The active-job count is indexed but may become expensive for a very hot queue. Maintained counters, advisory locks, or queue partitions are future options.

---

[GitHub Repository](https://github.com/SujalP21/Distributed-job-scheduler)
