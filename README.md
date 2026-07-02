# Distributed Job Scheduler

Production-inspired distributed job scheduling platform for the backend engineering internship assignment.

## Phase 1 Status

This repository currently contains the runtime foundation:

- Express + TypeScript backend
- Prisma PostgreSQL connectivity
- Redis connectivity
- Winston logging
- Environment validation with Zod
- Health check endpoint
- Vite + React + Material UI frontend shell
- Docker Compose for Postgres, Redis, backend, and frontend

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
