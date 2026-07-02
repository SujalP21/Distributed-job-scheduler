import { Router } from "express";
import { z } from "zod";
import { AppError } from "@/common/errors/app-error";
import { validateBody } from "@/common/middleware/validate";
import { toSlug } from "@/common/utils/slug";
import { prisma } from "@/config/prisma";

export const organizationsRouter = Router();

const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(120).optional()
});

organizationsRouter.get("/", async (_req, res, next) => {
  try {
    const organizations = await prisma.organization.findMany({
      where: {
        deletedAt: null
      },
      orderBy: {
        createdAt: "desc"
      },
      include: {
        _count: {
          select: {
            projects: true,
            memberships: true
          }
        }
      }
    });

    res.json(organizations);
  } catch (error) {
    next(error);
  }
});

organizationsRouter.post("/", validateBody(createOrganizationSchema), async (req, res, next) => {
  try {
    const name = req.body.name as string;
    const slug = toSlug((req.body.slug as string | undefined) ?? name);
    const existing = await prisma.organization.findUnique({
      where: { slug }
    });

    if (existing) {
      throw new AppError(409, "ORGANIZATION_SLUG_EXISTS", "Organization slug already exists");
    }

    const organization = await prisma.organization.create({
      data: {
        name,
        slug
      },
      include: {
        _count: {
          select: {
            projects: true,
            memberships: true
          }
        }
      }
    });

    res.status(201).json(organization);
  } catch (error) {
    next(error);
  }
});
