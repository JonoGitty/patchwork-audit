import { Hono } from "hono";
import type { Store } from "@patchwork/core";
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

	return app;
}
