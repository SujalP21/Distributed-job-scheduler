import { createServer } from "node:http";
import { createApp } from "@/app";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { prisma } from "@/config/prisma";
import { redis } from "@/config/redis";

const app = createApp();
const server = createServer(app);

server.listen(env.PORT, () => {
  logger.info(`Scheduler API listening on port ${env.PORT}`);
});

const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}; shutting down`);

  server.close(async () => {
    await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
    process.exit(0);
  });
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
