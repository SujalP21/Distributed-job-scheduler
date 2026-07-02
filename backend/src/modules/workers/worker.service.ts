import { ExecutionStatus, JobState, Prisma, QueueStatus, WorkerStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { AppError } from "@/common/errors/app-error";
import { prisma } from "@/config/prisma";
import { logger } from "@/config/logger";
import { RetryService } from "@/modules/retry/retry.service";
import type {
  completeExecutionSchema,
  failExecutionSchema,
  heartbeatSchema,
  recoverAbandonedJobsSchema,
  registerWorkerSchema
} from "./worker.schemas";
import type { z } from "zod";

type RegisterWorkerInput = z.infer<typeof registerWorkerSchema>;
type HeartbeatInput = z.infer<typeof heartbeatSchema>;
type CompleteExecutionInput = z.infer<typeof completeExecutionSchema>;
type FailExecutionInput = z.infer<typeof failExecutionSchema>;
type RecoverAbandonedJobsInput = z.infer<typeof recoverAbandonedJobsSchema>;

type ClaimedJobRow = {
  id: string;
  attempts: number;
};

export type ClaimedJob = {
  job: Awaited<ReturnType<PrismaClient["job"]["findUniqueOrThrow"]>>;
  execution: Awaited<ReturnType<PrismaClient["jobExecution"]["create"]>>;
};

export class WorkerService {
  private readonly retryService: RetryService;

  constructor(private readonly db: PrismaClient = prisma) {
    this.retryService = new RetryService(db);
  }

  registerWorker(input: RegisterWorkerInput) {
    return this.db.worker.create({
      data: {
        projectId: input.projectId,
        queueId: input.queueId,
        name: input.name,
        hostname: input.hostname,
        concurrency: input.concurrency,
        status: WorkerStatus.ONLINE,
        lastHeartbeatAt: new Date(),
        metadata: input.metadata as Prisma.InputJsonValue
      }
    });
  }

  async heartbeat(workerId: string, input: HeartbeatInput) {
    return this.db.$transaction(async (tx) => {
      const worker = await tx.worker.update({
        where: { id: workerId },
        data: {
          status: WorkerStatus.ONLINE,
          lastHeartbeatAt: new Date()
        }
      });

      await tx.workerHeartbeat.create({
        data: {
          workerId,
          status: WorkerStatus.ONLINE,
          activeJobs: input.activeJobs,
          capacity: input.capacity,
          heartbeatAt: new Date(),
          metadata: input.metadata as Prisma.InputJsonValue
        }
      });

      return worker;
    });
  }

  async claimNextJob(workerId: string): Promise<ClaimedJob | null> {
    return this.db.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<ClaimedJobRow[]>(Prisma.sql`
          WITH worker_scope AS (
            SELECT w.id, w."projectId", w."queueId"
            FROM workers w
            WHERE w.id = ${workerId}
              AND w.status = 'ONLINE'::"WorkerStatus"
          ),
          candidate_queue AS (
            SELECT q.id
            FROM queues q
            JOIN worker_scope ws
              ON ws."projectId" = q."projectId"
             AND (ws."queueId" IS NULL OR ws."queueId" = q.id)
            WHERE q.status = ${QueueStatus.ACTIVE}::"QueueStatus"
              AND q."deletedAt" IS NULL
              AND (
                SELECT COUNT(*)::int
                FROM jobs active
                WHERE active."queueId" = q.id
                  AND active.state IN ('CLAIMED'::"JobState", 'RUNNING'::"JobState")
              ) < q."concurrencyLimit"
            ORDER BY q."priorityWeight" DESC, q."createdAt" ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
          ),
          candidate_job AS (
            SELECT j.id
            FROM jobs j
            JOIN candidate_queue q ON q.id = j."queueId"
            WHERE j.state IN ('QUEUED'::"JobState", 'SCHEDULED'::"JobState", 'RETRYING'::"JobState")
              AND j."availableAt" <= now()
              AND (j."scheduledFor" IS NULL OR j."scheduledFor" <= now())
              AND j.attempts < j."maxAttempts"
            ORDER BY j.priority DESC, j."createdAt" ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
          ),
          updated_job AS (
            UPDATE jobs j
            SET state = 'CLAIMED'::"JobState",
                "claimedByWorkerId" = ${workerId},
                "lockedAt" = now(),
                attempts = j.attempts + 1,
                "updatedAt" = now()
            FROM candidate_job c
            WHERE j.id = c.id
            RETURNING j.id, j.attempts
          )
          SELECT id, attempts FROM updated_job
        `);

        const claimed = rows[0];

        if (!claimed) {
          return null;
        }

        const execution = await tx.jobExecution.create({
          data: {
            jobId: claimed.id,
            workerId,
            attempt: claimed.attempts,
            status: ExecutionStatus.CLAIMED,
            startedAt: new Date()
          }
        });

        const job = await tx.job.findUniqueOrThrow({
          where: { id: claimed.id }
        });

        return {
          job,
          execution
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
      }
    );
  }

  async markRunning(input: { jobId: string; executionId: string }) {
    return this.db.$transaction(async (tx) => {
      const execution = await tx.jobExecution.findUnique({
        where: { id: input.executionId }
      });

      if (!execution || execution.jobId !== input.jobId) {
        throw new AppError(404, "EXECUTION_NOT_FOUND", "Job execution was not found");
      }

      await tx.job.update({
        where: { id: input.jobId },
        data: {
          state: JobState.RUNNING
        }
      });

      return tx.jobExecution.update({
        where: { id: input.executionId },
        data: {
          status: ExecutionStatus.RUNNING
        }
      });
    });
  }

  async completeExecution(input: CompleteExecutionInput) {
    return this.db.$transaction(async (tx) => {
      const execution = await tx.jobExecution.findUnique({
        where: { id: input.executionId }
      });

      if (!execution || execution.jobId !== input.jobId) {
        throw new AppError(404, "EXECUTION_NOT_FOUND", "Job execution was not found");
      }

      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - execution.startedAt.getTime();

      await tx.jobExecution.update({
        where: { id: execution.id },
        data: {
          status: ExecutionStatus.SUCCEEDED,
          finishedAt,
          durationMs
        }
      });

      return tx.job.update({
        where: { id: input.jobId },
        data: {
          state: JobState.COMPLETED,
          result: input.result as Prisma.InputJsonValue,
          completedAt: finishedAt,
          claimedByWorkerId: null,
          lockedAt: null,
          errorMessage: null
        }
      });
    });
  }

  failExecution(input: FailExecutionInput) {
    return this.retryService.markExecutionFailed(input);
  }

  async gracefulShutdown(workerId: string) {
    return this.db.worker.update({
      where: { id: workerId },
      data: {
        status: WorkerStatus.DRAINING,
        shutdownAt: new Date()
      }
    });
  }

  async recoverAbandonedJobs(input: RecoverAbandonedJobsInput) {
    const cutoff = new Date(Date.now() - input.olderThanSeconds * 1000);

    return this.db.job.updateMany({
      where: {
        state: {
          in: [JobState.CLAIMED, JobState.RUNNING]
        },
        lockedAt: {
          lt: cutoff
        }
      },
      data: {
        state: JobState.RETRYING,
        availableAt: new Date(),
        claimedByWorkerId: null,
        lockedAt: null,
        errorMessage: "Recovered from abandoned worker claim"
      }
    });
  }
}

