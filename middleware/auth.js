import { hashToken } from "../lib/tokens.js";
import { pool } from "../db/pool.js";

export const sessionCookieName = "ezehlabs_session";

export async function requireAuth(request, response, next) {
  try {
    const token = request.cookies?.[sessionCookieName];
    if (!token) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }

    const session = await pool.query(
      `SELECT s.id AS session_id, s.user_id, u.email, u.full_name, u.phone,
              u.client_number, u.role, u.email_verified_at, u.created_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [hashToken(token)],
    );

    if (!session.rowCount) {
      response.clearCookie(sessionCookieName, cookieOptions());
      response.status(401).json({ error: "Session expired. Please sign in again." });
      return;
    }

    request.user = session.rows[0];
    request.sessionId = session.rows[0].session_id;
    await pool.query(
      `UPDATE sessions
       SET last_seen_at = NOW(),
           expires_at = NOW() + ($2 * INTERVAL '1 day')
       WHERE id = $1`,
      [request.sessionId, Number.parseInt(process.env.SESSION_TTL_DAYS ?? "7", 10)],
    );
    next();
  } catch (error) {
    next(error);
  }
}

export function requireVerified(request, response, next) {
  if (!request.user.email_verified_at) {
    response.status(403).json({ error: "Verify your email before using this feature." });
    return;
  }
  next();
}

export function requireAdmin(request, response, next) {
  if (request.user.role !== "admin") {
    response.status(403).json({ error: "Administrator access required." });
    return;
  }
  next();
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Number.parseInt(process.env.SESSION_TTL_DAYS ?? "7", 10) * 24 * 60 * 60 * 1000,
  };
}
