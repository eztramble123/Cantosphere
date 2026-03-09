import { describe, it, expect, beforeEach, vi } from "vitest";
import { rateLimit, _store } from "../rate-limit";

beforeEach(() => {
  _store.clear();
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("allows requests within the limit", () => {
    const limiter = rateLimit({ interval: 60_000, maxRequests: 3 });

    expect(limiter("user-1")).toEqual({ success: true, remaining: 2 });
    expect(limiter("user-1")).toEqual({ success: true, remaining: 1 });
    expect(limiter("user-1")).toEqual({ success: true, remaining: 0 });
  });

  it("blocks requests exceeding the limit", () => {
    const limiter = rateLimit({ interval: 60_000, maxRequests: 2 });

    limiter("user-1");
    limiter("user-1");
    const result = limiter("user-1");

    expect(result).toEqual({ success: false, remaining: 0 });
  });

  it("isolates keys from each other", () => {
    const limiter = rateLimit({ interval: 60_000, maxRequests: 1 });

    expect(limiter("user-1").success).toBe(true);
    expect(limiter("user-2").success).toBe(true);
    expect(limiter("user-1").success).toBe(false);
    expect(limiter("user-2").success).toBe(false);
  });

  it("resets after the window expires", () => {
    vi.useFakeTimers();
    const limiter = rateLimit({ interval: 1000, maxRequests: 1 });

    expect(limiter("user-1").success).toBe(true);
    expect(limiter("user-1").success).toBe(false);

    vi.advanceTimersByTime(1001);

    expect(limiter("user-1").success).toBe(true);
  });

  it("tracks remaining count accurately", () => {
    const limiter = rateLimit({ interval: 60_000, maxRequests: 5 });

    expect(limiter("user-1").remaining).toBe(4);
    expect(limiter("user-1").remaining).toBe(3);
    expect(limiter("user-1").remaining).toBe(2);
    expect(limiter("user-1").remaining).toBe(1);
    expect(limiter("user-1").remaining).toBe(0);
    // After limit reached
    expect(limiter("user-1").remaining).toBe(0);
  });
});
