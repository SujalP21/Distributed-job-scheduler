import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { runWithRequestContext } from "@/common/observability/request-context";

const firstHeader = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

export const requestContextMiddleware: RequestHandler = (req, res, next) => {
  const requestId = firstHeader(req.headers["x-request-id"]) ?? randomUUID();
  const correlationId = firstHeader(req.headers["x-correlation-id"]) ?? requestId;

  res.setHeader("x-request-id", requestId);
  res.setHeader("x-correlation-id", correlationId);

  runWithRequestContext(
    {
      requestId,
      correlationId
    },
    next
  );
};
