import type { PrismaClient } from "@prisma/client";
import { AppError } from "@/common/errors/app-error";
import { toSlug } from "@/common/utils/slug";
import { prisma } from "@/config/prisma";

export type CreateProjectInput = {
  organizationId: string;
  name: string;
  slug?: string;
  description?: string;
};

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

  async createProject(input: CreateProjectInput) {
    const organization = await this.db.organization.findUnique({
      where: { id: input.organizationId }
    });

    if (!organization || organization.deletedAt) {
      throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization was not found");
    }

    const slug = toSlug(input.slug ?? input.name);
    const existing = await this.db.project.findUnique({
      where: {
        organizationId_slug: {
          organizationId: input.organizationId,
          slug
        }
      }
    });

    if (existing) {
      throw new AppError(409, "PROJECT_SLUG_EXISTS", "Project slug already exists");
    }

    return this.db.project.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        slug,
        description: input.description
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
