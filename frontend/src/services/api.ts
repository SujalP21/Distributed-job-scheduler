import type {
  AuthResult,
  AuthUser,
  DeadLetterEntry,
  Job,
  JobHistory,
  MetricsOverview,
  Organization,
  Project,
  Queue,
  Worker
} from "@/types/api";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const ACCESS_TOKEN_KEY = "scheduler.accessToken";
const REFRESH_TOKEN_KEY = "scheduler.refreshToken";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
};

export const authStore = {
  getAccessToken() {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken() {
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  setTokens(result: AuthResult) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken);
  },
  clear() {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
};

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const token = options.token === undefined ? authStore.getAccessToken() : options.token;
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json().catch(() => null)) as
    { error?: { message?: string; code?: string } } | T | null;

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === "object" && "error" in payload ? payload.error : undefined;
    const message = errorPayload?.message ?? `${path} failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
};

export const api = {
  login(body: { email: string; password: string }) {
    return request<AuthResult>("/api/auth/login", { method: "POST", body, token: null });
  },
  register(body: { email: string; name: string; password: string; organizationName: string }) {
    return request<AuthResult>("/api/auth/register", { method: "POST", body, token: null });
  },
  me() {
    return request<{ user: AuthUser }>("/api/auth/me");
  },
  logout(refreshToken: string) {
    return request<void>("/api/auth/logout", {
      method: "POST",
      body: { refreshToken }
    });
  },
  health() {
    return request<unknown>("/health", { token: null });
  },
  metricsOverview() {
    return request<MetricsOverview>("/metrics/overview", { token: null });
  },
  organizations() {
    return request<Organization[]>("/api/organizations");
  },
  createOrganization(body: { name: string; slug?: string }) {
    return request<Organization>("/api/organizations", { method: "POST", body });
  },
  projects() {
    return request<Project[]>("/api/projects");
  },
  createProject(body: {
    organizationId: string;
    name: string;
    slug?: string;
    description?: string;
  }) {
    return request<Project>("/api/projects", { method: "POST", body });
  },
  queues() {
    return request<Queue[]>("/api/queues");
  },
  createQueue(body: {
    projectId: string;
    name: string;
    slug: string;
    retryPolicyId?: string;
    concurrencyLimit: number;
    priorityWeight: number;
  }) {
    return request<Queue>("/api/queues", { method: "POST", body });
  },
  updateQueue(
    queueId: string,
    body: Partial<Pick<Queue, "status" | "concurrencyLimit" | "priorityWeight" | "name">>
  ) {
    return request<Queue>(`/api/queues/${queueId}`, { method: "PATCH", body });
  },
  pauseQueue(queueId: string) {
    return request<Queue>(`/api/queues/${queueId}/pause`, { method: "POST" });
  },
  resumeQueue(queueId: string) {
    return request<Queue>(`/api/queues/${queueId}/resume`, { method: "POST" });
  },
  deleteQueue(queueId: string) {
    return request<Queue>(`/api/queues/${queueId}`, { method: "DELETE" });
  },
  jobs() {
    return request<Job[]>("/api/jobs");
  },
  createImmediateJob(body: {
    projectId: string;
    queueId: string;
    priority: number;
    payload: Record<string, unknown>;
    maxAttempts: number;
  }) {
    return request<Job>("/api/jobs/immediate", { method: "POST", body });
  },
  createDelayedJob(body: {
    projectId: string;
    queueId: string;
    priority: number;
    payload: Record<string, unknown>;
    maxAttempts: number;
    delaySeconds: number;
  }) {
    return request<Job>("/api/jobs/delayed", { method: "POST", body });
  },
  createScheduledJob(body: {
    projectId: string;
    queueId: string;
    priority: number;
    payload: Record<string, unknown>;
    maxAttempts: number;
    scheduledFor: string;
  }) {
    return request<Job>("/api/jobs/scheduled", { method: "POST", body });
  },
  createRecurringJob(body: {
    projectId: string;
    queueId: string;
    name: string;
    cronExpression: string;
    timezone: string;
    payload: Record<string, unknown>;
    nextRunAt: string;
  }) {
    return request<unknown>("/api/jobs/recurring", { method: "POST", body });
  },
  createBatchJob(body: {
    projectId: string;
    queueId: string;
    priority: number;
    payload: Record<string, unknown>;
    maxAttempts: number;
    count: number;
  }) {
    return request<Job[]>("/api/jobs/batch", {
      method: "POST",
      body: {
        projectId: body.projectId,
        queueId: body.queueId,
        priority: body.priority,
        maxAttempts: body.maxAttempts,
        jobs: Array.from({ length: body.count }, (_, index) => ({
          ...body.payload,
          batchIndex: index
        }))
      }
    });
  },
  cancelJob(jobId: string) {
    return request<Job>(`/api/jobs/${jobId}/cancel`, { method: "POST" });
  },
  retryJob(jobId: string) {
    return request<Job>(`/api/jobs/${jobId}/retry`, { method: "POST" });
  },
  jobHistory(jobId: string) {
    return request<JobHistory>(`/api/jobs/${jobId}/history`);
  },
  workers() {
    return request<Worker[]>("/api/workers");
  },
  registerWorker(body: {
    projectId: string;
    queueId?: string;
    name: string;
    hostname?: string;
    concurrency: number;
  }) {
    return request<Worker>("/api/workers/register", { method: "POST", body });
  },
  shutdownWorker(workerId: string) {
    return request<Worker>(`/api/workers/${workerId}/shutdown`, { method: "POST" });
  },
  deadLetter() {
    return request<DeadLetterEntry[]>("/api/dead-letter");
  }
};
