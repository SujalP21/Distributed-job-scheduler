process.env.DATABASE_URL ??=
  "postgresql://scheduler:scheduler@localhost:5432/scheduler?schema=public";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.JWT_ACCESS_SECRET ??= "local-development-access-secret";
