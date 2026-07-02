import { JobState, JobType, Prisma, ScheduledJobStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { AppError } from "@/common/errors/app-error";
import { prisma } from "@/config/prisma";
import { RetryService } from "@/modules/retry/retry.service";
import type {
  batchJobSchema,
  delayedJobSchema,
  immediateJobSchema,
  recurringJobSchema,
  scheduledJobSchema
} from "./job.schemas";
import type { z } from "zod";

type ImmediateJobInput = z.infer<typeof immediateJobSchema>;
type DelayedJobInput = z.infer<typeof delayedJobSchema>;
type ScheduledJobInput = z.infer<typeof scheduledJobSchema>;
type RecurringJobInput = z.infer<typeof recurringJobSchema>;
type BatchJobInput = z.infer<typeof batchJobSchema>;

const terminalStates: JobState[] = [JobState.COMPLETED, JobState.DEAD_LETTER, JobState.FAILED];

export class JobService {
  private readonly retryService: RetryService;

  constructor(private readonly db: PrismaClient = prisma) {
    this.retryService = new RetryService(db);
  }

  listJobs() {
    return this.db.job.findMany({
      orderBy: {
        createdAt: "desc"
      },
      take: 100,
      include: {
        queue: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        claimedByWorker: {
          select: {
            id: true,
            name: true,
            status: true
          }
        }
      }
    });
  }

  async createImmediateJob(input: ImmediateJobInput) {
    const { retryPolicyId } = await this.validateJobScope(
      input.projectId,
      input.queueId,
      input.retryPolicyId
    );

    return this.db.job.create({
      data: {
        projectId: input.projectId,
        queueId: input.queueId,
        retryPolicyId,
        createdById: input.createdById,
        type: JobType.IMMEDIATE,
        state: JobState.QUEUED,
        priority: input.priority,
        payload: input.payload as Prisma.InputJsonValue,
        maxAttempts: input.maxAttempts
      }
    });
  }

  async createDelayedJob(input: DelayedJobInput) {
    const scheduledFor = new Date(Date.now() + input.delaySeconds * 1000);
    const { retryPolicyId } = await this.validateJobScope(
      input.projectId,
      input.queueId,
      input.retryPolicyId
    );

    return this.db.job.create({
      data: {
        projectId: input.projectId,
        queueId: input.queueId,
        retryPolicyId,
        createdById: input.createdById,
        type: JobType.DELAYED,
        state: JobState.SCHEDULED,
        priority: input.priority,
        payload: input.payload as Prisma.InputJsonValue,
        maxAttempts: input.maxAttempts,
        scheduledFor,
        availableAt: scheduledFor
      }
    });
  }

  async createScheduledJob(input: ScheduledJobInput) {
    const scheduledFor = new Date(input.scheduledFor);
    const { retryPolicyId } = await this.validateJobScope(
      input.projectId,
      input.queueId,
      input.retryPolicyId
    );

    return this.db.job.create({
      data: {
        projectId: input.projectId,
        queueId: input.queueId,
        retryPolicyId,
        createdById: input.createdById,
        type: JobType.SCHEDULED,
        state: JobState.SCHEDULED,
        priority: input.priority,
        payload: input.payload as Prisma.InputJsonValue,
        maxAttempts: input.maxAttempts,
        scheduledFor,
        availableAt: scheduledFor
      }
    });
  }

  async createRecurringJob(input: RecurringJobInput) {
    const { retryPolicyId } = await this.validateJobScope(
      input.projectId,
      input.queueId,
      input.retryPolicyId
    );

    return this.db.scheduledJob.create({
      data: {
        projectId: input.projectId,
        queueId: input.queueId,
        retryPolicyId,
        name: input.name,
        jobType: JobType.RECURRING,
        cronExpression: input.cronExpression,
        timezone: input.timezone,
        payload: input.payload as Prisma.InputJsonValue,
        status: ScheduledJobStatus.ACTIVE,
        nextRunAt: new Date(input.nextRunAt)
      }
    });
  }

  async createBatchJob(input: BatchJobInput) {
    const { retryPolicyId } = await this.validateJobScope(
      input.projectId,
      input.queueId,
      input.retryPolicyId
    );
    const batchId = input.batchId ?? `batch_${randomUUID()}`;

    await this.db.job.createMany({
      data: input.jobs.map((payload) => ({
        projectId: input.projectId,
        queueId: input.queueId,
        retryPolicyId,
        createdById: input.createdById,
        batchId,
        type: JobType.BATCH,
        state: JobState.QUEUED,
        priority: input.priority,
        payload: payload as Prisma.InputJsonValue,
        maxAttempts: input.maxAttempts
      }))
    });

    return this.db.job.findMany({
      where: { batchId },
      orderBy: { createdAt: "asc" }
    });
  }

  async getStatus(jobId: string) {
    const job = await this.db.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        state: true,
        attempts: true,
        maxAttempts: true,
        availableAt: true,
        scheduledFor: true,
        lockedAt: true,
        completedAt: true,
        failedAt: true,
        errorMessage: true,
        claimedByWorkerId: true
      }
    });

    if (!job) {
      throw new AppError(404, "JOB_NOT_FOUND", "Job was not found");
    }

    return job;
  }

  async cancelJob(jobId: string) {
    const job = await this.db.job.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      throw new AppError(404, "JOB_NOT_FOUND", "Job was not found");
    }

    if (terminalStates.includes(job.state)) {
      throw new AppError(409, "JOB_ALREADY_TERMINAL", "Terminal jobs cannot be cancelled");
    }

    return this.db.job.update({
      where: { id: jobId },
      data: {
        state: JobState.FAILED,
        claimedByWorkerId: null,
        lockedAt: null,
        failedAt: new Date(),
        errorMessage: "Job cancelled by user request"
      }
    });
  }

  retryJob(jobId: string) {
    return this.retryService.retryJob(jobId);
  }

  async getHistory(jobId: string) {
    const job = await this.db.job.findUnique({
      where: { id: jobId },
      include: {
        executions: {
          orderBy: { startedAt: "asc" },
          include: {
            logs: {
              orderBy: { createdAt: "asc" }
            }
          }
        },
        logs: {
          orderBy: { createdAt: "asc" }
        },
        deadLetter: true
      }
    });

    if (!job) {
      throw new AppError(404, "JOB_NOT_FOUND", "Job was not found");
    }

    return job;
  }

  private async validateJobScope(projectId: string, queueId: string, retryPolicyId?: string) {
    const queue = await this.getQueueOrThrow(queueId, projectId);

    if (retryPolicyId) {
      await this.getRetryPolicyOrThrow(retryPolicyId, projectId);
    }

    return {
      queue,
      retryPolicyId: retryPolicyId ?? queue.retryPolicyId
    };
  }

  private async getQueueOrThrow(queueId: string, projectId: string) {
    const queue = await this.db.queue.findUnique({
      where: { id: queueId }
    });

    if (!queue || queue.deletedAt) {
      throw new AppError(404, "QUEUE_NOT_FOUND", "Queue was not found");
    }

    if (queue.projectId !== projectId) {
      throw new AppError(400, "QUEUE_PROJECT_MISMATCH", "Queue does not belong to the project");
    }

    return queue;
  }

  private async getRetryPolicyOrThrow(retryPolicyId: string, projectId: string) {
    const retryPolicy = await this.db.retryPolicy.findUnique({
      where: { id: retryPolicyId }
    });

    if (!retryPolicy) {
      throw new AppError(404, "RETRY_POLICY_NOT_FOUND", "Retry policy was not found");
    }

    if (retryPolicy.projectId !== projectId) {
      throw new AppError(
        400,
        "RETRY_POLICY_PROJECT_MISMATCH",
        "Retry policy does not belong to the project"
      );
    }

    return retryPolicy;
  }
}
