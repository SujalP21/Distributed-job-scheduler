import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  LOG_LEVEL: z.enum(["error", "warn", "info", "http", "debug"]).default("info"),
  DATABASE_URL: z
    .string()
    .url()
    .default("postgresql://scheduler:scheduler@localhost:5432/scheduler?schema=public"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  JWT_ACCESS_SECRET: z
    .string()
    .min(24, "JWT_ACCESS_SECRET must be at least 24 characters")
    .default("local-development-access-secret"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12)
});

export const env = envSchema.parse(process.env);

export type AppEnv = typeof env;
