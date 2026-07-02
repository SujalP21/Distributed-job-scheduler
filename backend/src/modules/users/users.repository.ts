import { randomUUID } from "node:crypto";
import { toSlug } from "@/common/utils/slug";
import { prisma } from "@/config/prisma";
import type { PublicUser, UserWithPassword } from "./users.types";

export type CreateUserWithOrganizationInput = {
  email: string;
  name: string;
  passwordHash: string;
  organizationName: string;
};

export type UserRepository = {
  findByEmail(email: string): Promise<UserWithPassword | null>;
  findById(id: string): Promise<PublicUser | null>;
  createUserWithOrganization(input: CreateUserWithOrganizationInput): Promise<PublicUser>;
};

const toPublicUser = (user: {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}): PublicUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  createdAt: user.createdAt
});

export class PrismaUserRepository implements UserRepository {
  async findByEmail(email: string): Promise<UserWithPassword | null> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    return user ? { ...toPublicUser(user), passwordHash: user.passwordHash } : null;
  }

  async findById(id: string): Promise<PublicUser | null> {
    const user = await prisma.user.findUnique({
      where: { id }
    });

    return user ? toPublicUser(user) : null;
  }

  async createUserWithOrganization(input: CreateUserWithOrganizationInput): Promise<PublicUser> {
    const baseSlug = toSlug(input.organizationName);
    const uniqueSlug = `${baseSlug}-${randomUUID().slice(0, 8)}`;

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          name: input.name,
          passwordHash: input.passwordHash
        }
      });

      const organization = await tx.organization.create({
        data: {
          name: input.organizationName,
          slug: uniqueSlug
        }
      });

      await tx.organizationMembership.create({
        data: {
          userId: createdUser.id,
          organizationId: organization.id,
          role: "OWNER"
        }
      });

      return createdUser;
    });

    return toPublicUser(user);
  }
}
