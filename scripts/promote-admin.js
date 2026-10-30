import "dotenv/config";
import { pool } from "../db/pool.js";

const email = process.argv[2]?.trim().toLowerCase();

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: npm run db:promote-admin -- email@example.com");
  process.exitCode = 2;
} else {
  try {
    const result = await pool.query(
      `UPDATE users
       SET role = 'admin', updated_at = NOW()
       WHERE email = $1 AND email_verified_at IS NOT NULL
       RETURNING id, email`,
      [email],
    );
    if (!result.rowCount) {
      throw new Error("No verified account exists for that email address.");
    }
    console.info(`Administrator role granted to ${result.rows[0].email}`);
  } catch (error) {
    console.error("Could not promote administrator", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
