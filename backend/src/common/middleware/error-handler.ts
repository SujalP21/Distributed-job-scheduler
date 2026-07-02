import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "@/common/errors/app-error";
import { logger } from "@/config/logger";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: error.flatten()
      }
    });
    return;
  }

  if (error instanceof AppError) {
    logger.warn("request_failed", {
      error: {
        code: error.code,
        message: error.message
      },
      http: {
        statusCode: error.statusCode
      }
    });

    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message
      }
    });
    return;
  }

  logger.error("Unhandled request error", error);

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Unexpected server error"
    }
  });
};
