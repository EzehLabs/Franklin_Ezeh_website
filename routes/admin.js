import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAdmin, requireAuth, requireVerified } from "../middleware/auth.js";
import { proposalUpdateSchema, readUuid } from "../lib/validation.js";

const router = Router();
const proposalStatuses = new Set([
  "Submitted",
  "In review",
  "Quoted",
  "Accepted",
  "In progress",
  "Completed",
  "Declined",
]);

router.use(requireAuth, requireVerified, requireAdmin);

router.get("/clients", async (request, response) => {
  const search = typeof request.query.q === "string" ? request.query.q.trim().slice(0, 120) : "";
  const result = await pool.query(
    `SELECT u.id, u.client_number, u.full_name, u.email, u.phone,
            u.email_verified_at, u.created_at,
            COUNT(p.id)::INT AS proposal_count
     FROM users u
     LEFT JOIN proposals p ON p.client_id = u.id
     WHERE u.role = 'client'
       AND ($1 = '' OR u.full_name ILIKE '%' || $1 || '%' OR
            u.email ILIKE '%' || $1 || '%' OR
            ('EL-' || LPAD(u.client_number::TEXT, 6, '0')) ILIKE '%' || $1 || '%')
     GROUP BY u.id
     ORDER BY u.created_at DESC
     LIMIT 100`,
    [search],
  );
  response.json({
    clients: result.rows.map((client) => ({
      ...client,
      client_id: `EL-${String(client.client_number).padStart(6, "0")}`,
      email_verified: Boolean(client.email_verified_at),
    })),
  });
});

router.get("/proposals", async (request, response) => {
  const status = typeof request.query.status === "string" ? request.query.status : "";
  if (status && !proposalStatuses.has(status)) {
    response.status(400).json({ error: "Unknown proposal status." });
    return;
  }
  const result = await pool.query(
    `SELECT p.id, p.service_type, p.description, p.budget_range, p.timeline,
            p.status, p.private_notes, p.created_at, p.updated_at,
            u.id AS client_id, u.client_number, u.full_name AS client_name,
            u.email AS client_email
     FROM proposals p
     JOIN users u ON u.id = p.client_id
     WHERE ($1 = '' OR p.status = $1)
     ORDER BY p.created_at DESC
     LIMIT 200`,
    [status],
  );
  response.json({
    proposals: result.rows.map((proposal) => ({
      ...proposal,
      client_number: `EL-${String(proposal.client_number).padStart(6, "0")}`,
    })),
  });
});

router.patch("/proposals/:id", async (request, response) => {
  const id = readUuid(request.params.id);
  if (!id.success) {
    response.status(400).json({ error: "A valid proposal ID is required." });
    return;
  }
  const input = proposalUpdateSchema.parse(request.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const previous = await client.query(
      "SELECT status FROM proposals WHERE id = $1 FOR UPDATE",
      [id.data],
    );
    if (!previous.rowCount) {
      await client.query("ROLLBACK");
      response.status(404).json({ error: "Proposal not found." });
      return;
    }
    const previousStatus = previous.rows[0].status;
    const updated = await client.query(
      `UPDATE proposals
       SET status = $2, private_notes = NULLIF($3, ''), updated_at = NOW()
       WHERE id = $1
       RETURNING id, status, updated_at`,
      [id.data, input.status, input.privateNote],
    );
    await client.query(
      `INSERT INTO proposal_status_history
        (proposal_id, changed_by, previous_status, new_status, private_note)
       VALUES ($1, $2, $3, $4, NULLIF($5, ''))`,
      [id.data, request.user.user_id, previousStatus, input.status, input.privateNote],
    );
    await client.query("COMMIT");
    response.json({ proposal: updated.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

export default router;
