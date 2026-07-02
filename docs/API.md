# API Reference

Local base URL: `http://localhost:4000`

The API accepts and returns JSON except for `GET /metrics`, which returns
Prometheus text format. Request bodies are validated with Zod. Validation and
domain failures use a consistent error envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": []
  },
  "requestId": "b1345548-7c70-4fb8-a088-41bdc89430a2"
}
```

Clients may send `x-request-id` and `x-correlation-id`. The server generates
missing values and returns them in response headers.

## Authentication

### Register

`POST /api/auth/register`

```json
{
  "email": "admin@acmepayments.dev",
  "name": "Acme Administrator",
  "password": "Password123",
  "organizationName": "Acme Payments"
}
```

Creates the user, organization, owner membership, access token, and refresh
token.

### Login

`POST /api/auth/login`

```json
{
  "email": "admin@scheduler.dev",
  "password": "Password123"
}
```

### Refresh

`POST /api/auth/refresh`

```json
{
  "refreshToken": "<refresh-token>"
}
```

Refresh tokens rotate on use. Reusing a revoked token is rejected.

### Logout and current user

- `POST /api/auth/logout` with `{ "refreshToken": "..." }`
- `GET /api/auth/me` with `Authorization: Bearer <access-token>`

The seed credential is intended for local review only.

## Organizations

- `GET /api/organizations`
- `POST /api/organizations`

```json
{
  "name": "Acme Payments",
  "slug": "acme-payments"
}
```

## Projects

- `GET /api/projects`
- `POST /api/projects`

```json
{
  "organizationId": "organization_id",
  "name": "Payment Platform",
  "slug": "payment-platform",
  "description": "Payment processing background workloads"
}
```

## Queues

- `GET /api/queues`
- `POST /api/queues`
- `PATCH /api/queues/:queueId`
- `POST /api/queues/:queueId/pause`
- `POST /api/queues/:queueId/resume`
- `DELETE /api/queues/:queueId`
- `GET /api/queues/:queueId/statistics`

Create queue:

```json
{
  "projectId": "project_id",
  "name": "Critical Payments",
  "slug": "critical-payments",
  "concurrencyLimit": 10,
  "priorityWeight": 100,
  "retryPolicyId": "retry_policy_id"
}
```

Queue deletion is a soft archive. Archived queues are excluded from worker
polling.

## Jobs

- `GET /api/jobs`
- `POST /api/jobs/immediate`
- `POST /api/jobs/delayed`
- `POST /api/jobs/scheduled`
- `POST /api/jobs/recurring`
- `POST /api/jobs/batch`
- `GET /api/jobs/:jobId/status`
- `POST /api/jobs/:jobId/cancel`
- `POST /api/jobs/:jobId/retry`
- `GET /api/jobs/:jobId/history`

Immediate job:

```json
{
  "projectId": "project_id",
  "queueId": "queue_id",
  "priority": 80,
  "payload": {
    "jobName": "Send Invoice Email",
    "invoiceId": "inv_10042",
    "recipient": "billing@acmepayments.dev"
  },
  "maxAttempts": 5
}
```

Delayed jobs add `delaySeconds`. Scheduled jobs add an ISO 8601
`scheduledFor`. Recurring definitions include `name`, `cronExpression`,
`timezone`, `payload`, and `nextRunAt`.

Batch creation accepts common queue/retry settings and a `jobs` array with up
to 1,000 payloads.

## Workers

- `GET /api/workers`
- `POST /api/workers/register`
- `POST /api/workers/:workerId/heartbeat`
- `POST /api/workers/:workerId/claim`
- `POST /api/workers/:workerId/shutdown`
- `POST /api/workers/executions/complete`
- `POST /api/workers/executions/fail`
- `POST /api/workers/recover`

Register worker:

```json
{
  "projectId": "project_id",
  "queueId": "queue_id",
  "name": "payments-worker-01",
  "hostname": "worker-01.internal",
  "concurrency": 8,
  "metadata": {
    "region": "local"
  }
}
```

A successful claim returns the job and execution attempt. No eligible work
returns HTTP `204`. Queue selection, concurrency validation, job locking,
assignment, state transition, and execution creation run in one PostgreSQL
transaction.

## Dead Letter Queue

- `GET /api/dead-letter`
- `POST /api/jobs/:jobId/retry`

Manual retry removes the DLQ entry and returns the job to an eligible state.

## Health and metrics

- `GET /health`
- `GET /metrics`
- `GET /metrics/overview`

Health includes API uptime, PostgreSQL and Redis connectivity, dependency
latency, and worker counts. Prometheus metrics cover queue depth, jobs by
state, workers by status, execution outcomes, and DLQ size.

## Current API limitations

List endpoints return bounded assignment-scale datasets and do not yet expose
uniform pagination, filtering, or sorting parameters. Authentication is
implemented, but scheduler routes do not yet enforce organization membership
on every request. These are documented production follow-ups rather than
hidden behind incomplete middleware.

---

[GitHub Repository](https://github.com/SujalP21/Distributed-job-scheduler)
