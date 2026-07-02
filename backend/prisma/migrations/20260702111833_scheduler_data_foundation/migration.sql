-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RetryStrategy" AS ENUM ('FIXED', 'LINEAR', 'EXPONENTIAL');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('IMMEDIATE', 'DELAYED', 'SCHEDULED', 'RECURRING', 'BATCH');

-- CreateEnum
CREATE TYPE "JobState" AS ENUM ('QUEUED', 'SCHEDULED', 'CLAIMED', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('CLAIMED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT');

-- CreateEnum
CREATE TYPE "WorkerStatus" AS ENUM ('ONLINE', 'DRAINING', 'OFFLINE');

-- CreateEnum
CREATE TYPE "ScheduledJobStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "DeadLetterReason" AS ENUM ('MAX_RETRIES_EXCEEDED', 'CANCELLED', 'VALIDATION_FAILED', 'WORKER_SHUTDOWN', 'UNKNOWN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retry_policies" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "strategy" "RetryStrategy" NOT NULL,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "baseDelaySeconds" INTEGER NOT NULL DEFAULT 30,
    "maxDelaySeconds" INTEGER NOT NULL DEFAULT 3600,
    "jitterSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retry_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queues" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "retryPolicyId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "QueueStatus" NOT NULL DEFAULT 'ACTIVE',
    "concurrencyLimit" INTEGER NOT NULL DEFAULT 5,
    "priorityWeight" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "queues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "retryPolicyId" TEXT,
    "createdById" TEXT,
    "claimedByWorkerId" TEXT,
    "batchId" TEXT,
    "type" "JobType" NOT NULL,
    "state" "JobState" NOT NULL DEFAULT 'QUEUED',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledFor" TIMESTAMP(3),
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_executions" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "workerId" TEXT,
    "attempt" INTEGER NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'CLAIMED',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workers" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "queueId" TEXT,
    "name" TEXT NOT NULL,
    "hostname" TEXT,
    "status" "WorkerStatus" NOT NULL DEFAULT 'ONLINE',
    "concurrency" INTEGER NOT NULL DEFAULT 5,
    "lastHeartbeatAt" TIMESTAMP(3),
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shutdownAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_heartbeats" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "status" "WorkerStatus" NOT NULL,
    "activeJobs" INTEGER NOT NULL DEFAULT 0,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_heartbeats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_logs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "executionId" TEXT,
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_jobs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "retryPolicyId" TEXT,
    "name" TEXT NOT NULL,
    "jobType" "JobType" NOT NULL DEFAULT 'RECURRING',
    "cronExpression" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "payload" JSONB NOT NULL,
    "status" "ScheduledJobStatus" NOT NULL DEFAULT 'ACTIVE',
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dead_letter_queue" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "reason" "DeadLetterReason" NOT NULL DEFAULT 'UNKNOWN',
    "failureMessage" TEXT NOT NULL,
    "payloadSnapshot" JSONB NOT NULL,
    "failedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dead_letter_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_slug_idx" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_deletedAt_idx" ON "organizations"("deletedAt");

-- CreateIndex
CREATE INDEX "organization_memberships_organizationId_role_idx" ON "organization_memberships"("organizationId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "organization_memberships_userId_organizationId_key" ON "organization_memberships"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_expiresAt_idx" ON "refresh_tokens"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_revokedAt_expiresAt_idx" ON "refresh_tokens"("revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "projects_organizationId_status_deletedAt_idx" ON "projects"("organizationId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "projects_createdById_idx" ON "projects"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "projects_organizationId_slug_key" ON "projects"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "retry_policies_projectId_strategy_idx" ON "retry_policies"("projectId", "strategy");

-- CreateIndex
CREATE UNIQUE INDEX "retry_policies_projectId_name_key" ON "retry_policies"("projectId", "name");

-- CreateIndex
CREATE INDEX "queues_projectId_status_deletedAt_idx" ON "queues"("projectId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "queues_retryPolicyId_idx" ON "queues"("retryPolicyId");

-- CreateIndex
CREATE INDEX "queues_status_deletedAt_priorityWeight_idx" ON "queues"("status", "deletedAt", "priorityWeight");

-- CreateIndex
CREATE UNIQUE INDEX "queues_projectId_slug_key" ON "queues"("projectId", "slug");

-- CreateIndex
CREATE INDEX "jobs_queueId_state_availableAt_priority_createdAt_idx" ON "jobs"("queueId", "state", "availableAt", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "jobs_state_availableAt_attempts_idx" ON "jobs"("state", "availableAt", "attempts");

-- CreateIndex
CREATE INDEX "jobs_projectId_state_createdAt_idx" ON "jobs"("projectId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "jobs_queueId_state_createdAt_idx" ON "jobs"("queueId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "jobs_retryPolicyId_state_idx" ON "jobs"("retryPolicyId", "state");

-- CreateIndex
CREATE INDEX "jobs_claimedByWorkerId_state_lockedAt_idx" ON "jobs"("claimedByWorkerId", "state", "lockedAt");

-- CreateIndex
CREATE INDEX "jobs_batchId_idx" ON "jobs"("batchId");

-- CreateIndex
CREATE INDEX "job_executions_jobId_startedAt_idx" ON "job_executions"("jobId", "startedAt");

-- CreateIndex
CREATE INDEX "job_executions_workerId_status_startedAt_idx" ON "job_executions"("workerId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "job_executions_status_startedAt_idx" ON "job_executions"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "job_executions_jobId_attempt_key" ON "job_executions"("jobId", "attempt");

-- CreateIndex
CREATE INDEX "workers_projectId_status_lastHeartbeatAt_idx" ON "workers"("projectId", "status", "lastHeartbeatAt");

-- CreateIndex
CREATE INDEX "workers_queueId_status_lastHeartbeatAt_idx" ON "workers"("queueId", "status", "lastHeartbeatAt");

-- CreateIndex
CREATE INDEX "workers_lastHeartbeatAt_status_idx" ON "workers"("lastHeartbeatAt", "status");

-- CreateIndex
CREATE INDEX "worker_heartbeats_workerId_heartbeatAt_idx" ON "worker_heartbeats"("workerId", "heartbeatAt");

-- CreateIndex
CREATE INDEX "worker_heartbeats_heartbeatAt_status_idx" ON "worker_heartbeats"("heartbeatAt", "status");

-- CreateIndex
CREATE INDEX "job_logs_jobId_createdAt_idx" ON "job_logs"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "job_logs_executionId_createdAt_idx" ON "job_logs"("executionId", "createdAt");

-- CreateIndex
CREATE INDEX "job_logs_level_createdAt_idx" ON "job_logs"("level", "createdAt");

-- CreateIndex
CREATE INDEX "scheduled_jobs_status_nextRunAt_idx" ON "scheduled_jobs"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "scheduled_jobs_queueId_status_nextRunAt_idx" ON "scheduled_jobs"("queueId", "status", "nextRunAt");

-- CreateIndex
CREATE INDEX "scheduled_jobs_projectId_status_idx" ON "scheduled_jobs"("projectId", "status");

-- CreateIndex
CREATE INDEX "scheduled_jobs_retryPolicyId_idx" ON "scheduled_jobs"("retryPolicyId");

-- CreateIndex
CREATE UNIQUE INDEX "dead_letter_queue_jobId_key" ON "dead_letter_queue"("jobId");

-- CreateIndex
CREATE INDEX "dead_letter_queue_queueId_failedAt_idx" ON "dead_letter_queue"("queueId", "failedAt");

-- CreateIndex
CREATE INDEX "dead_letter_queue_projectId_failedAt_idx" ON "dead_letter_queue"("projectId", "failedAt");

-- CreateIndex
CREATE INDEX "dead_letter_queue_reason_failedAt_idx" ON "dead_letter_queue"("reason", "failedAt");

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retry_policies" ADD CONSTRAINT "retry_policies_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queues" ADD CONSTRAINT "queues_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queues" ADD CONSTRAINT "queues_retryPolicyId_fkey" FOREIGN KEY ("retryPolicyId") REFERENCES "retry_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "queues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_retryPolicyId_fkey" FOREIGN KEY ("retryPolicyId") REFERENCES "retry_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_claimedByWorkerId_fkey" FOREIGN KEY ("claimedByWorkerId") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_executions" ADD CONSTRAINT "job_executions_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_executions" ADD CONSTRAINT "job_executions_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workers" ADD CONSTRAINT "workers_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workers" ADD CONSTRAINT "workers_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "queues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_heartbeats" ADD CONSTRAINT "worker_heartbeats_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "job_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "queues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_retryPolicyId_fkey" FOREIGN KEY ("retryPolicyId") REFERENCES "retry_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dead_letter_queue" ADD CONSTRAINT "dead_letter_queue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dead_letter_queue" ADD CONSTRAINT "dead_letter_queue_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "queues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dead_letter_queue" ADD CONSTRAINT "dead_letter_queue_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
