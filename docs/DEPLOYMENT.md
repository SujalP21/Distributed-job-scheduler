# Deployment

## Docker Compose

```bash
git clone https://github.com/SujalP21/Distributed-job-scheduler.git
cd Distributed-job-scheduler
docker compose up --build -d
```

Compose reads the checked-in `.env.example` development defaults. Replace the example credentials through environment overrides or a secret manager outside local development.

Verify:

```bash
docker compose ps
curl http://localhost:4000/health
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

## Database Initialization

For a fresh environment, run migrations and seed data:

```bash
npx prisma migrate deploy --schema backend/prisma/schema.prisma
npm run db:seed --prefix backend
```

For production, migrations should run as a separate release step before API instances receive traffic.

## Secrets

Replace all example credentials. Store database, Redis, and JWT secrets in a platform secret manager. Do not use `.env.example` as a production secret source.

## Production Recommendations

- managed PostgreSQL with backups and connection limits
- managed Redis if caching/coordination is enabled
- TLS termination and restricted CORS
- health/readiness probes
- multiple API instances
- worker autoscaling based on queue depth
- Prometheus/Grafana and centralized logs
- retention/partitioning for logs, heartbeats, and executions

## Shutdown

```bash
docker compose down
```

Add `-v` only when intentionally deleting local database data.

---

[GitHub Repository](https://github.com/SujalP21/Distributed-job-scheduler)
