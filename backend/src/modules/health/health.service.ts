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
    workers: DependencyHealth & {
      online: number;
      draining: number;
      offline: number;
      staleOnline: number;
    };
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
  const [postgres, redisHealth, workerHealth] = await Promise.all([
    timed(async () => {
      await prisma.$queryRaw`SELECT 1`;
    }),
    timed(async () => {
      if (redis.status === "wait") {
        await redis.connect();
      }
      await redis.ping();
    }),
    timed(async () => {
      await prisma.worker.count();
    })
  ]);

  const [workerGroups, staleOnlineWorkers] =
    workerHealth.status === "ok"
      ? await Promise.all([
          prisma.worker.groupBy({
            by: ["status"],
            _count: { _all: true }
          }),
          prisma.worker.count({
            where: {
              status: "ONLINE",
              lastHeartbeatAt: {
                lt: new Date(Date.now() - 15_000)
              }
            }
          })
        ])
      : [[], 0];

  const workerStatus = {
    online: workerGroups.find((item) => item.status === "ONLINE")?._count._all ?? 0,
    draining: workerGroups.find((item) => item.status === "DRAINING")?._count._all ?? 0,
    offline: workerGroups.find((item) => item.status === "OFFLINE")?._count._all ?? 0,
    staleOnline: staleOnlineWorkers
  };

  const status =
    postgres.status === "ok" && redisHealth.status === "ok" && workerHealth.status === "ok"
      ? "ok"
      : "degraded";

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
      redis: redisHealth,
      workers: {
        ...workerHealth,
        ...workerStatus
      }
    }
  };
};
