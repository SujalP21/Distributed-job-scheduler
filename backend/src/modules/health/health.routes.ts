import { Router } from "express";
import { getHealthReport } from "./health.service";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res, next) => {
  try {
    const report = await getHealthReport();
    res.status(report.status === "ok" ? 200 : 503).json(report);
  } catch (error) {
    next(error);
  }
});
