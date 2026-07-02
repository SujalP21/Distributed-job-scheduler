import { JobState, QueueStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { AppError } from "@/common/errors/app-error";
import { prisma } from "@/config/prisma";
import type { createQueueSchema, updateQueueSchema } from "./queue.schemas";
import type { z } from "zod";

type CreateQueueInput = z.infer<typeof createQueueSchema>;
type UpdateQueueInput = z.infer<typeof updateQueueSchema>;

export class QueueService {
  constructor(private readonly db: PrismaClient = prisma) {}

  createQueue(input: CreateQueueInput) {
    return this.db.queue.create({
      data: {
        ...input,
        slug: input.slug.toLowerCase()
      }
    });
  }

  async updateQueue(queueId: string, input: UpdateQueueInput) {
    await this.ensureQueue(queueId);

    return this.db.queue.update({
      where: { id: queueId },
      data: input
    });
  }

  pauseQueue(queueId: string) {
    return this.updateQueue(queueId, { status: QueueStatus.PAUSED });
  }

  resumeQueue(queueId: string) {
    return this.updateQueue(queueId, { status: QueueStatus.ACTIVE });
  }

  async deleteQueue(queueId: string) {
    await this.ensureQueue(queueId);

    return this.db.queue.update({
      where: { id: queueId },
      data: {
        status: QueueStatus.ARCHIVED,
        deletedAt: new Date()
      }
    });
  }

  async getStatistics(queueId: string) {
    await this.ensureQueue(queueId);

    const grouped = await this.db.job.groupBy({
      by: ["state"],
      where: { queueId },
      _count: { _all: true }
    });

    const counts = Object.fromEntries(
      Object.values(JobState).map((state) => [
        state,
        grouped.find((item) => item.state === state)?._count._all ?? 0
      ])
    );

    const activeWorkers = await this.db.worker.count({
      where: {
        queueId,
        status: "ONLINE"
      }
    });

    return {
      queueId,
      counts,
      activeWorkers
    };
  }

  private async ensureQueue(queueId: string) {
    const queue = await this.db.queue.findUnique({
      where: { id: queueId }
    });

    if (!queue) {
      throw new AppError(404, "QUEUE_NOT_FOUND", "Queue was not found");
    }

    return queue;
  }
}
