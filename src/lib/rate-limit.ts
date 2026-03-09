interface RateLimitConfig {
  interval: number; // window in ms (e.g. 60_000 for 1 min)
  maxRequests: number; // max requests per window
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 60s
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}, 60_000);
cleanup.unref();

export function rateLimit(config: RateLimitConfig) {
  return function check(key: string): RateLimitResult {
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + config.interval });
      return { success: true, remaining: config.maxRequests - 1 };
    }

    if (entry.count >= config.maxRequests) {
      return { success: false, remaining: 0 };
    }

    entry.count++;
    return { success: true, remaining: config.maxRequests - entry.count };
  };
}

/** Pre-configured limiter for API mutation endpoints: 10 req/min */
export const apiLimiter = rateLimit({ interval: 60_000, maxRequests: 10 });

/** Stricter limiter for deployment endpoints: 5 req/min */
export const deployLimiter = rateLimit({ interval: 60_000, maxRequests: 5 });

// Expose for testing
export const _store = store;
