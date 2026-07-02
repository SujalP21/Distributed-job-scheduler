import { JobState, WorkerStatus } from "@prisma/client";
import { prisma } from "@/config/prisma";

export const getMetricsOverview = async () => {
  const [jobCounts, workerCounts, queues, dlqCount, recentExecutions] = await Promise.all([
    prisma.job.groupBy({
      by: ["state"],
      _count: { _all: true }
    }),
    prisma.worker.groupBy({
      by: ["status"],
      _count: { _all: true }
    }),
    prisma.queue.findMany({
      where: { deletedAt: null },
      include: {
        _count: {
          select: {
            jobs: true,
            workers: true
          }
        }
      },
      orderBy: [{ priorityWeight: "desc" }, { createdAt: "asc" }]
    }),
    prisma.deadLetterQueue.count(),
    prisma.jobExecution.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        durationMs: true
      }
    })
  ]);

  const jobsByState = Object.fromEntries(
    Object.values(JobState).map((state) => [
      state,
      jobCounts.find((item) => item.state === state)?._count._all ?? 0
    ])
  );
  const workersByStatus = Object.fromEntries(
    Object.values(WorkerStatus).map((status) => [
      status,
      workerCounts.find((item) => item.status === status)?._count._all ?? 0
    ])
  );
  const completed = jobsByState.COMPLETED ?? 0;
  const failed = (jobsByState.FAILED ?? 0) + (jobsByState.DEAD_LETTER ?? 0);
  const totalTerminal = completed + failed;

  return {
    jobsByState,
    workersByStatus,
    queues,
    dlqCount,
    recentExecutions,
    successRate: totalTerminal === 0 ? 0 : completed / totalTerminal
  };
};
