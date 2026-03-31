import { Hono } from "hono";
import type { Store } from "@patchwork/core";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { computeStats, groupSessions, riskTimeline, riskFlagCounts } from "../data/queries.js";

export function apiRoutes(store: Store) {
	const app = new Hono();

	app.get("/api/stats", (c) => {
		const events = store.readAll();
		const stats = computeStats(events);
		return c.json(stats);
	});

	app.get("/api/sessions", (c) => {
		const events = store.readAll();
		const sessions = groupSessions(events);
		return c.json(sessions);
	});

	app.get("/api/events", (c) => {
		const agent = c.req.query("agent") || undefined;
		const action = c.req.query("action") || undefined;
		const risk = c.req.query("risk") || undefined;
		const limit = parseInt(c.req.query("limit") || "100", 10);

		const filter: Record<string, any> = { limit };
		if (agent) filter.agent = agent;
		if (action) filter.action = action;
		if (risk) filter.minRisk = risk;

		const events = store.query(filter);
		return c.json(events);
	});

	app.get("/api/risk-timeline", (c) => {
		const days = parseInt(c.req.query("days") || "30", 10);
		const events = store.readAll();
		return c.json(riskTimeline(events, days));
	});

	app.get("/api/risk-flags", (c) => {
		const events = store.readAll();
		return c.json(riskFlagCounts(events));
	});

	app.get("/api/export/json", (c) => {
		const events = store.readAll();
		c.header("Content-Disposition", "attachment; filename=patchwork-events.json");
		return c.json(events);
	});

	app.get("/api/export/csv", (c) => {
		const events = store.readAll();
		const headers = "id,timestamp,session_id,agent,action,status,risk_level,risk_flags,target_path,target_command,project_name";
		const rows = events.map(e => [
			e.id, e.timestamp, e.session_id, e.agent, e.action, e.status,
			e.risk.level, (e.risk.flags || []).join(";"),
			e.target?.path || "", e.target?.command || "",
			e.project?.name || "",
		].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
		c.header("Content-Type", "text/csv");
		c.header("Content-Disposition", "attachment; filename=patchwork-events.csv");
		return c.text([headers, ...rows].join("\n"));
	});

	app.get("/api/health", (c) => {
		const home = process.env.HOME || "";
		const guardStatusPath = join(home, ".patchwork", "state", "guard-status.json");
		const settingsPath = join(home, ".claude", "settings.json");

		let guardOk = false;
		let guardAge = -1;
		let hooksPresent = false;
		let failClosed = false;
		let nodeExplicit = false;

		// Check guard status
		try {
			if (existsSync(guardStatusPath)) {
				const guard = JSON.parse(readFileSync(guardStatusPath, "utf-8"));
				guardAge = Math.floor((Date.now() - new Date(guard.ts).getTime()) / 60000);
				guardOk = guard.status === "ok" && guardAge < 60;
			}
		} catch { /* ignore */ }

		// Check hooks
		try {
			if (existsSync(settingsPath)) {
				const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
				const hooks = settings.hooks || {};
				hooksPresent = !!(hooks.PreToolUse?.length && hooks.PostToolUse?.length);
				const cmd = hooks.PreToolUse?.[0]?.command || "";
				failClosed = cmd.includes("PATCHWORK_PRETOOL_FAIL_CLOSED=1");
				nodeExplicit = cmd.includes("/node ");
			}
		} catch { /* ignore */ }

		const healthy = hooksPresent && (guardOk || guardAge === -1);

		return c.json({
			healthy,
			guard: { ok: guardOk, ageMinutes: guardAge },
			hooks: { present: hooksPresent, failClosed, nodeExplicit },
		});
	});

	return app;
}
