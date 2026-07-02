# Deployment Guide

## Local Docker

```bash
cp .env.example .env
docker compose up --build
```

Services:

- Backend: `http://localhost:4000`
- Frontend: `http://localhost:5173`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

## Database

Run migrations and seed data from `backend/`:

```bash
npm install
npx prisma migrate dev
npx prisma db seed
```

For production:

```bash
npx prisma migrate deploy
```

## Environment Variables

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`
- `JWT_ACCESS_EXPIRES_IN`
- `REFRESH_TOKEN_DAYS`
- `BCRYPT_SALT_ROUNDS`
- `CORS_ORIGIN`
- `LOG_LEVEL`

Use a long random `JWT_ACCESS_SECRET` in production.

## Production Notes

- Run at least two backend replicas behind a load balancer.
- Keep Postgres as the source of truth for job claiming.
- Use Redis for future cache/rate-limit enhancements, not correctness-critical locks.
- Configure log collection for JSON stdout.
- Scrape `/metrics` with Prometheus.
- Alert on `/health` degraded responses, stale workers, retry spikes, and DLQ growth.
