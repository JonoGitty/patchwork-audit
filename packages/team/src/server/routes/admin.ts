/**
 * Admin bootstrap endpoint.
 *
 * POST /api/v1/admin/bootstrap — creates the first team, admin user,
 * and enrollment token. Only works when no teams exist yet.
 */

import { Hono } from "hono";
import { createHash, randomBytes } from "node:crypto";
import type { TeamDb } from "../db/schema.js";
import { BootstrapRequestSchema } from "../../protocol.js";
import { ENROLL_TOKEN_PREFIX } from "../../constants.js";
import {
	insertTeam,
	getTeamCount,
	insertTeamMember,
	insertEnrollmentToken,
} from "../db/queries.js";
import { hashApiKey } from "../../crypto.js";

export function adminRoutes(db: TeamDb): Hono {
	const app = new Hono();

	app.post("/api/v1/admin/bootstrap", async (c) => {
		// Only allow bootstrap when no teams exist
		if (getTeamCount(db) > 0) {
			return c.json({ ok: false, error: "Server already bootstrapped" }, 409);
		}

		let body: unknown;
		try {
			body = await c.req.json();
		} catch {
			return c.json({ ok: false, error: "Invalid JSON" }, 400);
		}

		const parsed = BootstrapRequestSchema.safeParse(body);
		if (!parsed.success) {
			const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
			return c.json({ ok: false, error: `Validation failed: ${issues}` }, 400);
		}

		const { team_name, admin_email, admin_password } = parsed.data;

		// Create team
		const teamId = insertTeam(db, team_name);

		// Create admin user (simple hash for alpha — use bcrypt in production)
		const passwordHash = createHash("sha256").update(admin_password).digest("hex");
		insertTeamMember(db, teamId, admin_email, admin_email.split("@")[0], "admin", passwordHash);

		// Generate enrollment token (valid for 7 days)
		const token = `${ENROLL_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
		const tokenHash = hashApiKey(token);
		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
		insertEnrollmentToken(db, teamId, tokenHash, expiresAt);

		return c.json({
			ok: true,
			team_id: teamId,
			enrollment_token: token,
		});
	});

	return app;
}
