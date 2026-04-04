import { Hono } from "hono";
import type { TeamDb } from "../db/schema.js";
import { getMachinesByTeam } from "../db/queries.js";
import { machineAuth } from "../middleware/auth.js";

export function machineRoutes(db: TeamDb): Hono {
	const app = new Hono();

	app.get("/api/v1/machines", machineAuth(db), (c) => {
		const teamId = c.get("teamId") as string;
		const machines = getMachinesByTeam(db, teamId);
		return c.json({
			ok: true,
			machines: machines.map((m: any) => ({
				id: m.id,
				machine_id: m.machine_id,
				machine_name: m.machine_name,
				developer_name: m.developer_name,
				status: m.status,
				os: m.os,
				enrolled_at: m.enrolled_at,
				last_seen_at: m.last_seen_at,
				last_sync_at: m.last_sync_at,
				last_chain_tip: m.last_chain_tip,
			})),
		});
	});

	return app;
}
