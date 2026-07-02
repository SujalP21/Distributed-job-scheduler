# Testing

## Commands

```bash
npm run build
npm test
npm run lint
```

## Coverage

- Zod environment parsing
- API/PostgreSQL/Redis/worker health responses
- registration and login
- refresh-token rotation and replay rejection
- request validation failures
- bearer-token middleware
- fixed, linear, and exponential retry calculations
- max-attempt exhaustion
- duplicate worker claim prevention
- 100-job/10-worker exactly-once stress scenario

## Integration Environment

The worker claim suite connects to PostgreSQL. Start infrastructure before running tests:

```bash
docker compose up -d postgres redis
```

## Submission Verification

The final submission runs the root build, test, and lint commands. Docker startup is smoke-tested through `/health` and the frontend root.

## Future Testing

- API authorization tests for organization/project boundaries
- recurring dispatcher tests
- container-level end-to-end tests in CI
- property-based retry scheduling tests
- failure injection around database disconnects and worker shutdown

---

[GitHub Repository](https://github.com/SujalP21/Distributed-job-scheduler)
