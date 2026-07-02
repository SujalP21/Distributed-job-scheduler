# Observability

## Log Structure

Winston emits JSON containing timestamp, level, service, event message, request ID, correlation ID, HTTP fields, job fields, worker fields, execution fields, and structured errors where applicable.

Request context is propagated with `AsyncLocalStorage`. Incoming `x-request-id` and `x-correlation-id` headers are honored; otherwise IDs are generated.

## Application Logs

Worker registration, claims, heartbeat, execution start/completion/failure, retries, DLQ movement, shutdown, and abandoned-job recovery produce structured process logs. Important job transitions are also stored in `job_logs`.

## Metrics

`GET /metrics` returns Prometheus text metrics for:

- jobs by state
- workers by status
- queue depth and concurrency limits
- queue worker counts
- execution outcomes
- DLQ size

`GET /metrics/overview` provides dashboard JSON.

## Health

`GET /health` reports:

- API status and uptime
- PostgreSQL connectivity and latency
- Redis connectivity and latency
- online, draining, offline, and stale workers

## Tracing Strategy

The request/correlation ID model provides trace continuity today. A production deployment should add OpenTelemetry spans around HTTP requests, Prisma queries, claim transactions, worker execution, and retry scheduling.

## Monitoring Recommendations

- Alert on unavailable PostgreSQL/Redis
- Alert on stale online workers
- Alert on sustained queue depth and DLQ growth
- Track claim latency and execution failure rate
- Retain application logs centrally
- Scrape `/metrics` with Prometheus and visualize with Grafana

---

[GitHub Repository](https://github.com/SujalP21/Distributed-job-scheduler)
