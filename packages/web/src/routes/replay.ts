import { Hono } from "hono";
import type { Store, AuditEvent } from "@patchwork/core";
import { layout } from "../templates/layout.js";
import { riskBadge, statCard } from "../templates/components.js";
import { formatTimeShort, formatDuration, computeStats } from "../data/queries.js";
import { computeFileDiff } from "./replay-helpers.js";

export function replayRoutes(store: Store) {
	const app = new Hono();

	app.get("/replay/:sessionId", (c) => {
		const sessionId = c.req.param("sessionId");
		let events = store.query({ sessionId });

		// Try partial match
		if (events.length === 0) {
			const all = store.readAll();
			events = all.filter(e => e.session_id.includes(sessionId));
		}

		if (events.length === 0) {
			return c.html(layout("Replay Not Found", "/sessions",
				`<div class="empty">Session <code>${esc(sessionId)}</code> not found.</div>`));
		}

		events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

		const first = events[0];
		const last = events[events.length - 1];
		const startTime = new Date(first.timestamp).getTime();
		const durationMs = new Date(last.timestamp).getTime() - startTime;
		const stats = computeStats(events);
		const changes = computeFileDiff(events);
		const denials = events.filter(e => e.status === "denied");

		const content = `
		<h1>Session Replay</h1>
		<p class="subtitle">
			<span class="mono">${esc(first.session_id)}</span> &middot;
			${esc(first.agent)} &middot;
			${esc(first.project?.name || "unknown")} &middot;
			${formatTimeShort(first.timestamp)} &middot;
			${formatDuration(durationMs)} &middot;
			${events.length} events
		</p>

		<div class="card-grid">
			${statCard("Events", events.length)}
			${statCard("Writes", changes.filter(c => c.changeType !== "DELETED").length)}
			${statCard("Commands", stats.byAction["command_execute"] || 0)}
			${statCard("Denied", denials.length, denials.length > 0 ? "var(--critical)" : undefined)}
		</div>

		<div class="card mb-24">
			<h3>Timeline</h3>
			<div class="timeline">
				${events.map(e => renderTimelineEvent(e, startTime)).join("")}
			</div>
		</div>

		${changes.length > 0 ? `
		<div class="card mb-24">
			<h3>File Changes</h3>
			<table>
				<thead><tr><th>Status</th><th>Path</th><th>Modifications</th></tr></thead>
				<tbody>
				${changes.map(ch => `<tr>
					<td><span style="color:${ch.changeType === "CREATED" ? "var(--green)" : ch.changeType === "DELETED" ? "var(--critical)" : "var(--medium)"}">${ch.changeType}</span></td>
					<td class="mono">${esc(ch.path)}</td>
					<td>${ch.events.length}</td>
				</tr>`).join("")}
				</tbody>
			</table>
		</div>` : ""}

		${denials.length > 0 ? `
		<div class="card mb-24">
			<h3>Policy Denials</h3>
			<table>
				<thead><tr><th>Time</th><th>Action</th><th>Target</th><th>Risk</th></tr></thead>
				<tbody>
				${denials.map(e => {
					const target = e.target?.path || e.target?.command?.slice(0, 60) || "—";
					return `<tr>
						<td>${formatTimeShort(e.timestamp)}</td>
						<td class="action">${e.action}</td>
						<td class="mono truncate">${esc(target)}</td>
						<td>${riskBadge(e.risk.level)}</td>
					</tr>`;
				}).join("")}
				</tbody>
			</table>
		</div>` : ""}

		<div style="text-align:center;margin-top:24px">
			<a href="/sessions/${encodeURIComponent(first.session_id)}" class="nav-item">&larr; Back to Session</a>
		</div>`;

		return c.html(layout(`Replay ${sessionId.slice(0, 12)}`, "/sessions", content));
	});

	return app;
}

function renderTimelineEvent(e: AuditEvent, startTime: number): string {
	const relMs = new Date(e.timestamp).getTime() - startTime;
	const relTime = relMs < 60000 ? `+${Math.floor(relMs / 1000)}s` : `+${Math.floor(relMs / 60000)}m${Math.floor((relMs % 60000) / 1000)}s`;
	const target = e.target?.path || e.target?.command?.slice(0, 80) || e.target?.url?.slice(0, 80) || e.target?.tool_name || "";
	const isDenied = e.status === "denied";
	const flags = (e.risk.flags || []).join(", ");

	let detail = "";
	if (e.content?.size_bytes) detail += `<span style="color:var(--text-dim)">${e.content.size_bytes} bytes</span> `;
	if (flags) detail += `<span style="color:var(--text-dim)">Flags: ${esc(flags)}</span>`;

	return `<div class="timeline-event risk-${e.risk.level}${isDenied ? " timeline-denied" : ""}">
		<div class="timeline-time">${esc(relTime)}</div>
		<div class="timeline-action">${e.action} ${riskBadge(e.risk.level)} ${isDenied ? '<span style="color:var(--critical);font-weight:700">DENIED</span>' : ""}</div>
		${target ? `<div class="timeline-target">${esc(target)}</div>` : ""}
		${detail ? `<div style="margin-top:4px">${detail}</div>` : ""}
	</div>`;
}

function esc(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
