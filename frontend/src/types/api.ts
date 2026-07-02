export type JobState =
  | "QUEUED"
  | "SCHEDULED"
  | "CLAIMED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "RETRYING"
  | "DEAD_LETTER";

export type QueueStatus = "ACTIVE" | "PAUSED" | "ARCHIVED";
export type WorkerStatus = "ONLINE" | "DRAINING" | "OFFLINE";

export type MetricsOverview = {
  jobsByState: Record<JobState, number>;
  workersByStatus: Record<WorkerStatus, number>;
  dlqCount: number;
  successRate: number;
  queues: Queue[];
  recentExecutions: Array<{
    id: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
  }>;
};

export type Project = {
  id: string;
  name: string;
  slug: string;
  status: string;
  organization: {
    name: string;
    slug: string;
  };
  _count: {
    queues: number;
    jobs: number;
    workers: number;
  };
};

export type Queue = {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  status: QueueStatus;
  concurrencyLimit: number;
  priorityWeight: number;
  _count?: {
    jobs: number;
    workers: number;
  };
};

export type Job = {
  id: string;
  queueId: string;
  type: string;
  state: JobState;
  priority: number;
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  scheduledFor: string | null;
  errorMessage: string | null;
  queue?: {
    name: string;
    slug: string;
  };
  claimedByWorker?: {
    name: string;
    status: WorkerStatus;
  } | null;
};

export type Worker = {
  id: string;
  name: string;
  status: WorkerStatus;
  concurrency: number;
  lastHeartbeatAt: string | null;
  queue?: {
    name: string;
    slug: string;
  } | null;
  _count?: {
    executions: number;
    heartbeats: number;
  };
};

export type DeadLetterEntry = {
  id: string;
  reason: string;
  failureMessage: string;
  failedAt: string;
  queue: {
    name: string;
    slug: string;
  };
  job: {
    id: string;
    type: string;
    attempts: number;
    maxAttempts: number;
  };
};
