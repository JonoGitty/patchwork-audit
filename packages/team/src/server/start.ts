/**
 * Team server entry point.
 *
 * Opens SQLite, creates the Hono app, starts serving.
 */

import { serve } from "@hono/node-server";
import { TeamDb } from "./db/schema.js";
import { createTeamApp } from "./app.js";
import { DEFAULT_TEAM_SERVER_PORT } from "../constants.js";

export interface TeamServerOptions {
	port?: number;
	dbPath?: string;
	host?: string;
}

export function startTeamServer(options: TeamServerOptions = {}) {
	const port = options.port ?? DEFAULT_TEAM_SERVER_PORT;
	const dbPath = options.dbPath ?? "/Library/Patchwork/team/team.db";
	const host = options.host ?? "0.0.0.0";

	const db = new TeamDb(dbPath);
	const app = createTeamApp(db);

	console.log(`
  ┌─────────────────────────────────────┐
  │                                     │
  │   Patchwork Team Server             │
  │   http://${host}:${port}              │
  │                                     │
  │   Database: ${dbPath.length > 22 ? "..." + dbPath.slice(-22) : dbPath}
  │   Press Ctrl+C to stop              │
  │                                     │
  └─────────────────────────────────────┘
`);

	const shutdown = () => {
		db.close();
		process.exit(0);
	};
	process.on("SIGTERM", shutdown);
	process.on("SIGINT", shutdown);

	serve({ fetch: app.fetch, port, hostname: host });

	return { db, app };
}
