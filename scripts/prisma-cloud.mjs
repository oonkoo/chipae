// Run a Prisma CLI command against the CLOUD database.
//
// Why this exists: `DATABASE_URL="$CLOUD_DATABASE_URL" prisma ...` does not
// work, because the shell expands `$CLOUD_DATABASE_URL` from the shell
// environment — which never sees `.env` (only Node does, via dotenv) — so
// it becomes an empty string and Prisma reports "Connection url is empty".
//
// This loads .env in Node, then hands the cloud URL to Prisma through the
// child process environment. dotenv never overwrites a variable that is
// already set, so the override wins and no secret touches shell history.
//
//   npm run db:cloud -- migrate status
//   npm run db:cloud -- migrate deploy
//
// Use the cloud DIRECT connection string (db.prisma.io, no `pooled.`
// prefix) for CLOUD_DATABASE_URL — poolers break migrations, which need a
// real session for DDL and advisory locks.
import "dotenv/config";
import { spawnSync } from "node:child_process";

const url = process.env.CLOUD_DATABASE_URL;
if (!url) {
  console.error(
    "CLOUD_DATABASE_URL is not set in .env.\n" +
      "Add the cloud DIRECT connection string (host db.prisma.io, not " +
      "pooled.db.prisma.io) and try again."
  );
  process.exit(1);
}
if (url.includes("pooled.")) {
  console.error(
    "CLOUD_DATABASE_URL points at the pooled endpoint. Migrations need the\n" +
      "direct connection (host db.prisma.io) — a pooler cannot hold the\n" +
      "session state that DDL and advisory locks require."
  );
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: npm run db:cloud -- migrate deploy");
  process.exit(1);
}

const host = url.split("@")[1]?.split("/")[0] ?? "unknown host";
console.log(`→ prisma ${args.join(" ")}  (cloud: ${host})`);

const result = spawnSync("npx", ["prisma", ...args], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
  shell: true,
});
process.exit(result.status ?? 1);
