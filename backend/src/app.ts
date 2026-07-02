import cors from "cors";
import express from "express";
import helmet from "helmet";
import { errorHandler } from "@/common/middleware/error-handler";
import { notFoundHandler } from "@/common/middleware/not-found";
import { requestContextMiddleware } from "@/common/middleware/request-context";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { createAuthRouter } from "@/modules/auth/auth.routes";
import type { AuthService } from "@/modules/auth/auth.service";
import { createDeadLetterRouter } from "@/modules/dead-letter/dead-letter.routes";
import { healthRouter } from "@/modules/health/health.routes";
import { createJobRouter } from "@/modules/jobs/job.routes";
import { metricsRouter } from "@/modules/metrics/metrics.routes";
import { organizationsRouter } from "@/modules/organizations/organizations.routes";
import { createProjectRouter } from "@/modules/projects/project.routes";
import { createQueueRouter } from "@/modules/queues/queue.routes";
import { createWorkerRouter } from "@/modules/workers/worker.routes";

export type AppDependencies = {
  authService?: AuthService;
};

export const createApp = (dependencies: AppDependencies = {}) => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true
    })
  );
  app.use(requestContextMiddleware);
  app.use(express.json({ limit: "1mb" }));

  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      logger.http("request_completed", {
        http: {
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Date.now() - startedAt
        }
      });
    });
    next();
  });

  app.use("/health", healthRouter);
  app.use("/metrics", metricsRouter);
  app.use("/api/auth", createAuthRouter(dependencies.authService));
  app.use("/api/organizations", organizationsRouter);
  app.use("/api/projects", createProjectRouter());
  app.use("/api/queues", createQueueRouter());
  app.use("/api/jobs", createJobRouter());
  app.use("/api/workers", createWorkerRouter());
  app.use("/api/dead-letter", createDeadLetterRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
