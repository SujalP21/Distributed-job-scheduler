import { Router } from "express";
import { validateBody } from "@/common/middleware/validate";
import { createQueueSchema, updateQueueSchema } from "./queue.schemas";
import { QueueService } from "./queue.service";

export const createQueueRouter = (service = new QueueService()) => {
  const router = Router();

  router.post("/", validateBody(createQueueSchema), async (req, res, next) => {
    try {
      res.status(201).json(await service.createQueue(req.body));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:queueId", validateBody(updateQueueSchema), async (req, res, next) => {
    try {
      res.json(await service.updateQueue(String(req.params.queueId), req.body));
    } catch (error) {
      next(error);
    }
  });

  router.post("/:queueId/pause", async (req, res, next) => {
    try {
      res.json(await service.pauseQueue(String(req.params.queueId)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/:queueId/resume", async (req, res, next) => {
    try {
      res.json(await service.resumeQueue(String(req.params.queueId)));
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:queueId", async (req, res, next) => {
    try {
      res.json(await service.deleteQueue(String(req.params.queueId)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:queueId/statistics", async (req, res, next) => {
    try {
      res.json(await service.getStatistics(String(req.params.queueId)));
    } catch (error) {
      next(error);
    }
  });

  return router;
};
