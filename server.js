import "dotenv/config";
import app from "./app.js";
import { pool } from "./db/pool.js";

function validateEnvironment() {
  const required = ["DATABASE_URL", "APP_ORIGIN"];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  let origin;
  try {
    origin = new URL(process.env.APP_ORIGIN);
  } catch {
    throw new Error("APP_ORIGIN must be a valid absolute URL.");
  }
  if (!["http:", "https:"].includes(origin.protocol)) {
    throw new Error("APP_ORIGIN must use HTTP or HTTPS.");
  }

  const sessionDays = Number.parseInt(process.env.SESSION_TTL_DAYS ?? "7", 10);
  if (!Number.isInteger(sessionDays) || sessionDays < 1 || sessionDays > 30) {
    throw new Error("SESSION_TTL_DAYS must be between 1 and 30.");
  }
  const rounds = Number.parseInt(process.env.BCRYPT_ROUNDS ?? "12", 10);
  if (!Number.isInteger(rounds) || rounds < 10 || rounds > 15) {
    throw new Error("BCRYPT_ROUNDS must be between 10 and 15.");
  }
}

validateEnvironment();
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const server = app.listen(port, () => {
  console.info(`EzehLabs server listening on port ${port}`);
});

async function shutdown(signal) {
  console.info(`${signal} received; shutting down.`);
  server.close(async (error) => {
    try {
      await pool.end();
    } catch (poolError) {
      console.error("Could not close the database pool", poolError);
      process.exitCode = 1;
    }
    if (error) {
      console.error("Could not close HTTP server cleanly", error);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
