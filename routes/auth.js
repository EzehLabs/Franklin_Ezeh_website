import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db/pool.js";
import { cookieOptions, requireAuth, sessionCookieName } from "../middleware/auth.js";
import { sendVerificationEmail } from "../lib/mailer.js";
import { createOpaqueToken, formatClientNumber, hashToken } from "../lib/tokens.js";
import { loginSchema, registerSchema } from "../lib/validation.js";

const router = Router();
const verificationLifetimeHours = 24;

function publicUser(user) {
  return {
    id: user.id,
    clientId: formatClientNumber(user.client_number),
    fullName: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    emailVerified: Boolean(user.email_verified_at),
    createdAt: user.created_at,
  };
}

async function createSession(user, request, response) {
  const token = createOpaqueToken();
  const sessionDays = Number.parseInt(process.env.SESSION_TTL_DAYS ?? "7", 10);
  await pool.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent)
     VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 day'), $4)`,
    [user.id, hashToken(token), sessionDays, request.get("user-agent")?.slice(0, 500) ?? null],
  );
  response.cookie(sessionCookieName, token, cookieOptions());
}

router.post("/register", async (request, response) => {
  const input = registerSchema.parse(request.body);
  const rounds = Number.parseInt(process.env.BCRYPT_ROUNDS ?? "12", 10);
  const passwordHash = await bcrypt.hash(input.password, rounds);
  const token = createOpaqueToken();
  const client = await pool.connect();
  let user;

  try {
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO users (full_name, email, phone, password_hash)
       VALUES ($1, $2, NULLIF($3, ''), $4)
       RETURNING id, client_number, email, full_name, phone, role, email_verified_at`,
      [input.fullName, input.email, input.phone, passwordHash],
    );
    user = result.rows[0];
    await client.query(
      `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 hour'))`,
      [user.id, hashToken(token), verificationLifetimeHours],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  try {
    await sendVerificationEmail({ email: user.email, fullName: user.full_name, token });
  } catch (error) {
    console.error("Could not send account verification email", {
      userId: user.id,
      error: error.message,
    });
    response.status(503).json({
      error: "Your account was created but the verification email could not be sent. Please request a new verification email.",
      accountCreated: true,
    });
    return;
  }

  response.status(201).json({
    message: "Account created. Check your email to verify your address before signing in.",
    clientId: formatClientNumber(user.client_number),
  });
});

router.post("/verify-email", async (request, response) => {
  const token = typeof request.body?.token === "string" ? request.body.token : "";
  if (token.length < 32 || token.length > 200) {
    response.status(400).json({ error: "A valid verification token is required." });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const verification = await client.query(
      `SELECT id, user_id
       FROM email_verification_tokens
       WHERE token_hash = $1 AND expires_at > NOW()
       FOR UPDATE`,
      [hashToken(token)],
    );
    if (!verification.rowCount) {
      await client.query("ROLLBACK");
      response.status(400).json({ error: "This verification link is invalid or expired." });
      return;
    }

    await client.query(
      "UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()), updated_at = NOW() WHERE id = $1",
      [verification.rows[0].user_id],
    );
    await client.query("DELETE FROM email_verification_tokens WHERE user_id = $1", [
      verification.rows[0].user_id,
    ]);
    await client.query("COMMIT");
    response.json({ message: "Email verified. You can now sign in." });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.post("/resend-verification", async (request, response) => {
  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    response.status(400).json({ error: "Enter a valid email address." });
    return;
  }

  const client = await pool.connect();
  let user;
  let token;
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT id, email, full_name
       FROM users
       WHERE email = $1 AND email_verified_at IS NULL
       FOR UPDATE`,
      [email],
    );
    if (result.rowCount) {
      user = result.rows[0];
      token = createOpaqueToken();
      await client.query("DELETE FROM email_verification_tokens WHERE user_id = $1", [user.id]);
      await client.query(
        `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 hour'))`,
        [user.id, hashToken(token), verificationLifetimeHours],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  if (user) {
    try {
      await sendVerificationEmail({ email: user.email, fullName: user.full_name, token });
    } catch (error) {
      console.error("Could not resend account verification email", {
        userId: user.id,
        error: error.message,
      });
      response.status(503).json({ error: "Email delivery is unavailable. Try again later." });
      return;
    }
  }

  response.json({ message: "If the address needs verification, a new link has been sent." });
});

router.post("/login", async (request, response) => {
  const input = loginSchema.parse(request.body);
  const result = await pool.query(
    `SELECT id, client_number, email, full_name, phone, role, email_verified_at, password_hash, created_at
     FROM users WHERE email = $1`,
    [input.email],
  );

  const user = result.rows[0];
  const passwordHash = user?.password_hash ?? "$2b$12$C6UzMDM.H6dfI/f/IKcEe.8W0YvUQK0pSuy1IbR6xFMe9Gn6wBla";
  const validPassword = await bcrypt.compare(input.password, passwordHash);
  if (!user || !validPassword) {
    response.status(401).json({ error: "Email or password is incorrect." });
    return;
  }
  if (!user.email_verified_at) {
    response.status(403).json({ error: "Verify your email before signing in." });
    return;
  }

  await createSession(user, request, response);
  response.json({ user: publicUser(user) });
});

router.post("/logout", async (request, response) => {
  const token = request.cookies?.[sessionCookieName];
  if (token) await pool.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
  response.clearCookie(sessionCookieName, cookieOptions());
  response.status(204).end();
});

router.get("/me", requireAuth, (request, response) => {
  response.json({ user: publicUser(request.user) });
});

export default router;
