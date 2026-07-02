import { Router } from "express";
import { DeadLetterService } from "./dead-letter.service";

export const createDeadLetterRouter = (service = new DeadLetterService()) => {
  const router = Router();

  router.get("/", async (_req, res, next) => {
    try {
      res.json(await service.listEntries());
    } catch (error) {
      next(error);
    }
  });

  return router;
};
