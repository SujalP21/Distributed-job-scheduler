import { prisma } from "@/config/prisma";
import { redis } from "@/config/redis";

export type DependencyHealth = {
  status: "ok" | "unavailable";
  latencyMs: number;
  message?: string;
};

export type HealthReport = {
  status: "ok" | "degraded";
  uptimeSeconds: number;
  timestamp: string;
  dependencies: {
    api: DependencyHealth;
    postgres: DependencyHealth;
    redis: DependencyHealth;
  };
};

const timed = async (check: () => Promise<void>): Promise<DependencyHealth> => {
  const startedAt = Date.now();

  try {
    await check();
    return {
      status: "ok",
      latencyMs: Date.now() - startedAt
    };
  } catch (error) {
    return {
      status: "unavailable",
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "Unknown dependency error"
    };
  }
};

export const getHealthReport = async (): Promise<HealthReport> => {
  const [postgres, redisHealth] = await Promise.all([
    timed(async () => {
      await prisma.$queryRaw`SELECT 1`;
    }),
    timed(async () => {
      if (redis.status === "wait") {
        await redis.connect();
      }
      await redis.ping();
    })
  ]);

  const status = postgres.status === "ok" && redisHealth.status === "ok" ? "ok" : "degraded";

  return {
    status,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    dependencies: {
      api: {
        status: "ok",
        latencyMs: 0
      },
      postgres,
      redis: redisHealth
    }
  };
};
