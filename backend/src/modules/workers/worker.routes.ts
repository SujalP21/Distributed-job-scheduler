import { Router } from "express";
import { validateBody } from "@/common/middleware/validate";
import {
  completeExecutionSchema,
  failExecutionSchema,
  heartbeatSchema,
  recoverAbandonedJobsSchema,
  registerWorkerSchema
} from "./worker.schemas";
import { WorkerService } from "./worker.service";

export const createWorkerRouter = (service = new WorkerService()) => {
  const router = Router();

  router.post("/register", validateBody(registerWorkerSchema), async (req, res, next) => {
    try {
      res.status(201).json(await service.registerWorker(req.body));
    } catch (error) {
      next(error);
    }
  });

  router.post("/:workerId/heartbeat", validateBody(heartbeatSchema), async (req, res, next) => {
    try {
      res.json(await service.heartbeat(String(req.params.workerId), req.body));
    } catch (error) {
      next(error);
    }
  });

  router.post("/:workerId/claim", async (req, res, next) => {
    try {
      const claimed = await service.claimNextJob(String(req.params.workerId));
      res.status(claimed ? 200 : 204).json(claimed ?? undefined);
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/executions/complete",
    validateBody(completeExecutionSchema),
    async (req, res, next) => {
      try {
        res.json(await service.completeExecution(req.body));
      } catch (error) {
        next(error);
      }
    }
  );

  router.post("/executions/fail", validateBody(failExecutionSchema), async (req, res, next) => {
    try {
      res.json(await service.failExecution(req.body));
    } catch (error) {
      next(error);
    }
  });

  router.post("/:workerId/shutdown", async (req, res, next) => {
    try {
      res.json(await service.gracefulShutdown(String(req.params.workerId)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/recover", validateBody(recoverAbandonedJobsSchema), async (req, res, next) => {
    try {
      res.json(await service.recoverAbandonedJobs(req.body));
    } catch (error) {
      next(error);
    }
  });

  return router;
};
