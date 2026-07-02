import { z } from "zod";

const payloadSchema = z.record(z.unknown());

const baseJobSchema = z.object({
  projectId: z.string().min(1),
  queueId: z.string().min(1),
  retryPolicyId: z.string().min(1).optional(),
  createdById: z.string().min(1).optional(),
  priority: z.number().int().min(0).max(1000).default(0),
  payload: payloadSchema,
  maxAttempts: z.number().int().positive().max(100).default(3)
});

export const immediateJobSchema = baseJobSchema;

export const delayedJobSchema = baseJobSchema.extend({
  delaySeconds: z.number().int().positive().max(31536000)
});

export const scheduledJobSchema = baseJobSchema.extend({
  scheduledFor: z.string().datetime()
});

export const recurringJobSchema = z.object({
  projectId: z.string().min(1),
  queueId: z.string().min(1),
  retryPolicyId: z.string().min(1).optional(),
  name: z.string().trim().min(2).max(160),
  cronExpression: z.string().trim().min(5).max(120),
  timezone: z.string().trim().min(2).max(80).default("UTC"),
  payload: payloadSchema,
  nextRunAt: z.string().datetime()
});

export const batchJobSchema = z.object({
  projectId: z.string().min(1),
  queueId: z.string().min(1),
  retryPolicyId: z.string().min(1).optional(),
  createdById: z.string().min(1).optional(),
  batchId: z.string().trim().min(2).max(160).optional(),
  priority: z.number().int().min(0).max(1000).default(0),
  maxAttempts: z.number().int().positive().max(100).default(3),
  jobs: z.array(payloadSchema).min(1).max(1000)
});
