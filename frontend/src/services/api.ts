import type { DeadLetterEntry, Job, MetricsOverview, Project, Queue, Worker } from "@/types/api";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

const getJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`);

  if (!response.ok) {
    throw new Error(`${path} failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
};

export const api = {
  async health() {
    return getJson("/health");
  },
  async metricsOverview() {
    return getJson<MetricsOverview>("/metrics/overview");
  },
  async projects() {
    return getJson<Project[]>("/api/projects");
  },
  async queues() {
    return getJson<Queue[]>("/api/queues");
  },
  async jobs() {
    return getJson<Job[]>("/api/jobs");
  },
  async workers() {
    return getJson<Worker[]>("/api/workers");
  },
  async deadLetter() {
    return getJson<DeadLetterEntry[]>("/api/dead-letter");
  }
};
