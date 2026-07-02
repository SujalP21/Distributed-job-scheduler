import { z } from "zod";

export const registerWorkerSchema = z.object({
  projectId: z.string().min(1),
  queueId: z.string().min(1).optional(),
  name: z.string().trim().min(2).max(160),
  hostname: z.string().trim().max(255).optional(),
  concurrency: z.number().int().positive().max(1000).default(5),
  metadata: z.record(z.unknown()).optional()
});

export const heartbeatSchema = z.object({
  activeJobs: z.number().int().min(0).default(0),
  capacity: z.number().int().min(0).default(0),
  metadata: z.record(z.unknown()).optional()
});

export const completeExecutionSchema = z.object({
  jobId: z.string().min(1),
  executionId: z.string().min(1),
  result: z.record(z.unknown()).optional()
});

export const failExecutionSchema = z.object({
  jobId: z.string().min(1),
  executionId: z.string().min(1),
  errorMessage: z.string().trim().min(1).max(4000)
});

export const recoverAbandonedJobsSchema = z.object({
  olderThanSeconds: z.number().int().positive().max(86400).default(60)
});
