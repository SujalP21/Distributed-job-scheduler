import { Router } from "express";
import { getPrometheusMetrics } from "./metrics.service";
import { getMetricsOverview } from "./overview.service";

export const metricsRouter = Router();

metricsRouter.get("/overview", async (_req, res, next) => {
  try {
    res.json(await getMetricsOverview());
  } catch (error) {
    next(error);
  }
});

metricsRouter.get("/", async (_req, res, next) => {
  try {
    res.setHeader("content-type", "text/plain; version=0.0.4; charset=utf-8");
    res.send(await getPrometheusMetrics());
  } catch (error) {
    next(error);
  }
});
