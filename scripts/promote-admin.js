import "dotenv/config";
import { pool } from "../db/pool.js";

const email = process.argv[2]?.trim().toLowerCase();
const username = process.argv[3]?.trim().toLowerCase();
const fullName = process.argv[4]?.trim();

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !username || !/^[a-z0-9._-]{3,30}$/.test(username) ||
    !fullName || fullName.length > 120) {
  console.error('Usage: npm run db:promote-admin -- email@example.com admin-username "Admin Name"');
  process.exitCode = 2;
} else {
  try {
    const result = await pool.query(
      `UPDATE users
       SET role = 'admin', username = $2, full_name = $3, updated_at = NOW()
       WHERE email = $1 AND email_verified_at IS NOT NULL
       RETURNING id, email`,
      [email, username, fullName],
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
