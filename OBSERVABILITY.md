# Observability

## Log Structure

The backend writes structured JSON logs through Winston. Every HTTP request receives:

- `requestId`: generated from `x-request-id` or a new UUID
- `correlationId`: generated from `x-correlation-id` or the request ID
- `timestamp`
- `level`
- `service`
- event-style `message`, such as `request_completed`, `job_claimed`, or `job_retry_scheduled`

HTTP logs include:

- `http.method`
- `http.path`
- `http.statusCode`
- `http.durationMs`

Worker and scheduler logs include:

- `worker.id`, `worker.queueId`, `worker.concurrency`
- `job.id`, `job.queueId`, `job.state`, `job.priority`, `job.attempt`
- `execution.id`, `execution.durationMs`
- retry and error metadata where relevant

Job execution events are also persisted in `job_logs` for user-facing history:

- claim
- execution start
- completion
- retry scheduling
- dead-letter movement
- abandoned claim recovery

## Metrics

The `/metrics` endpoint emits Prometheus-compatible text format.

Current metrics:

- `scheduler_uptime_seconds`
- `scheduler_jobs_total{state}`
- `scheduler_queues_total{status}`
- `scheduler_workers_total{status}`
- `scheduler_active_executions`
- `scheduler_dead_letter_jobs_total`
- `scheduler_queue_depth{queue_id,queue_slug,project_id,state}`
- `scheduler_queue_concurrency_limit{queue_id,queue_slug,project_id}`
- `scheduler_queue_workers_total{queue_id,queue_slug,project_id,status}`

These metrics cover queue health, retry pressure, active execution load, worker status, and DLQ growth.

## Health Checks

`GET /health` returns:

- API process status
- PostgreSQL connectivity and latency
- Redis connectivity and latency
- worker counts by status
- stale online worker count based on heartbeat age

The endpoint returns `200` when dependencies are healthy and `503` when a dependency check fails.

## Tracing Strategy

The current tracing strategy is correlation-ID based:

- incoming `x-request-id` is preserved when present
- incoming `x-correlation-id` is preserved when present
- both IDs are returned as response headers
- both IDs are added to every log written during the request async context

For a production deployment, the next step is OpenTelemetry:

- create spans for HTTP handlers, Prisma queries, Redis calls, and worker execution
- export traces to Tempo, Jaeger, Honeycomb, or Datadog
- propagate W3C `traceparent` headers alongside request/correlation IDs

## Monitoring Recommendations

Alert on:

- stale online workers greater than zero for more than two heartbeat windows
- DLQ count increasing over a short window
- high `RETRYING` job count
- queue depth growing while worker count is zero
- active executions at or above queue concurrency for sustained periods
- health endpoint returning degraded status

Dashboards should show:

- queue depth by state
- success/failure/retry trends
- active executions
- worker online/draining/offline counts
- DLQ entries by reason
- oldest queued job age per queue
