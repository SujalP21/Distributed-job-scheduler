import bcrypt from "bcrypt";
import {
  DeadLetterReason,
  ExecutionStatus,
  JobState,
  JobType,
  LogLevel,
  PrismaClient,
  QueueStatus,
  RetryStrategy,
  ScheduledJobStatus,
  WorkerStatus
} from "@prisma/client";

const prisma = new PrismaClient();

const now = new Date();
const minutesFromNow = (minutes: number) => new Date(now.getTime() + minutes * 60 * 1000);
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60 * 1000);

async function main() {
  const passwordHash = await bcrypt.hash("Password123", 12);

  const user = await prisma.user.upsert({
    where: { email: "admin@scheduler.dev" },
    update: {
      name: "Scheduler Admin",
      deletedAt: null
    },
    create: {
      id: "seed_user_admin",
      email: "admin@scheduler.dev",
      name: "Scheduler Admin",
      passwordHash
    }
  });

  const organization = await prisma.organization.upsert({
    where: { slug: "acme-platform" },
    update: {
      name: "Acme Platform",
      deletedAt: null
    },
    create: {
      id: "seed_org_acme",
      name: "Acme Platform",
      slug: "acme-platform"
    }
  });

  await prisma.organizationMembership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: organization.id
      }
    },
    update: {
      role: "OWNER"
    },
    create: {
      id: "seed_membership_admin_acme",
      userId: user.id,
      organizationId: organization.id,
      role: "OWNER"
    }
  });

  const project = await prisma.project.upsert({
    where: {
      organizationId_slug: {
        organizationId: organization.id,
        slug: "payments"
      }
    },
    update: {
      name: "Payments Platform",
      status: "ACTIVE",
      deletedAt: null
    },
    create: {
      id: "seed_project_payments",
      organizationId: organization.id,
      createdById: user.id,
      name: "Payments Platform",
      slug: "payments",
      description: "Demo project for payment workflow background jobs"
    }
  });

  const retryFast = await prisma.retryPolicy.upsert({
    where: {
      projectId_name: {
        projectId: project.id,
        name: "fast-exponential"
      }
    },
    update: {
      strategy: RetryStrategy.EXPONENTIAL,
      maxAttempts: 5,
      baseDelaySeconds: 30,
      maxDelaySeconds: 900,
      jitterSeconds: 10
    },
    create: {
      id: "seed_retry_fast",
      projectId: project.id,
      name: "fast-exponential",
      strategy: RetryStrategy.EXPONENTIAL,
      maxAttempts: 5,
      baseDelaySeconds: 30,
      maxDelaySeconds: 900,
      jitterSeconds: 10
    }
  });

  const retryFixed = await prisma.retryPolicy.upsert({
    where: {
      projectId_name: {
        projectId: project.id,
        name: "fixed-critical"
      }
    },
    update: {
      strategy: RetryStrategy.FIXED,
      maxAttempts: 3,
      baseDelaySeconds: 120,
      maxDelaySeconds: 120,
      jitterSeconds: 0
    },
    create: {
      id: "seed_retry_fixed",
      projectId: project.id,
      name: "fixed-critical",
      strategy: RetryStrategy.FIXED,
      maxAttempts: 3,
      baseDelaySeconds: 120,
      maxDelaySeconds: 120
    }
  });

  const defaultQueue = await prisma.queue.upsert({
    where: {
      projectId_slug: {
        projectId: project.id,
        slug: "default"
      }
    },
    update: {
      status: QueueStatus.ACTIVE,
      retryPolicyId: retryFast.id,
      concurrencyLimit: 10,
      priorityWeight: 50,
      deletedAt: null
    },
    create: {
      id: "seed_queue_default",
      projectId: project.id,
      retryPolicyId: retryFast.id,
      name: "Default Jobs",
      slug: "default",
      concurrencyLimit: 10,
      priorityWeight: 50
    }
  });

  const criticalQueue = await prisma.queue.upsert({
    where: {
      projectId_slug: {
        projectId: project.id,
        slug: "critical"
      }
    },
    update: {
      status: QueueStatus.ACTIVE,
      retryPolicyId: retryFixed.id,
      concurrencyLimit: 4,
      priorityWeight: 100,
      deletedAt: null
    },
    create: {
      id: "seed_queue_critical",
      projectId: project.id,
      retryPolicyId: retryFixed.id,
      name: "Critical Payments",
      slug: "critical",
      concurrencyLimit: 4,
      priorityWeight: 100
    }
  });

  const worker = await prisma.worker.upsert({
    where: { id: "seed_worker_1" },
    update: {
      status: WorkerStatus.ONLINE,
      lastHeartbeatAt: minutesAgo(1),
      concurrency: 8
    },
    create: {
      id: "seed_worker_1",
      projectId: project.id,
      queueId: defaultQueue.id,
      name: "payments-worker-1",
      hostname: "worker-a.local",
      status: WorkerStatus.ONLINE,
      concurrency: 8,
      lastHeartbeatAt: minutesAgo(1),
      metadata: {
        region: "local",
        version: "seed"
      }
    }
  });

  await prisma.workerHeartbeat.upsert({
    where: { id: "seed_worker_heartbeat_1" },
    update: {
      heartbeatAt: minutesAgo(1),
      activeJobs: 2,
      capacity: 8,
      status: WorkerStatus.ONLINE
    },
    create: {
      id: "seed_worker_heartbeat_1",
      workerId: worker.id,
      status: WorkerStatus.ONLINE,
      activeJobs: 2,
      capacity: 8,
      heartbeatAt: minutesAgo(1),
      metadata: {
        loadAverage: 0.62
      }
    }
  });

  const jobs = [
    {
      id: "seed_job_immediate",
      queueId: defaultQueue.id,
      retryPolicyId: retryFast.id,
      type: JobType.IMMEDIATE,
      state: JobState.QUEUED,
      priority: 50,
      payload: { task: "send-receipt", paymentId: "pay_1001" },
      availableAt: minutesAgo(2)
    },
    {
      id: "seed_job_delayed",
      queueId: defaultQueue.id,
      retryPolicyId: retryFast.id,
      type: JobType.DELAYED,
      state: JobState.SCHEDULED,
      priority: 20,
      payload: { task: "settlement-reminder", accountId: "acct_204" },
      scheduledFor: minutesFromNow(15),
      availableAt: minutesFromNow(15)
    },
    {
      id: "seed_job_completed",
      queueId: criticalQueue.id,
      retryPolicyId: retryFixed.id,
      type: JobType.IMMEDIATE,
      state: JobState.COMPLETED,
      priority: 100,
      payload: { task: "capture-payment", paymentId: "pay_1000" },
      result: { captured: true },
      availableAt: minutesAgo(20),
      completedAt: minutesAgo(16)
    },
    {
      id: "seed_job_retrying",
      queueId: criticalQueue.id,
      retryPolicyId: retryFixed.id,
      type: JobType.IMMEDIATE,
      state: JobState.RETRYING,
      priority: 90,
      payload: { task: "notify-ledger", paymentId: "pay_1002" },
      attempts: 1,
      maxAttempts: 3,
      errorMessage: "Ledger API returned 503",
      availableAt: minutesFromNow(5),
      failedAt: minutesAgo(4)
    },
    {
      id: "seed_job_dead_letter",
      queueId: criticalQueue.id,
      retryPolicyId: retryFixed.id,
      type: JobType.IMMEDIATE,
      state: JobState.DEAD_LETTER,
      priority: 95,
      payload: { task: "fraud-review", paymentId: "pay_9999" },
      attempts: 3,
      maxAttempts: 3,
      errorMessage: "Fraud provider rejected malformed payload",
      availableAt: minutesAgo(120),
      failedAt: minutesAgo(90)
    },
    {
      id: "seed_job_batch_1",
      queueId: defaultQueue.id,
      retryPolicyId: retryFast.id,
      type: JobType.BATCH,
      state: JobState.QUEUED,
      priority: 10,
      batchId: "batch_daily_reports",
      payload: { task: "generate-report", shard: 1 },
      availableAt: minutesAgo(1)
    },
    {
      id: "seed_job_batch_2",
      queueId: defaultQueue.id,
      retryPolicyId: retryFast.id,
      type: JobType.BATCH,
      state: JobState.QUEUED,
      priority: 10,
      batchId: "batch_daily_reports",
      payload: { task: "generate-report", shard: 2 },
      availableAt: minutesAgo(1)
    }
  ];

  for (const job of jobs) {
    await prisma.job.upsert({
      where: { id: job.id },
      update: {
        state: job.state,
        priority: job.priority,
        payload: job.payload,
        result: "result" in job ? job.result : undefined,
        attempts: "attempts" in job ? job.attempts : 0,
        maxAttempts: "maxAttempts" in job ? job.maxAttempts : 3,
        errorMessage: "errorMessage" in job ? job.errorMessage : null,
        scheduledFor: "scheduledFor" in job ? job.scheduledFor : null,
        availableAt: job.availableAt,
        completedAt: "completedAt" in job ? job.completedAt : null,
        failedAt: "failedAt" in job ? job.failedAt : null
      },
      create: {
        ...job,
        projectId: project.id,
        createdById: user.id
      }
    });
  }

  await prisma.jobExecution.upsert({
    where: {
      jobId_attempt: {
        jobId: "seed_job_completed",
        attempt: 1
      }
    },
    update: {
      status: ExecutionStatus.SUCCEEDED,
      workerId: worker.id,
      finishedAt: minutesAgo(16),
      durationMs: 2400
    },
    create: {
      id: "seed_execution_completed",
      jobId: "seed_job_completed",
      workerId: worker.id,
      attempt: 1,
      status: ExecutionStatus.SUCCEEDED,
      startedAt: minutesAgo(17),
      finishedAt: minutesAgo(16),
      durationMs: 2400
    }
  });

  await prisma.jobExecution.upsert({
    where: {
      jobId_attempt: {
        jobId: "seed_job_retrying",
        attempt: 1
      }
    },
    update: {
      status: ExecutionStatus.FAILED,
      workerId: worker.id,
      finishedAt: minutesAgo(4),
      durationMs: 1300,
      errorMessage: "Ledger API returned 503"
    },
    create: {
      id: "seed_execution_retrying",
      jobId: "seed_job_retrying",
      workerId: worker.id,
      attempt: 1,
      status: ExecutionStatus.FAILED,
      startedAt: minutesAgo(5),
      finishedAt: minutesAgo(4),
      durationMs: 1300,
      errorMessage: "Ledger API returned 503"
    }
  });

  await prisma.jobLog.upsert({
    where: { id: "seed_log_completed" },
    update: {
      message: "Payment capture completed",
      level: LogLevel.INFO
    },
    create: {
      id: "seed_log_completed",
      jobId: "seed_job_completed",
      executionId: "seed_execution_completed",
      level: LogLevel.INFO,
      message: "Payment capture completed",
      metadata: {
        durationMs: 2400
      }
    }
  });

  await prisma.jobLog.upsert({
    where: { id: "seed_log_retrying" },
    update: {
      message: "Ledger API returned 503; retry scheduled",
      level: LogLevel.WARN
    },
    create: {
      id: "seed_log_retrying",
      jobId: "seed_job_retrying",
      executionId: "seed_execution_retrying",
      level: LogLevel.WARN,
      message: "Ledger API returned 503; retry scheduled",
      metadata: {
        nextAttemptAt: minutesFromNow(5)
      }
    }
  });

  await prisma.scheduledJob.upsert({
    where: { id: "seed_scheduled_daily_settlement" },
    update: {
      status: ScheduledJobStatus.ACTIVE,
      nextRunAt: minutesFromNow(60)
    },
    create: {
      id: "seed_scheduled_daily_settlement",
      projectId: project.id,
      queueId: criticalQueue.id,
      retryPolicyId: retryFixed.id,
      name: "Daily settlement reconciliation",
      jobType: JobType.RECURRING,
      cronExpression: "0 2 * * *",
      timezone: "UTC",
      payload: {
        task: "daily-settlement-reconciliation"
      },
      status: ScheduledJobStatus.ACTIVE,
      nextRunAt: minutesFromNow(60)
    }
  });

  await prisma.deadLetterQueue.upsert({
    where: { jobId: "seed_job_dead_letter" },
    update: {
      reason: DeadLetterReason.MAX_RETRIES_EXCEEDED,
      failureMessage: "Fraud provider rejected malformed payload",
      failedAt: minutesAgo(90)
    },
    create: {
      id: "seed_dlq_fraud_review",
      projectId: project.id,
      queueId: criticalQueue.id,
      jobId: "seed_job_dead_letter",
      reason: DeadLetterReason.MAX_RETRIES_EXCEEDED,
      failureMessage: "Fraud provider rejected malformed payload",
      payloadSnapshot: {
        task: "fraud-review",
        paymentId: "pay_9999"
      },
      failedAt: minutesAgo(90)
    }
  });

  console.log("Seeded demo organization, scheduler data, worker, jobs, and DLQ entries.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
