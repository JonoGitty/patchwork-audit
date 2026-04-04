/**
 * Ingest endpoint — receives event batches from sync agents.
 *
 * POST /api/v1/ingest
 * Authorization: Bearer pw_...
 * Body: SyncEnvelope (JSON)
 */

import { Hono } from "hono";
import type { TeamDb } from "../db/schema.js";
import { machineAuth } from "../middleware/auth.js";
import { SyncEnvelopeSchema } from "../../protocol.js";
import { verifyEnvelope, computeBatchHash } from "../../crypto.js";
import { insertEvents, updateMachineSync, insertSeal, type EventInsert } from "../db/queries.js";

export function ingestRoutes(db: TeamDb): Hono {
	const app = new Hono();

	app.post("/api/v1/ingest", machineAuth(db), async (c) => {
		const machine = c.get("machine") as any;
		const teamId = c.get("teamId") as string;

		// Parse body
		let body: unknown;
		try {
			body = await c.req.json();
		} catch {
			return c.json({ ok: false, error: "Invalid JSON body" }, 400);
		}

		// Validate envelope schema
		const parsed = SyncEnvelopeSchema.safeParse(body);
		if (!parsed.success) {
			const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
			return c.json({ ok: false, error: `Schema validation failed: ${issues}` }, 400);
		}

		const envelope = parsed.data;

		// Verify envelope HMAC signature
		// We need the raw API key to verify, but we only store the hash.
		// The auth middleware already validated the Bearer token matches a machine.
		// For HMAC verification, we extract the key from the Authorization header.
		const authHeader = c.req.header("Authorization") || "";
		const apiKey = authHeader.slice(7); // Strip "Bearer "

		if (!verifyEnvelope(envelope, apiKey)) {
			return c.json({ ok: false, error: "Envelope signature verification failed" }, 401);
		}

		// Verify batch hash
		const computedHash = computeBatchHash(envelope.events);
		if (computedHash !== envelope.batch_hash) {
			return c.json({ ok: false, error: "Batch hash mismatch" }, 400);
		}

		// Convert events to insert format
		const eventRows: EventInsert[] = envelope.events.map((evt: any) => ({
			id: evt.id || `unknown_${Date.now()}`,
			machine_id: machine.id,
			team_id: teamId,
			session_id: evt.session_id || "",
			timestamp: evt.timestamp || new Date().toISOString(),
			agent: evt.agent || "unknown",
			action: evt.action || "unknown",
			status: evt.status || "completed",
			target_type: evt.target?.type,
			target_path: evt.target?.path,
			target_command: evt.target?.command,
			risk_level: evt.risk?.level || "none",
			risk_flags: evt.risk?.flags ? JSON.stringify(evt.risk.flags) : null,
			event_hash: evt.event_hash,
			prev_hash: evt.prev_hash,
			relay_hash: evt._relay_hash,
			project_name: evt.project?.name,
			raw_json: JSON.stringify(evt),
		}));

		// Insert events (idempotent)
		const { accepted, duplicates } = insertEvents(db, eventRows);

		// Insert seals if present
		if (envelope.seals) {
			for (const seal of envelope.seals) {
				insertSeal(db, machine.id, teamId, seal as any);
			}
		}

		// Update machine sync state
		updateMachineSync(db, machine.id, envelope.relay_chain_tip);

		return c.json({
			ok: true,
			accepted,
			duplicates,
			chain_tip: envelope.relay_chain_tip,
		});
	});

	return app;
}
