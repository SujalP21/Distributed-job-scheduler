import { Router } from "express";

export const organizationsRouter = Router();

organizationsRouter.get("/", (_req, res) => {
  res.status(501).json({
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Organization management APIs begin after the identity foundation is approved"
    }
  });
});
