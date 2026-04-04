/**
 * Team server Hono application factory.
 *
 * Follows the createApp pattern from @patchwork/web.
 */

import { Hono } from "hono";
import type { TeamDb } from "./db/schema.js";
import { healthRoutes } from "./routes/health.js";
import { ingestRoutes } from "./routes/ingest.js";
import { machineRoutes } from "./routes/machines.js";
import { adminRoutes } from "./routes/admin.js";
import { enrollRoutes } from "./routes/enroll.js";

export function createTeamApp(db: TeamDb): Hono {
	const app = new Hono();

	app.route("/", healthRoutes());
	app.route("/", adminRoutes(db));
	app.route("/", enrollRoutes(db));
	app.route("/", ingestRoutes(db));
	app.route("/", machineRoutes(db));

	return app;
}
