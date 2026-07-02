import { env } from "../config/env";

describe("environment configuration", () => {
  it("loads typed runtime defaults", () => {
    expect(env.PORT).toBeGreaterThan(0);
    expect(env.DATABASE_URL).toContain("postgresql://");
    expect(env.REDIS_URL).toContain("redis://");
  });
});
