import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/config/prisma";

export class DeadLetterService {
  constructor(private readonly db: PrismaClient = prisma) {}

  listEntries() {
    return this.db.deadLetterQueue.findMany({
      orderBy: {
        failedAt: "desc"
      },
      take: 100,
      include: {
        queue: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        job: {
          select: {
            id: true,
            type: true,
            state: true,
            attempts: true,
            maxAttempts: true
          }
        }
      }
    });
  }
}
