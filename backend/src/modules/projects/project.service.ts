import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/config/prisma";

export class ProjectService {
  constructor(private readonly db: PrismaClient = prisma) {}

  listProjects() {
    return this.db.project.findMany({
      where: {
        deletedAt: null
      },
      orderBy: {
        createdAt: "desc"
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        _count: {
          select: {
            queues: true,
            jobs: true,
            workers: true
          }
        }
      }
    });
  }
}
