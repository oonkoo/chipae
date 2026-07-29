import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 requires a driver adapter. Runtime connections need a direct TCP
// postgres:// URL — local `prisma dev` or Prisma Postgres "direct connection"
// credentials (db.prisma.io:5432, sslmode=require). The prisma+postgres://
// API-key URL only works for CLI commands (migrate), not the runtime driver.
function makeAdapter() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set — see .env.example");
  }
  if (url.startsWith("prisma+postgres://")) {
    throw new Error(
      "DATABASE_URL is a prisma+postgres:// API URL, which the runtime driver cannot use. " +
        "Generate direct TCP credentials in Prisma Console (postgres://...@db.prisma.io:5432/...?sslmode=require)."
    );
  }
  // Pool tuning, all driven by the local `prisma dev` server's quirks:
  //  - it resets connections beyond ~7 concurrent, so stay under that;
  //  - an aborted query (Next.js cancels in-flight RSC renders on
  //    navigation/refresh) can leave a socket protocol-desynced, after
  //    which every reuse fails with 08P01 "bind message supplies N
  //    parameters, but prepared statement requires 0". Retiring sockets
  //    quickly (few uses, short idle life) keeps a poisoned one from
  //    serving request after request.
  return new PrismaPg({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    keepAlive: true,
    maxUses: 50,
    idleTimeoutMillis: 10_000,
    maxLifetimeSeconds: 120,
  });
}

// Dev-safe singleton: Next.js hot reload re-evaluates modules; cache on
// globalThis so we don't leak connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ?? new PrismaClient({ adapter: makeAdapter() });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
