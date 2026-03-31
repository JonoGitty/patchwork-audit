import { Hono } from "hono";
import type { Store } from "@patchwork/core";
import { layout } from "../templates/layout.js";
import { sessionTable, timelineEvent, riskBadge, statCard } from "../templates/components.js";
import { groupSessions, formatTime, formatDuration, computeStats } from "../data/queries.js";

export function sessionRoutes(store: Store) {
	const app = new Hono();

	app.get("/sessions", (c) => {
		const events = store.readAll();
		const sessions = groupSessions(events);

		const content = `
		<h1>Sessions</h1>
		<p class="subtitle">${sessions.length} sessions</p>
		<div class="card">
			${sessionTable(sessions)}
		</div>`;

		return c.html(layout("Sessions", "/sessions", content));
	});

	app.get("/sessions/:id", (c) => {
		const id = c.req.param("id");
		const events = store.query({ sessionId: id });

		if (events.length === 0) {
			return c.html(layout("Session Not Found", "/sessions",
				`<div class="empty">Session <code>${id}</code> not found.</div>`));
		}

		const sessions = groupSessions(events);
		const session = sessions[0];
		const stats = computeStats(events);

		const content = `
		<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
			<h1 style="margin-bottom:0">Session: <span class="mono" style="font-size:18px">${escapeHtml(id.slice(0, 24))}</span></h1>
			<a href="/replay/${encodeURIComponent(id)}" class="nav-item" style="background:var(--bg-card);border:1px solid var(--border)">&#9654; View Replay</a>
		</div>
		<p class="subtitle">${session.agent} &middot; ${escapeHtml(session.project)} &middot; ${formatTime(session.started)} &middot; ${formatDuration(session.durationMs)}</p>

		<div class="card-grid">
			${statCard("Events", session.count)}
			${statCard("File Reads", session.reads)}
			${statCard("File Writes", session.writes)}
			${statCard("Commands", session.commands)}
			${statCard("Web Requests", session.webRequests)}
			${statCard("High Risk", session.highRisk, session.highRisk > 0 ? "var(--critical)" : undefined)}
			${statCard("Denials", session.denials, session.denials > 0 ? "var(--critical)" : undefined)}
		</div>

		<div class="row">
			<div>
				<h2>Timeline</h2>
				<div class="timeline">
					${events.map(e => timelineEvent(e)).join("")}
				</div>
			</div>
			<div>
				<h2>Actions Breakdown</h2>
				<div class="card">
					<table>
						<thead><tr><th>Action</th><th>Count</th></tr></thead>
						<tbody>
							${Object.entries(stats.byAction)
								.sort((a, b) => b[1] - a[1])
								.map(([action, count]) => `<tr><td class="action">${action}</td><td>${count}</td></tr>`)
								.join("")}
						</tbody>
					</table>
				</div>
				${stats.topFiles.length > 0 ? `
				<h2 class="mb-16" style="margin-top:24px">Files Modified</h2>
				<div class="card">
					<table>
						<thead><tr><th>Path</th><th>Count</th></tr></thead>
						<tbody>
							${stats.topFiles.map(([p, c]) => `<tr><td class="mono truncate">${escapeHtml(p)}</td><td>${c}</td></tr>`).join("")}
						</tbody>
					</table>
				</div>` : ""}
			</div>
		</div>`;

		return c.html(layout(`Session ${id.slice(0, 12)}`, "/sessions", content));
	});

	return app;
}

function escapeHtml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
