# API Documentation

Base URL: `http://localhost:4000`

Responses use JSON and structured errors:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed"
  }
}
```

## Health And Metrics

- `GET /health` - API, Postgres, Redis, and worker health
- `GET /metrics` - Prometheus text metrics
- `GET /metrics/overview` - dashboard JSON metrics

## Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Register body:

```json
{
  "email": "admin@example.com",
  "name": "Admin User",
  "password": "Password123",
  "organizationName": "Acme Platform"
}
```

## Projects

- `GET /api/projects` - list active projects with counts

## Queues

- `GET /api/queues`
- `POST /api/queues`
- `PATCH /api/queues/:queueId`
- `POST /api/queues/:queueId/pause`
- `POST /api/queues/:queueId/resume`
- `DELETE /api/queues/:queueId`
- `GET /api/queues/:queueId/statistics`

Create queue body:

```json
{
  "projectId": "project_id",
  "name": "Critical Jobs",
  "slug": "critical",
  "concurrencyLimit": 10,
  "priorityWeight": 100
}
```

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

Immediate job body:

```json
{
  "projectId": "project_id",
  "queueId": "queue_id",
  "priority": 50,
  "payload": {
    "task": "send-email",
    "recipient": "user@example.com"
  },
  "maxAttempts": 3
}
```

Delayed job body adds:

```json
{
  "delaySeconds": 300
}
```

Recurring job body:

```json
{
  "projectId": "project_id",
  "queueId": "queue_id",
  "name": "Daily settlement",
  "cronExpression": "0 2 * * *",
  "timezone": "UTC",
  "payload": {
    "task": "settlement"
  },
  "nextRunAt": "2026-07-03T02:00:00.000Z"
}
```

## Workers

- `GET /api/workers`
- `POST /api/workers/register`
- `POST /api/workers/:workerId/heartbeat`
- `POST /api/workers/:workerId/claim`
- `POST /api/workers/:workerId/shutdown`
- `POST /api/workers/executions/complete`
- `POST /api/workers/executions/fail`
- `POST /api/workers/recover`

Claiming uses a single PostgreSQL transaction with `FOR UPDATE SKIP LOCKED`.

## Dead Letter Queue

- `GET /api/dead-letter` - list DLQ entries
- `POST /api/jobs/:jobId/retry` - remove from DLQ and requeue
