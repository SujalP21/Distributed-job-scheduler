# Distributed Job Scheduler

A PostgreSQL-backed distributed job scheduler with queue management, delayed and scheduled jobs, retry policies, worker heartbeats, dead-letter handling, authentication, observability, and an operations dashboard.

Repository: [github.com/SujalP21/Distributed-job-scheduler](https://github.com/SujalP21/Distributed-job-scheduler)

## Features

- Immediate, delayed, scheduled, recurring, and batch job APIs
- Atomic PostgreSQL job claiming with `FOR UPDATE SKIP LOCKED`
- Queue pause, resume, archive, concurrency limits, and priority weighting
- Fixed, linear, and exponential retry strategies
- Dead-letter queue for exhausted jobs
- Worker registration, polling, heartbeat, graceful shutdown, and abandoned-job recovery
- JWT access tokens and hashed refresh-token rotation
- PostgreSQL schema, migrations, indexes, and realistic seed data
- Structured JSON logging with request and correlation IDs
- Prometheus-compatible metrics and dependency health checks
- Material UI dashboard for organizations, projects, queues, jobs, workers, metrics, and DLQ inspection
- Integration test proving that concurrent workers do not execute the same job twice

## Architecture Overview

```mermaid
flowchart LR
    UI["React Operations UI"] --> API["Express API"]
    Worker["Worker Runner"] --> API
    API --> PG[("PostgreSQL")]
    API --> Redis[("Redis")]
    API --> Metrics["Prometheus /metrics"]
    PG --> Claim["Transactional Claiming\nFOR UPDATE SKIP LOCKED"]
```

PostgreSQL is the source of truth for queue state, job ownership, retries, and execution history. Redis is connected and monitored but is not part of the correctness path. This avoids split-brain job ownership between two data stores.

## Technology Stack

| Area               | Technology                                     |
| ------------------ | ---------------------------------------------- |
| Backend            | Node.js, Express, TypeScript, Zod              |
| Database           | PostgreSQL 16, Prisma ORM                      |
| Cache/coordination | Redis 7                                        |
| Frontend           | React, Vite, TypeScript, Material UI, Recharts |
| Authentication     | JWT, bcrypt, hashed refresh tokens             |
| Observability      | Winston JSON logs, Prometheus text metrics     |
| Testing            | Jest, Supertest, Prisma integration tests      |
| Runtime            | Docker Compose                                 |

## System Design

The scheduler is organized around projects. A project owns queues, retry policies, jobs, workers, scheduled definitions, execution records, logs, and DLQ entries.

A worker claim is one database transaction:

1. Validate that the worker is online and determine its project/queue scope.
2. Lock an eligible active queue row.
3. Check queue concurrency inside the transaction.
4. Select the highest-priority due job, FIFO within equal priority.
5. Lock the job with `FOR UPDATE SKIP LOCKED`.
6. Transition it to `CLAIMED`, assign the worker, and increment the attempt count.
7. Insert the execution record.
8. Commit all changes together.

See [Architecture](docs/ARCHITECTURE.md) and [Concurrency](docs/CONCURRENCY.md).

## Project Structure

```text
.
|-- backend/
|   |-- prisma/
|   |   |-- migrations/
|   |   |-- schema.prisma
|   |   `-- seed.ts
|   `-- src/
|       |-- common/
|       |-- config/
|       |-- modules/
|       `-- tests/
|-- frontend/
|   `-- src/
|       |-- components/
|       |-- services/
|       `-- types/
|-- docs/
|   |-- screenshots/
|   |-- ARCHITECTURE.md
|   |-- DATABASE-DESIGN.md
|   |-- CONCURRENCY.md
|   `-- OBSERVABILITY.md
|-- docker-compose.yml
`-- package.json
```

## Setup Instructions

Requirements:

- Node.js 20 or newer
- npm
- Docker Desktop with Docker Compose

```bash
git clone https://github.com/SujalP21/Distributed-job-scheduler.git
cd Distributed-job-scheduler
npm install
npm install --prefix backend
npm install --prefix frontend
```

## Environment Variables

Docker Compose reads the checked-in `.env.example` development defaults. For local backend development, copy `backend/.env.example` to `backend/.env` and replace the JWT secret.

| Variable                | Purpose                 | Local default                                                             |
| ----------------------- | ----------------------- | ------------------------------------------------------------------------- |
| `PORT`                  | API port                | `4000`                                                                    |
| `DATABASE_URL`          | PostgreSQL connection   | `postgresql://scheduler:scheduler@localhost:5432/scheduler?schema=public` |
| `REDIS_URL`             | Redis connection        | `redis://localhost:6379`                                                  |
| `CORS_ORIGIN`           | Allowed frontend origin | `http://localhost:5173`                                                   |
| `JWT_ACCESS_SECRET`     | JWT signing secret      | Set a strong local value                                                  |
| `JWT_ACCESS_EXPIRES_IN` | Access-token lifetime   | `15m`                                                                     |
| `REFRESH_TOKEN_DAYS`    | Refresh-token lifetime  | `30`                                                                      |
| `BCRYPT_SALT_ROUNDS`    | Password hashing cost   | `12`                                                                      |
| `VITE_API_URL`          | Frontend API base URL   | `http://localhost:4000`                                                   |

Do not commit real secrets.

## Docker

The fastest complete startup is:

```bash
docker compose up --build -d
```

Services:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Health: `http://localhost:4000/health`
- Metrics: `http://localhost:4000/metrics`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

Stop the stack with:

```bash
docker compose down
```

## Running Locally

Start infrastructure:

```bash
docker compose up -d postgres redis
```

Create the local backend environment file:

```bash
cp backend/.env.example backend/.env
```

Apply migrations and seed:

```bash
npm run prisma:generate --prefix backend
npx prisma migrate dev --schema backend/prisma/schema.prisma
npm run db:seed --prefix backend
```

Run the applications in separate terminals:

```bash
npm run dev --prefix backend
npm run dev --prefix frontend
```

## Authentication

Registration creates a user and initial organization owner membership. Passwords are hashed with bcrypt. Access tokens are short-lived JWTs. Refresh tokens are random values stored only as hashes, with expiry and revocation timestamps.

Seed account:

```text
Email: admin@scheduler.dev
Password: Password123
```

This credential is for local demonstration only.

## API Overview

Main route groups:

- `/api/auth` - register, login, refresh, logout, current user
- `/api/organizations` - list and create organizations
- `/api/projects` - list and create projects
- `/api/queues` - queue lifecycle and statistics
- `/api/jobs` - create, inspect, cancel, and retry jobs
- `/api/workers` - registration, claim, heartbeat, completion, failure, shutdown, recovery
- `/api/dead-letter` - inspect permanent failures
- `/health` - API and dependency health
- `/metrics` - Prometheus metrics

See [API Documentation](docs/API.md).

## Worker Lifecycle

Workers register with a project and optional queue scope. They repeatedly claim work until local concurrency is full, execute jobs, report completion/failure, and send heartbeats. Graceful shutdown moves the worker to `DRAINING`. Recovery releases claims whose lock age exceeds the configured threshold.

## Queue Lifecycle

Queues begin in `ACTIVE`, may be moved to `PAUSED`, resumed to `ACTIVE`, or soft-deleted as `ARCHIVED`. Workers only claim from active, non-deleted queues. Each queue defines a concurrency limit and priority weight.

## Retry Strategy

- Fixed: `baseDelaySeconds`
- Linear: `baseDelaySeconds * attempts`
- Exponential: `baseDelaySeconds * 2^(attempts - 1)`

Delays are capped by `maxDelaySeconds`. After `maxAttempts`, the job moves to `DEAD_LETTER`.

## Dead Letter Queue

The DLQ stores one permanent-failure entry per job, including reason, failure message, payload snapshot, project, queue, and timestamp. Manual retry removes the DLQ record and returns the job to the queue.

## Concurrency Design

Claiming uses PostgreSQL row locking and `SKIP LOCKED`, allowing workers to poll concurrently without waiting on jobs already being claimed. Queue concurrency validation, job state transition, worker assignment, attempt increment, and execution creation are part of the same transaction.

The stress test claims 100 jobs with 10 concurrent workers and verifies one execution per job.

## Database Design

The schema separates configuration, mutable job state, immutable execution history, liveness history, logs, scheduled definitions, and permanent failures. Foreign keys and cascade behavior preserve operational history where appropriate. Composite indexes cover polling, project/queue filtering, retries, heartbeat recovery, scheduled jobs, execution history, and DLQ inspection.

See [Database Design](docs/DATABASE-DESIGN.md) and [ER Diagram](docs/ER-DIAGRAM.md).

## Testing

```bash
npm run build
npm test
npm run lint
```

The test suite covers:

- environment validation
- health responses
- registration, login, refresh-token rotation, validation, and protected middleware
- fixed, linear, and exponential retry calculations
- duplicate-claim prevention
- 100-job/10-worker exactly-once stress scenario

See [Testing](docs/TESTING.md).

## Observability

Requests carry request and correlation IDs. Winston emits structured JSON logs. Worker lifecycle and job execution transitions produce application logs and persisted job logs. `/metrics` exposes Prometheus-compatible job, queue, execution, and worker metrics. `/health` checks API, PostgreSQL, Redis, and worker status.

See [Observability](docs/OBSERVABILITY.md).

## Screenshots

| Dashboard                                       | Create Job                                        |
| ----------------------------------------------- | ------------------------------------------------- |
| ![Dashboard](docs/screenshots/05-dashboard.png) | ![Create Job](docs/screenshots/08-create-job.png) |

| Queue Management                                              | Metrics                                     |
| ------------------------------------------------------------- | ------------------------------------------- |
| ![Queue Management](docs/screenshots/07-queue-management.png) | ![Metrics](docs/screenshots/13-metrics.png) |

All screenshots are available in [`docs/screenshots`](docs/screenshots).

## Known Limitations

- Scheduler APIs have authentication support but do not yet enforce full organization/project authorization on every route.
- Recurring job definitions are stored, but a dedicated scheduler dispatcher that emits each occurrence is a future component.
- Redis is monitored but not used for distributed coordination.
- Queue concurrency uses an active-job count inside the claim transaction; very high-volume queues may need maintained counters or partitioning.
- The frontend bundle includes Material UI and Recharts and currently exceeds Vite's default chunk warning threshold.
- Metrics are cumulative/current-state metrics rather than a full historical analytics store.

## Future Improvements

- Organization/project RBAC enforcement on all scheduler routes
- Scheduled/recurring dispatcher with atomic `nextRunAt` advancement
- OpenTelemetry traces and exemplars
- Rate limiting and audit events for administrative actions
- Partial polling indexes and table partitioning for very large workloads
- Worker authentication and signed completion tokens
- Frontend route-based code splitting
- Kubernetes manifests and automated CI/CD

## GitHub Repository

[SujalP21/Distributed-job-scheduler](https://github.com/SujalP21/Distributed-job-scheduler)

## License

MIT License. See [LICENSE](LICENSE).

---

Distributed Job Scheduler - [GitHub Repository](https://github.com/SujalP21/Distributed-job-scheduler)
