# Distributed Job Scheduler

Production-inspired distributed job scheduling platform for the backend engineering internship assignment.

## Phase 1 Status

This repository contains a production-inspired distributed job scheduler:

- Express + TypeScript backend
- Prisma PostgreSQL connectivity
- Redis connectivity
- Winston logging
- Environment validation with Zod
- Health check endpoint
- Vite + React + Material UI frontend shell
- Docker Compose for Postgres, Redis, backend, and frontend
- JWT auth with refresh tokens
- normalized scheduler schema and migrations
- atomic worker claiming with `FOR UPDATE SKIP LOCKED`
- queue/job/worker/retry APIs
- Prometheus metrics and structured observability
- MUI/Recharts operations dashboard

## Local Setup

```bash
cp .env.example .env
cd backend && npm install
cd ../frontend && npm install
```

## Run With Docker

```bash
docker compose up --build
```

Backend: `http://localhost:4000`

Frontend: `http://localhost:5173`

Health: `http://localhost:4000/health`

Metrics: `http://localhost:4000/metrics`

## Documentation

- [API Documentation](docs/API.md)
- [Database Design](docs/database-design.md)
- [ER Diagram](docs/er-diagram.md)
- [Core Scheduler Design](docs/phase4-core-scheduler.md)
- [Observability](OBSERVABILITY.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Tradeoffs](docs/TRADEOFFS.md)
