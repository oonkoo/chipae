import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Postgres transaction-scoped advisory lock. Serializes racy check-then-write
 * paths that no unique constraint can cover (single active lobby per user,
 * friendship reverse-pairs, host transfer). Released automatically at
 * commit/rollback.
 *
 * Deadlock convention: when a transaction needs several locks, acquire
 * `seat:<userId>` before `lobby:<lobbyId>`; `pair:` locks are never combined
 * with others.
 */
export async function acquireTxLock(
  tx: Prisma.TransactionClient,
  key: string
): Promise<void> {
  // $executeRaw, not $queryRaw: pg_advisory_xact_lock() returns Postgres
  // `void`, which the pg driver adapter cannot deserialize as a result column.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}

export const lockKeys = {
  /** One active table per user. */
  seat: (userId: string) => `seat:${userId}`,
  /** Membership/host mutations for one lobby. */
  lobby: (lobbyId: string) => `lobby:${lobbyId}`,
  /** One relationship row per unordered user pair. */
  pair: (a: string, b: string) => `pair:${[a, b].sort().join(":")}`,
} as const;
