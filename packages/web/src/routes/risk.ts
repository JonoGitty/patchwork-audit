import { Hono } from "hono";
import type { Store, AuditEvent } from "@patchwork/core";
import { loadActivePolicy, evaluatePolicy } from "@patchwork/core";
import { layout } from "../templates/layout.js";
import { riskBadge, statCard } from "../templates/components.js";
import { computeStats, riskTimeline, riskFlagCounts, formatTimeShort } from "../data/queries.js";
import { riskTimelineChart, horizontalBarChart } from "../templates/charts.js";

export function riskRoutes(store: Store) {
	const app = new Hono();

	app.get("/risk", (c) => {
		const events = store.readAll();
		const stats = computeStats(events);
		const timeline = riskTimeline(events, 30);
		const flags = riskFlagCounts(events);

		const deniedEvents = events.filter(e => e.status === "denied").reverse().slice(0, 20);
		const highRiskEvents = events
			.filter(e => e.risk.level === "critical" || e.risk.level === "high")
			.reverse().slice(0, 20);

		const criticalCount = stats.byRisk["critical"] || 0;
		const highCount = stats.byRisk["high"] || 0;
		const mediumCount = stats.byRisk["medium"] || 0;
		const totalHighRisk = criticalCount + highCount;

		const content = `
		<h1>Risk Dashboard</h1>

		<div class="card-grid">
			${statCard("Critical", criticalCount, criticalCount > 0 ? "var(--critical)" : undefined)}
			${statCard("High", highCount, highCount > 0 ? "var(--high)" : undefined)}
			${statCard("Medium", mediumCount, mediumCount > 0 ? "var(--medium)" : undefined)}
			${statCard("Denied", deniedEvents.length, deniedEvents.length > 0 ? "var(--critical)" : undefined)}
		</div>

		<div class="row">
			<div class="card">
				<h3>Risk Over Time (30 days)</h3>
				${riskTimelineChart(timeline)}
			</div>
			<div class="card">
				<h3>Top Risk Flags</h3>
				${horizontalBarChart(flags, "riskFlags", "#d29922")}
			</div>
		</div>

		${deniedEvents.length > 0 ? `
		<h2>Policy Denials</h2>
		<div class="card mb-24">
			<table>
				<thead><tr><th>Time</th><th>Action</th><th>Target</th><th>Risk</th></tr></thead>
				<tbody>
					${deniedEvents.map(e => {
						const target = e.target?.path || e.target?.command?.slice(0, 60) || e.target?.url || "—";
						return `<tr>
							<td>${formatTimeShort(e.timestamp)}</td>
							<td class="action">${e.action}</td>
							<td class="mono truncate">${escapeHtml(target)}</td>
							<td>${riskBadge(e.risk.level)}</td>
						</tr>`;
					}).join("")}
				</tbody>
			</table>
		</div>` : ""}

		${highRiskEvents.length > 0 ? `
		<h2>High-Risk Events</h2>
		<div class="card">
			<table>
				<thead><tr><th>Time</th><th>Agent</th><th>Action</th><th>Target</th><th>Risk</th><th>Flags</th></tr></thead>
				<tbody>
					${highRiskEvents.map(e => {
						const target = e.target?.path || e.target?.command?.slice(0, 60) || "—";
						const flagsStr = (e.risk.flags || []).join(", ");
						return `<tr>
							<td>${formatTimeShort(e.timestamp)}</td>
							<td><span class="agent">${e.agent}</span></td>
							<td class="action">${e.action}</td>
							<td class="mono truncate">${escapeHtml(target)}</td>
							<td>${riskBadge(e.risk.level)}</td>
							<td style="color:var(--text-dim);font-size:12px">${escapeHtml(flagsStr)}</td>
						</tr>`;
					}).join("")}
				</tbody>
			</table>
		</div>` : ""}`;

		return c.html(layout("Risk Dashboard", "/risk", content));
	});

	return app;
}

function escapeHtml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
