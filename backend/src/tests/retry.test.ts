import { RetryStrategy } from "@prisma/client";
import { calculateRetryDecision } from "@/modules/retry/retry.service";

describe("retry delay calculation", () => {
  const now = new Date("2026-07-02T00:00:00.000Z");

  it("supports fixed delay", () => {
    const decision = calculateRetryDecision({
      attempts: 1,
      maxAttempts: 3,
      strategy: RetryStrategy.FIXED,
      baseDelaySeconds: 30,
      maxDelaySeconds: 300,
      now
    });

    expect(decision.shouldRetry).toBe(true);
    expect(decision.delaySeconds).toBe(30);
  });

  it("supports linear backoff", () => {
    const decision = calculateRetryDecision({
      attempts: 3,
      maxAttempts: 5,
      strategy: RetryStrategy.LINEAR,
      baseDelaySeconds: 10,
      maxDelaySeconds: 300,
      now
    });

    expect(decision.delaySeconds).toBe(30);
  });

  it("supports exponential backoff and max-attempt exhaustion", () => {
    const decision = calculateRetryDecision({
      attempts: 4,
      maxAttempts: 5,
      strategy: RetryStrategy.EXPONENTIAL,
      baseDelaySeconds: 10,
      maxDelaySeconds: 60,
      now
    });
    const exhausted = calculateRetryDecision({
      attempts: 5,
      maxAttempts: 5,
      now
    });

    expect(decision.delaySeconds).toBe(60);
    expect(exhausted.shouldRetry).toBe(false);
  });
});
