import { prisma } from "@/config/prisma";

export type RefreshTokenRecord = {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type RefreshTokenRepository = {
  create(input: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revoke(tokenHash: string): Promise<void>;
};

export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  async create(input: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord> {
    return prisma.refreshToken.create({
      data: input
    });
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return prisma.refreshToken.findUnique({
      where: { tokenHash }
    });
  }

  async revoke(tokenHash: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
  }
}
