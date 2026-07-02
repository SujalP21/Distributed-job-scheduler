import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "@/app";
import { AuthService } from "@/modules/auth/auth.service";
import type {
  CreateUserWithOrganizationInput,
  UserRepository
} from "@/modules/users/users.repository";
import type { PublicUser, UserWithPassword } from "@/modules/users/users.types";
import type {
  RefreshTokenRecord,
  RefreshTokenRepository
} from "@/modules/auth/refresh-token.repository";

class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, UserWithPassword>();

  async findByEmail(email: string): Promise<UserWithPassword | null> {
    return this.users.get(email.toLowerCase()) ?? null;
  }

  async findById(id: string): Promise<PublicUser | null> {
    const user = [...this.users.values()].find((candidate) => candidate.id === id);

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt
    };
  }

  async createUserWithOrganization(input: CreateUserWithOrganizationInput): Promise<PublicUser> {
    const user: UserWithPassword = {
      id: `user-${this.users.size + 1}`,
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash: input.passwordHash,
      createdAt: new Date()
    };

    this.users.set(user.email, user);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt
    };
  }

  async addUser(input: { email: string; password: string; name?: string }) {
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user: UserWithPassword = {
      id: `user-${this.users.size + 1}`,
      email: input.email.toLowerCase(),
      name: input.name ?? "Test User",
      passwordHash,
      createdAt: new Date()
    };

    this.users.set(user.email, user);
    return user;
  }
}

class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  private readonly tokens = new Map<string, RefreshTokenRecord>();

  async create(input: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord> {
    const record: RefreshTokenRecord = {
      id: `refresh-${this.tokens.size + 1}`,
      tokenHash: input.tokenHash,
      userId: input.userId,
      expiresAt: input.expiresAt,
      revokedAt: null
    };

    this.tokens.set(record.tokenHash, record);
    return record;
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return this.tokens.get(tokenHash) ?? null;
  }

  async revoke(tokenHash: string): Promise<void> {
    const record = this.tokens.get(tokenHash);

    if (record) {
      record.revokedAt = new Date();
    }
  }
}

const createTestApp = () => {
  const users = new InMemoryUserRepository();
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const authService = new AuthService({ users, refreshTokens });

  return {
    app: createApp({ authService }),
    users
  };
};

describe("auth API", () => {
  it("registers a user and organization owner", async () => {
    const { app } = createTestApp();

    const response = await request(app).post("/api/auth/register").send({
      email: "Owner@Example.com",
      name: "Owner User",
      password: "Password123",
      organizationName: "Acme Jobs"
    });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe("owner@example.com");
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));
  });

  it("rejects invalid registration payloads", async () => {
    const { app } = createTestApp();

    const response = await request(app).post("/api/auth/register").send({
      email: "not-an-email",
      name: "O",
      password: "weak",
      organizationName: "A"
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("logs in with valid credentials", async () => {
    const { app, users } = createTestApp();
    await users.addUser({ email: "user@example.com", password: "Password123" });

    const response = await request(app).post("/api/auth/login").send({
      email: "user@example.com",
      password: "Password123"
    });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));
  });

  it("rotates refresh tokens", async () => {
    const { app } = createTestApp();

    const registration = await request(app).post("/api/auth/register").send({
      email: "rotate@example.com",
      name: "Rotate User",
      password: "Password123",
      organizationName: "Rotate Org"
    });

    const refresh = await request(app).post("/api/auth/refresh").send({
      refreshToken: registration.body.refreshToken
    });

    expect(refresh.status).toBe(200);
    expect(refresh.body.refreshToken).not.toBe(registration.body.refreshToken);

    const replay = await request(app).post("/api/auth/refresh").send({
      refreshToken: registration.body.refreshToken
    });

    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("protects current-user route with bearer JWT middleware", async () => {
    const { app } = createTestApp();

    const unauthorized = await request(app).get("/api/auth/me");
    expect(unauthorized.status).toBe(401);

    const registration = await request(app).post("/api/auth/register").send({
      email: "me@example.com",
      name: "Me User",
      password: "Password123",
      organizationName: "Me Org"
    });

    const authorized = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${registration.body.accessToken}`);

    expect(authorized.status).toBe(200);
    expect(authorized.body.user.email).toBe("me@example.com");
  });
});
