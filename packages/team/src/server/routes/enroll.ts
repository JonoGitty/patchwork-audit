/**
 * Machine enrollment endpoint.
 *
 * POST /api/v1/enroll — validates enrollment token, creates machine
 * record, returns API key.
 */

import { Hono } from "hono";
import type { TeamDb } from "../db/schema.js";
import { EnrollRequestSchema } from "../../protocol.js";
import { generateApiKey, hashApiKey } from "../../crypto.js";
import {
	getEnrollmentTokenByHash,
	markTokenUsed,
	insertMachine,
	getMachineByMachineId,
	getTeam,
} from "../db/queries.js";

export function enrollRoutes(db: TeamDb): Hono {
	const app = new Hono();

	app.post("/api/v1/enroll", async (c) => {
		let body: unknown;
		try {
			body = await c.req.json();
		} catch {
			return c.json({ ok: false, error: "Invalid JSON" }, 400);
		}

		const parsed = EnrollRequestSchema.safeParse(body);
		if (!parsed.success) {
			const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
			return c.json({ ok: false, error: `Validation failed: ${issues}` }, 400);
		}

		const { enrollment_token, machine_id, machine_name, developer_name, os } = parsed.data;

		// Validate enrollment token
		const tokenHash = hashApiKey(enrollment_token);
		const tokenRecord = getEnrollmentTokenByHash(db, tokenHash);

		if (!tokenRecord) {
			return c.json({ ok: false, error: "Invalid enrollment token" }, 401);
		}

		if (tokenRecord.used_at) {
			return c.json({ ok: false, error: "Enrollment token already used" }, 409);
		}

		if (new Date(tokenRecord.expires_at) < new Date()) {
			return c.json({ ok: false, error: "Enrollment token expired" }, 401);
		}

		const teamId = tokenRecord.team_id;

		// Check if machine already enrolled
		const existing = getMachineByMachineId(db, teamId, machine_id);
		if (existing) {
			return c.json({ ok: false, error: "Machine already enrolled in this team" }, 409);
		}

		// Generate API key
		const apiKey = generateApiKey();
		const apiKeyHash = hashApiKey(apiKey);

		// Create machine record
		const machineDbId = insertMachine(db, teamId, machine_id, machine_name, developer_name, apiKeyHash, os);

		// Mark token as used
		markTokenUsed(db, tokenRecord.id, machineDbId);

		// Get team name for response
		const team = getTeam(db, teamId);

		return c.json({
			ok: true,
			api_key: apiKey,
			machine_id: machineDbId,
			team_id: teamId,
			team_name: team?.name ?? "",
		});
	});

	return app;
}
