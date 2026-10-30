import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth, requireVerified } from "../middleware/auth.js";
import { proposalSchema, readUuid } from "../lib/validation.js";

const router = Router();

router.use(requireAuth, requireVerified);

router.post("/", async (request, response) => {
  const input = proposalSchema.parse(request.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO proposals (client_id, service_type, description, budget_range, timeline)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, service_type, description, budget_range, timeline, status, created_at`,
      [
        request.user.user_id,
        input.serviceType,
        input.description,
        input.budgetRange,
        input.timeline,
      ],
    );
    await client.query(
      `INSERT INTO proposal_status_history
        (proposal_id, changed_by, previous_status, new_status)
       VALUES ($1, $2, NULL, 'Submitted')`,
      [result.rows[0].id, request.user.user_id],
    );
    await client.query("COMMIT");
    response.status(201).json({ proposal: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.get("/", async (request, response) => {
  const result = await pool.query(
    `SELECT id, service_type, description, budget_range, timeline, status, created_at, updated_at
     FROM proposals
     WHERE client_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [request.user.user_id],
  );
  response.json({ proposals: result.rows });
});

router.get("/:id", async (request, response) => {
  const id = readUuid(request.params.id);
  if (!id.success) {
    response.status(400).json({ error: "A valid proposal ID is required." });
    return;
  }

  const result = await pool.query(
    `SELECT p.id, p.service_type, p.description, p.budget_range, p.timeline,
            p.status, p.created_at, p.updated_at
     FROM proposals p
     WHERE p.id = $1 AND (p.client_id = $2 OR $3 = 'admin')`,
    [id.data, request.user.user_id, request.user.role],
  );
  if (!result.rowCount) {
    response.status(404).json({ error: "Proposal not found." });
    return;
  }
  response.json({ proposal: result.rows[0] });
});

export default router;
