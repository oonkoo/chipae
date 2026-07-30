// Prove a database URL from .env can actually connect, before trusting it
// in Vercel. Prints the host and a table count — never the credentials.
//
//   node scripts/db-check.mjs DATABASE_URL
//   node scripts/db-check.mjs POOLED_DATABASE_URL
//
// Exits non-zero on failure, so it is safe to use in a pre-deploy check.
import "dotenv/config";
import pg from "pg";

const name = process.argv[2] ?? "DATABASE_URL";
const url = process.env[name];

if (!url) {
  console.error(`✗ ${name} is not set in .env`);
  process.exit(1);
}
if (url.startsWith("prisma+postgres://")) {
  console.error(
    `✗ ${name} is a prisma+postgres:// API URL. That works for Prisma CLI\n` +
      `  commands only — the runtime driver adapter needs a direct or pooled\n` +
      `  postgres:// connection string.`
  );
  process.exit(1);
}

// Host only: everything before the @ is the credential pair.
const host = url.split("@")[1]?.split("?")[0] ?? "unknown";
console.log(`→ ${name} → ${host}`);

const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  const { rows } = await client.query(
    `select count(*)::int as tables
       from information_schema.tables
      where table_schema = 'public'`
  );
  console.log(`✓ connected — ${rows[0].tables} tables in public schema`);
  if (rows[0].tables === 0) {
    console.log("  (schema is empty — migrations have not been applied here)");
  }
} catch (error) {
  console.error(`✗ connection failed: ${error.message}`);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
