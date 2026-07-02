import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../config/prisma";
import { redis } from "../config/redis";

jest.mock("../config/prisma", () => ({
  prisma: {
    $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
    worker: {
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([])
    }
  }
}));

jest.mock("../config/redis", () => ({
  redis: {
    status: "ready",
    connect: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue("PONG")
  }
}));

describe("GET /health", () => {
  it("reports API, Postgres, and Redis health", async () => {
    const response = await request(createApp()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.dependencies.api.status).toBe("ok");
    expect(response.body.dependencies.postgres.status).toBe("ok");
    expect(response.body.dependencies.redis.status).toBe("ok");
    expect(response.body.dependencies.workers.status).toBe("ok");
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.worker.count).toHaveBeenCalled();
    expect(redis.ping).toHaveBeenCalled();
  });
});
