import { QueueStatus } from "@prisma/client";
import { z } from "zod";

export const createQueueSchema = z.object({
  projectId: z.string().min(1),
  retryPolicyId: z.string().min(1).optional(),
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(120),
  concurrencyLimit: z.number().int().positive().max(1000).default(5),
  priorityWeight: z.number().int().min(0).max(1000).default(0)
});

export const updateQueueSchema = z.object({
  retryPolicyId: z.string().min(1).nullable().optional(),
  name: z.string().trim().min(2).max(120).optional(),
  status: z.nativeEnum(QueueStatus).optional(),
  concurrencyLimit: z.number().int().positive().max(1000).optional(),
  priorityWeight: z.number().int().min(0).max(1000).optional()
});
