import { Router } from "express";
import { validateBody } from "@/common/middleware/validate";
import {
  batchJobSchema,
  delayedJobSchema,
  immediateJobSchema,
  recurringJobSchema,
  scheduledJobSchema
} from "./job.schemas";
import { JobService } from "./job.service";

export const createJobRouter = (service = new JobService()) => {
  const router = Router();

  router.get("/", async (_req, res, next) => {
    try {
      res.json(await service.listJobs());
    } catch (error) {
      next(error);
    }
  });

  router.post("/immediate", validateBody(immediateJobSchema), async (req, res, next) => {
    try {
      res.status(201).json(await service.createImmediateJob(req.body));
    } catch (error) {
      next(error);
    }
  });

  router.post("/delayed", validateBody(delayedJobSchema), async (req, res, next) => {
    try {
      res.status(201).json(await service.createDelayedJob(req.body));
    } catch (error) {
      next(error);
    }
  });

  router.post("/scheduled", validateBody(scheduledJobSchema), async (req, res, next) => {
    try {
      res.status(201).json(await service.createScheduledJob(req.body));
    } catch (error) {
      next(error);
    }
  });

  router.post("/recurring", validateBody(recurringJobSchema), async (req, res, next) => {
    try {
      res.status(201).json(await service.createRecurringJob(req.body));
    } catch (error) {
      next(error);
    }
  });

  router.post("/batch", validateBody(batchJobSchema), async (req, res, next) => {
    try {
      res.status(201).json(await service.createBatchJob(req.body));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:jobId/status", async (req, res, next) => {
    try {
      res.json(await service.getStatus(req.params.jobId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/:jobId/cancel", async (req, res, next) => {
    try {
      res.json(await service.cancelJob(req.params.jobId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/:jobId/retry", async (req, res, next) => {
    try {
      res.json(await service.retryJob(req.params.jobId));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:jobId/history", async (req, res, next) => {
    try {
      res.json(await service.getHistory(req.params.jobId));
    } catch (error) {
      next(error);
    }
  });

  return router;
};
