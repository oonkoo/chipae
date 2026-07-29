import "server-only";

/**
 * Fixed-window in-memory rate limiter. Scope: one warm server instance —
 * good enough to blunt accidental loops and casual abuse in v1. Swap the
 * backing store for Redis/Upstash before real multi-instance scale.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();

  if (buckets.size > MAX_BUCKETS) {
    for (const [k, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) {
    return false;
  }
  bucket.count += 1;
  return true;
}

export const RATE = {
  search: { limit: 20, windowMs: 60_000 },
  usernameCheck: { limit: 30, windowMs: 60_000 },
  friendRequest: { limit: 15, windowMs: 60_000 },
  chat: { limit: 15, windowMs: 10_000 },
  invite: { limit: 20, windowMs: 60_000 },
  createLobby: { limit: 10, windowMs: 60_000 },
  joinCode: { limit: 15, windowMs: 60_000 },
} as const;
