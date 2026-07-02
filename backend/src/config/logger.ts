import winston from "winston";
import { getRequestContext } from "@/common/observability/request-context";
import { env } from "./env";

const withRequestContext = winston.format((info) => {
  const context = getRequestContext();

  if (context) {
    info.requestId = context.requestId;
    info.correlationId = context.correlationId;
  }

  return info;
});

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  defaultMeta: {
    service: "scheduler-api"
  },
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    withRequestContext(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});
