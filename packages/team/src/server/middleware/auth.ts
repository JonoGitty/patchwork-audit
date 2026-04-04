/**
 * Bearer token auth middleware for the team server.
 *
 * Extracts API key from Authorization header, hashes it,
 * looks up the machine, and sets it on the Hono context.
 */

import type { Context, Next } from "hono";
import { hashApiKey } from "../../crypto.js";
import { getMachineByApiKeyHash } from "../db/queries.js";
import type { TeamDb } from "../db/schema.js";

/**
 * Create a Bearer token auth middleware for machine-facing endpoints.
 */
export function machineAuth(db: TeamDb) {
	return async (c: Context, next: Next) => {
		const authHeader = c.req.header("Authorization");
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return c.json({ ok: false, error: "Missing or invalid Authorization header" }, 401);
		}

		const token = authHeader.slice(7);
		if (!token.startsWith("pw_")) {
			return c.json({ ok: false, error: "Invalid API key format" }, 401);
		}

		const keyHash = hashApiKey(token);
		const machine = getMachineByApiKeyHash(db, keyHash);

		if (!machine) {
			return c.json({ ok: false, error: "Unknown API key" }, 401);
		}

		if (machine.status !== "active") {
			return c.json({ ok: false, error: `Machine is ${machine.status}` }, 403);
		}

		c.set("machine", machine);
		c.set("teamId", machine.team_id);
		await next();
	};
}
