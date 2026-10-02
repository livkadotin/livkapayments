const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Try reading local .env if DATABASE_URL is not already set in process.env
if (!process.env.DATABASE_URL) {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const dotenv = fs.readFileSync(envPath, "utf8");
      for (const line of dotenv.split("\n")) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = (match[2] || "").trim().replace(/^["']|["']$/g, "");
        }
      }
    }
  } catch (err) {
    console.warn("Could not load local .env file:", err.message);
  }
}

const dbUrl = (process.env.DATABASE_URL || "").trim();
const isVercel = Boolean(process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL_ENV);
const isPostgres =
  dbUrl.startsWith("postgresql://") ||
  dbUrl.startsWith("postgres://") ||
  (isVercel && !dbUrl.startsWith("file:"));

const schemaPath = isPostgres
  ? path.join("prisma", "schema.prisma")
  : path.join("prisma", "schema.sqlite.prisma");

console.log(`[replyflow-pay] Generating Prisma client with schema: ${schemaPath} (${isPostgres ? "PostgreSQL" : "SQLite"})`);

try {
  execSync(`npx prisma generate --schema="${schemaPath}"`, {
    stdio: "inherit",
    env: process.env,
  });
  console.log(`[replyflow-pay] Prisma client generated successfully.`);
} catch (error) {
  console.error(`[replyflow-pay] Failed to generate Prisma client:`, error.message);
  process.exit(1);
}

