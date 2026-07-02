import { Router } from "express";
import { ProjectService } from "./project.service";

export const createProjectRouter = (service = new ProjectService()) => {
  const router = Router();

  router.get("/", async (_req, res, next) => {
    try {
      res.json(await service.listProjects());
    } catch (error) {
      next(error);
    }
  });

  return router;
};
