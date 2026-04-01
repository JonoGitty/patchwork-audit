import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { SqliteStore, JsonlStore, type Store, type SearchableStore, getHomeDir } from "@patchwork/core";
import { overviewRoutes } from "./routes/overview.js";
import { eventRoutes } from "./routes/events.js";
import { sessionRoutes } from "./routes/sessions.js";
import { riskRoutes } from "./routes/risk.js";
import { searchRoutes } from "./routes/search.js";
import { settingsRoutes } from "./routes/settings.js";
import { apiRoutes } from "./routes/api.js";
import { replayRoutes } from "./routes/replay.js";
import { complianceRoutes } from "./routes/compliance.js";
import { doctorRoutes } from "./routes/doctor.js";

export interface DashboardOptions {
	port?: number;
	open?: boolean;
}

export function createApp(store: Store, searchStore: SearchableStore | null, dataDir: string): Hono {
	const app = new Hono();

	app.onError((err, c) => {
		console.error(`[patchwork-web] ${c.req.method} ${c.req.path} error:`, err.message);
		return c.json({ error: "Internal server error" }, 500);
	});

	app.route("/", overviewRoutes(store));
	app.route("/", eventRoutes(store));
	app.route("/", sessionRoutes(store));
	app.route("/", riskRoutes(store));
	app.route("/", searchRoutes(store, searchStore));
	app.route("/", settingsRoutes(store, dataDir));
	app.route("/", apiRoutes(store));
	app.route("/", replayRoutes(store));
	app.route("/", complianceRoutes(store));
	app.route("/", doctorRoutes(store, dataDir));

	return app;
}

export function startDashboard(options: DashboardOptions = {}) {
	const port = options.port || 3000;
	const dataDir = join(getHomeDir(), ".patchwork");
	const dbPath = join(dataDir, "db", "audit.db");
	const eventsPath = join(dataDir, "events.jsonl");

	let store: Store;
	let searchStore: SearchableStore | null = null;

	if (existsSync(dbPath)) {
		try {
			const sqliteStore = new SqliteStore(dbPath);
			store = sqliteStore;
			searchStore = sqliteStore;
		} catch {
			store = new JsonlStore(eventsPath);
		}
	} else {
		store = new JsonlStore(eventsPath);
	}

	const app = createApp(store, searchStore, dataDir);

	console.log(`
  ┌─────────────────────────────────────┐
  │                                     │
  │   Patchwork Dashboard               │
  │   http://localhost:${port}             │
  │                                     │
  │   Press Ctrl+C to stop              │
  │                                     │
  └─────────────────────────────────────┘
`);

	serve({ fetch: app.fetch, port });

	if (options.open !== false) {
		import("node:child_process").then(({ exec }) => {
			exec(`open http://localhost:${port}`);
		});
	}
}
