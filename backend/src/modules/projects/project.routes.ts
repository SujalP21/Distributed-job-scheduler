import { Router } from "express";
import { z } from "zod";
import { validateBody } from "@/common/middleware/validate";
import { ProjectService } from "./project.service";

const createProjectSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1000).optional()
});

export const createProjectRouter = (service = new ProjectService()) => {
  const router = Router();

  router.get("/", async (_req, res, next) => {
    try {
      res.json(await service.listProjects());
    } catch (error) {
      next(error);
    }
  });

  router.post("/", validateBody(createProjectSchema), async (req, res, next) => {
    try {
      res.status(201).json(await service.createProject(req.body));
    } catch (error) {
      next(error);
    }
  });

  return router;
};
