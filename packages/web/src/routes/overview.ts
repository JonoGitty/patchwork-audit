import { Hono } from "hono";
import type { Store } from "@patchwork/core";
import { layout } from "../templates/layout.js";
import { statCard, eventTable, sessionTable } from "../templates/components.js";
import { computeStats, groupSessions } from "../data/queries.js";
import { activityBarChart, riskDonutChart } from "../templates/charts.js";

export function overviewRoutes(store: Store) {
	const app = new Hono();

	app.get("/", (c) => {
		const events = store.readAll();
		const stats = computeStats(events);
		const sessions = groupSessions(events).slice(0, 5);
		const recent = events.slice(-5).reverse();

		const highestRisk = ["critical", "high", "medium", "low", "none"]
			.find(r => stats.byRisk[r]) || "none";
		const agents = Object.keys(stats.byAgent).join(", ") || "none";

		const content = `
		<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
			<h1 style="margin-bottom:0">Dashboard</h1>
			<div style="display:flex;gap:8px">
				<a href="/compliance" class="nav-item" style="background:var(--bg-card);border:1px solid var(--border)">&#9878; Compliance Report</a>
				<a href="/api/export/json" class="nav-item" style="background:var(--bg-card);border:1px solid var(--border)">&#8615; Export JSON</a>
				<a href="/api/export/csv" class="nav-item" style="background:var(--bg-card);border:1px solid var(--border)">&#8615; Export CSV</a>
			</div>
		</div>
		<div class="card-grid">
			${statCard("Total Events", stats.totalEvents)}
			${statCard("Sessions", stats.totalSessions)}
			${statCard("Agents", agents)}
			${statCard("Highest Risk", highestRisk, `var(--${highestRisk})`)}
		</div>

		<div class="row">
			<div class="card">
				<h3>Activity (last 14 days)</h3>
				${activityBarChart(stats.byDay)}
			</div>
			<div class="card">
				<h3>Risk Distribution</h3>
				${Object.keys(stats.byRisk).length > 0
					? riskDonutChart(stats.byRisk)
					: '<div class="empty">No events yet.</div>'
				}
			</div>
		</div>

		<div class="row">
			<div>
				<h2>Recent Events</h2>
				${eventTable(recent)}
			</div>
			<div>
				<h2>Recent Sessions</h2>
				${sessionTable(sessions)}
			</div>
		</div>`;

		return c.html(layout("Dashboard", "/", content));
	});

	return app;
}
