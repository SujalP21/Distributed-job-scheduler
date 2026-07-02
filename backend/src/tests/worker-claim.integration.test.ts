import { PrismaClient, QueueStatus } from "@prisma/client";
import { WorkerService } from "@/modules/workers/worker.service";

const prisma = new PrismaClient();
const workerService = new WorkerService(prisma);

const testRun = `phase4_${Date.now()}`;

const createFixture = async (input: {
  suffix: string;
  concurrencyLimit?: number;
  jobCount: number;
  workerCount: number;
}) => {
  const organization = await prisma.organization.create({
    data: {
      name: `Phase 4 ${input.suffix}`,
      slug: `${testRun}_${input.suffix}`.toLowerCase()
    }
  });

  const project = await prisma.project.create({
    data: {
      organizationId: organization.id,
      name: `Phase 4 Project ${input.suffix}`,
      slug: `project-${input.suffix}`
    }
  });

  const retryPolicy = await prisma.retryPolicy.create({
    data: {
      projectId: project.id,
      name: `retry-${input.suffix}`,
      strategy: "FIXED",
      maxAttempts: 3,
      baseDelaySeconds: 1,
      maxDelaySeconds: 10
    }
  });

  const queue = await prisma.queue.create({
    data: {
      projectId: project.id,
      retryPolicyId: retryPolicy.id,
      name: `Queue ${input.suffix}`,
      slug: `queue-${input.suffix}`,
      status: QueueStatus.ACTIVE,
      concurrencyLimit: input.concurrencyLimit ?? input.jobCount,
      priorityWeight: 100
    }
  });

  await prisma.job.createMany({
    data: Array.from({ length: input.jobCount }, (_, index) => ({
      projectId: project.id,
      queueId: queue.id,
      retryPolicyId: retryPolicy.id,
      type: "IMMEDIATE",
      state: "QUEUED",
      priority: input.jobCount - index,
      payload: {
        index
      }
    }))
  });

  const workers = await Promise.all(
    Array.from({ length: input.workerCount }, (_, index) =>
      prisma.worker.create({
        data: {
          projectId: project.id,
          queueId: queue.id,
          name: `worker-${input.suffix}-${index}`,
          status: "ONLINE",
          concurrency: 10,
          lastHeartbeatAt: new Date()
        }
      })
    )
  );

  return {
    organization,
    project,
    queue,
    workers
  };
};

afterAll(async () => {
  await prisma.organization.deleteMany({
    where: {
      slug: {
        startsWith: testRun.toLowerCase()
      }
    }
  });
  await prisma.$disconnect();
});

describe("worker atomic claiming", () => {
  it("prevents two workers from claiming the same job", async () => {
    const fixture = await createFixture({
      suffix: "single",
      concurrencyLimit: 1,
      jobCount: 1,
      workerCount: 2
    });

    const [firstClaim, secondClaim] = await Promise.all(
      fixture.workers.map((worker) => workerService.claimNextJob(worker.id))
    );

    const claimedJobs = [firstClaim, secondClaim].filter((claim) => claim !== null);

    expect(claimedJobs).toHaveLength(1);
    expect(new Set(claimedJobs.map((claim) => claim.job.id)).size).toBe(1);

    const executions = await prisma.jobExecution.findMany({
      where: {
        job: {
          queueId: fixture.queue.id
        }
      }
    });

    expect(executions).toHaveLength(1);
  });

  it("executes 100 queued jobs exactly once with 10 concurrent workers", async () => {
    const fixture = await createFixture({
      suffix: "stress",
      concurrencyLimit: 100,
      jobCount: 100,
      workerCount: 10
    });

    const claimedIds: string[] = [];

    await Promise.all(
      fixture.workers.map(async (worker) => {
        let shouldContinue = true;

        while (shouldContinue) {
          const claimed = await workerService.claimNextJob(worker.id);

          if (!claimed) {
            shouldContinue = false;
            continue;
          }

          claimedIds.push(claimed.job.id);
          await workerService.completeExecution({
            jobId: claimed.job.id,
            executionId: claimed.execution.id,
            result: {
              workerId: worker.id
            }
          });
        }
      })
    );

    const uniqueClaimedIds = new Set(claimedIds);
    const completedJobs = await prisma.job.count({
      where: {
        queueId: fixture.queue.id,
        state: "COMPLETED"
      }
    });
    const executions = await prisma.jobExecution.groupBy({
      by: ["jobId"],
      where: {
        job: {
          queueId: fixture.queue.id
        }
      },
      _count: {
        _all: true
      }
    });

    expect(claimedIds).toHaveLength(100);
    expect(uniqueClaimedIds.size).toBe(100);
    expect(completedJobs).toBe(100);
    expect(executions).toHaveLength(100);
    expect(executions.every((execution) => execution._count._all === 1)).toBe(true);
  });
});
