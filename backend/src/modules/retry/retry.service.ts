import { DeadLetterReason, ExecutionStatus, JobState, Prisma, RetryStrategy } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { AppError } from "@/common/errors/app-error";
import { logger } from "@/config/logger";
import { prisma } from "@/config/prisma";

export type RetryDecision = {
  shouldRetry: boolean;
  delaySeconds: number;
  nextAvailableAt: Date;
};

const clamp = (value: number, max: number) => Math.min(value, max);

export const calculateRetryDecision = (input: {
  attempts: number;
  maxAttempts: number;
  strategy?: RetryStrategy | null;
  baseDelaySeconds?: number | null;
  maxDelaySeconds?: number | null;
  jitterSeconds?: number | null;
  now?: Date;
}): RetryDecision => {
  const now = input.now ?? new Date();

  if (input.attempts >= input.maxAttempts) {
    return {
      shouldRetry: false,
      delaySeconds: 0,
      nextAvailableAt: now
    };
  }

  const strategy = input.strategy ?? RetryStrategy.EXPONENTIAL;
  const baseDelaySeconds = input.baseDelaySeconds ?? 30;
  const maxDelaySeconds = input.maxDelaySeconds ?? 3600;
  const jitterSeconds = input.jitterSeconds ?? 0;

  const deterministicDelay =
    strategy === RetryStrategy.FIXED
      ? baseDelaySeconds
      : strategy === RetryStrategy.LINEAR
        ? baseDelaySeconds * input.attempts
        : baseDelaySeconds * 2 ** Math.max(input.attempts - 1, 0);

  const delaySeconds = clamp(deterministicDelay + jitterSeconds, maxDelaySeconds);

  return {
    shouldRetry: true,
    delaySeconds,
    nextAvailableAt: new Date(now.getTime() + delaySeconds * 1000)
  };
};

export class RetryService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async retryJob(jobId: string) {
    return this.db.$transaction(async (tx) => {
      const job = await tx.job.findUnique({
        where: { id: jobId },
        include: { deadLetter: true }
      });

      if (!job) {
        throw new AppError(404, "JOB_NOT_FOUND", "Job was not found");
      }

      const retryableStates: JobState[] = [
        JobState.FAILED,
        JobState.DEAD_LETTER,
        JobState.RETRYING
      ];

      if (!retryableStates.includes(job.state)) {
        throw new AppError(
          409,
          "JOB_NOT_RETRYABLE",
          "Only failed, retrying, or DLQ jobs can be retried"
        );
      }

      if (job.deadLetter) {
        await tx.deadLetterQueue.delete({
          where: { jobId }
        });
      }

      return tx.job.update({
        where: { id: jobId },
        data: {
          state: JobState.QUEUED,
          availableAt: new Date(),
          lockedAt: null,
          claimedByWorkerId: null,
          failedAt: null,
          errorMessage: null
        }
      });
    });
  }

  async markExecutionFailed(input: { jobId: string; executionId: string; errorMessage: string }) {
    return this.db.$transaction(async (tx) => {
      const execution = await tx.jobExecution.findUnique({
        where: { id: input.executionId },
        include: {
          job: {
            include: {
              retryPolicy: true
            }
          }
        }
      });

      if (!execution || execution.jobId !== input.jobId) {
        throw new AppError(404, "EXECUTION_NOT_FOUND", "Job execution was not found");
      }

      const job = execution.job;
      const retry = calculateRetryDecision({
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        strategy: job.retryPolicy?.strategy,
        baseDelaySeconds: job.retryPolicy?.baseDelaySeconds,
        maxDelaySeconds: job.retryPolicy?.maxDelaySeconds,
        jitterSeconds: job.retryPolicy?.jitterSeconds
      });

      await tx.jobExecution.update({
        where: { id: execution.id },
        data: {
          status: ExecutionStatus.FAILED,
          finishedAt: new Date(),
          errorMessage: input.errorMessage
        }
      });

      if (!retry.shouldRetry) {
        const failedJob = await tx.job.update({
          where: { id: job.id },
          data: {
            state: JobState.DEAD_LETTER,
            claimedByWorkerId: null,
            lockedAt: null,
            failedAt: new Date(),
            errorMessage: input.errorMessage
          }
        });

        await tx.deadLetterQueue.upsert({
          where: { jobId: job.id },
          update: {
            reason: DeadLetterReason.MAX_RETRIES_EXCEEDED,
            failureMessage: input.errorMessage,
            payloadSnapshot: job.payload as Prisma.InputJsonValue,
            failedAt: new Date()
          },
          create: {
            projectId: job.projectId,
            queueId: job.queueId,
            jobId: job.id,
            reason: DeadLetterReason.MAX_RETRIES_EXCEEDED,
            failureMessage: input.errorMessage,
            payloadSnapshot: job.payload as Prisma.InputJsonValue
          }
        });

        await tx.jobLog.create({
          data: {
            jobId: job.id,
            executionId: execution.id,
            level: "ERROR",
            message: "Job moved to dead letter queue",
            metadata: {
              errorMessage: input.errorMessage,
              attempts: job.attempts,
              maxAttempts: job.maxAttempts
            }
          }
        });

        logger.error("job_moved_to_dead_letter", {
          job: {
            id: job.id,
            queueId: job.queueId,
            attempts: job.attempts,
            maxAttempts: job.maxAttempts
          },
          execution: {
            id: execution.id
          },
          error: {
            message: input.errorMessage
          }
        });

        return failedJob;
      }

      await tx.jobLog.create({
        data: {
          jobId: job.id,
          executionId: execution.id,
          level: "WARN",
          message: "Job execution failed; retry scheduled",
          metadata: {
            errorMessage: input.errorMessage,
            attempts: job.attempts,
            maxAttempts: job.maxAttempts,
            retryDelaySeconds: retry.delaySeconds,
            nextAvailableAt: retry.nextAvailableAt.toISOString()
          }
        }
      });

      logger.warn("job_retry_scheduled", {
        job: {
          id: job.id,
          queueId: job.queueId,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts
        },
        execution: {
          id: execution.id
        },
        retry: {
          delaySeconds: retry.delaySeconds,
          nextAvailableAt: retry.nextAvailableAt.toISOString()
        },
        error: {
          message: input.errorMessage
        }
      });

      return tx.job.update({
        where: { id: job.id },
        data: {
          state: JobState.RETRYING,
          availableAt: retry.nextAvailableAt,
          claimedByWorkerId: null,
          lockedAt: null,
          failedAt: new Date(),
          errorMessage: input.errorMessage
        }
      });
    });
  }
}