export type JobExecutor = (claimed: ClaimedJob) => Promise<Prisma.InputJsonValue | undefined>;

export class DatabaseWorkerRunner {
  private isShuttingDown = false;
  private activeJobs = 0;

  constructor(
    private readonly workerId: string,
    private readonly service: WorkerService,
    private readonly executor: JobExecutor,
    private readonly options: { concurrency: number; pollIntervalMs: number }
  ) {}

  async start() {
    while (!this.isShuttingDown) {
      while (this.activeJobs < this.options.concurrency && !this.isShuttingDown) {
        const claimed = await this.service.claimNextJob(this.workerId);

        if (!claimed) {
          break;
        }

        this.activeJobs += 1;
        void this.executeClaimedJob(claimed);
      }

      await this.service.heartbeat(this.workerId, {
        activeJobs: this.activeJobs,
        capacity: this.options.concurrency
      });

      await new Promise((resolve) => setTimeout(resolve, this.options.pollIntervalMs));
    }
  }

  async shutdown() {
    this.isShuttingDown = true;
    await this.service.gracefulShutdown(this.workerId);
  }

  private async executeClaimedJob(claimed: ClaimedJob) {
    try {
      await this.service.markRunning({
        jobId: claimed.job.id,
        executionId: claimed.execution.id
      });
      const result = await this.executor(claimed);
      await this.service.completeExecution({
        jobId: claimed.job.id,
        executionId: claimed.execution.id,
        result:
          result && typeof result === "object" ? (result as Record<string, unknown>) : undefined
      });
    } catch (error) {
      logger.error("Worker execution failed", error);
      await this.service.failExecution({
        jobId: claimed.job.id,
        executionId: claimed.execution.id,
        errorMessage: error instanceof Error ? error.message : "Unknown worker execution error"
      });
    } finally {
      this.activeJobs -= 1;
    }
  }
}
