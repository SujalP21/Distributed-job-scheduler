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

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  createdAt?: string;
};

export type AuthResult = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  _count?: {
    projects: number;
    memberships: number;
  };
};

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
  organizationId: string;
  name: string;
  slug: string;
  description?: string | null;
  status: string;
  createdAt: string;
  organization: {
    id: string;
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
  retryPolicyId?: string | null;
  name: string;
  slug: string;
  status: QueueStatus;
  concurrencyLimit: number;
  priorityWeight: number;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    jobs: number;
    workers: number;
  };
};

export type Job = {
  id: string;
  projectId: string;
  queueId: string;
  batchId?: string | null;
  type: string;
  state: JobState;
  priority: number;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  scheduledFor: string | null;
  lockedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  createdAt?: string;
  errorMessage: string | null;
  queue?: {
    id?: string;
    name: string;
    slug: string;
  };
  claimedByWorker?: {
    id?: string;
    name: string;
    status: WorkerStatus;
  } | null;
};

export type Worker = {
  id: string;
  projectId: string;
  queueId?: string | null;
  name: string;
  hostname?: string | null;
  status: WorkerStatus;
  concurrency: number;
  lastHeartbeatAt: string | null;
  registeredAt?: string;
  queue?: {
    id?: string;
    name: string;
    slug: string;
  } | null;
  _count?: {
    executions: number;
    heartbeats: number;
  };
};

export type JobHistory = Job & {
  executions: Array<{
    id: string;
    attempt: number;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    errorMessage: string | null;
    logs: JobLog[];
  }>;
  logs: JobLog[];
  deadLetter: DeadLetterEntry | null;
};

export type JobLog = {
  id: string;
  level: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
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
