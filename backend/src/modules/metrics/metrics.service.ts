import { JobState, QueueStatus, WorkerStatus } from "@prisma/client";
import { prisma } from "@/config/prisma";

const line = (name: string, value: number, labels?: Record<string, string | number>) => {
  const serializedLabels = labels
    ? `{${Object.entries(labels)
        .map(([key, labelValue]) => `${key}="${String(labelValue).replace(/"/g, '\\"')}"`)
        .join(",")}}`
    : "";

  return `${name}${serializedLabels} ${value}`;
};

export const getPrometheusMetrics = async () => {
  const [jobCounts, queueCounts, workerCounts, activeExecutions, dlqCount] = await Promise.all([
    prisma.job.groupBy({
      by: ["state"],
      _count: { _all: true }
    }),
    prisma.queue.groupBy({
      by: ["status"],
      _count: { _all: true }
    }),
    prisma.worker.groupBy({
      by: ["status"],
      _count: { _all: true }
    }),
    prisma.jobExecution.count({
      where: {
        status: {
          in: ["CLAIMED", "RUNNING"]
        }
      }
    }),
    prisma.deadLetterQueue.count()
  ]);

  const output = [
    "# HELP scheduler_uptime_seconds Process uptime in seconds.",
    "# TYPE scheduler_uptime_seconds gauge",
    line("scheduler_uptime_seconds", Math.round(process.uptime())),
    "# HELP scheduler_jobs_total Jobs by state.",
    "# TYPE scheduler_jobs_total gauge",
    ...Object.values(JobState).map((state) =>
      line(
        "scheduler_jobs_total",
        jobCounts.find((item) => item.state === state)?._count._all ?? 0,
        {
          state
        }
      )
    ),
    "# HELP scheduler_queues_total Queues by status.",
    "# TYPE scheduler_queues_total gauge",
    ...Object.values(QueueStatus).map((status) =>
      line(
        "scheduler_queues_total",
        queueCounts.find((item) => item.status === status)?._count._all ?? 0,
        { status }
      )
    ),
    "# HELP scheduler_workers_total Workers by status.",
    "# TYPE scheduler_workers_total gauge",
    ...Object.values(WorkerStatus).map((status) =>
      line(
        "scheduler_workers_total",
        workerCounts.find((item) => item.status === status)?._count._all ?? 0,
        { status }
      )
    ),
    "# HELP scheduler_active_executions Current claimed or running executions.",
    "# TYPE scheduler_active_executions gauge",
    line("scheduler_active_executions", activeExecutions),
    "# HELP scheduler_dead_letter_jobs_total Dead letter queue entries.",
    "# TYPE scheduler_dead_letter_jobs_total gauge",
    line("scheduler_dead_letter_jobs_total", dlqCount)
  ];

  return `${output.join("\n")}\n`;
};
