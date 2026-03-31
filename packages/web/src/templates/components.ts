import type { AuditEvent } from "@patchwork/core";
import type { SessionSummary } from "../data/queries.js";
import { formatTime, formatTimeShort, formatDuration } from "../data/queries.js";

export function riskBadge(level: string): string {
	return `<span class="risk risk-${level}">${level}</span>`;
}

export function agentBadge(agent: string): string {
	return `<span class="agent">${agent}</span>`;
}

export function statusBadge(status: string): string {
	return `<span class="status-${status}">${status}</span>`;
}

export function statCard(label: string, value: string | number, color?: string): string {
	const style = color ? ` style="color:${color}"` : "";
	return `<div class="stat-card">
		<div class="value"${style}>${value}</div>
		<div class="label">${label}</div>
	</div>`;
}

export function eventRow(event: AuditEvent): string {
	const target = event.target?.path
		|| event.target?.command?.slice(0, 60)
		|| event.target?.url?.slice(0, 60)
		|| event.target?.tool_name
		|| "—";
	return `<tr class="clickable" onclick="this.nextElementSibling.classList.toggle('open')">
		<td>${formatTimeShort(event.timestamp)}</td>
		<td>${agentBadge(event.agent)}</td>
		<td><span class="action">${event.action}</span></td>
		<td><span class="truncate" title="${escapeHtml(target)}">${escapeHtml(target)}</span></td>
		<td>${riskBadge(event.risk.level)}</td>
		<td>${statusBadge(event.status)}</td>
	</tr>
	<tr class="detail-row"><td colspan="6"><div class="detail-content">${escapeHtml(JSON.stringify(event, null, 2))}</div></td></tr>`;
}

export function eventTable(events: AuditEvent[]): string {
	if (events.length === 0) {
		return `<div class="empty">No events found.</div>`;
	}
	const rows = events.map(eventRow).join("\n");
	return `<table>
		<thead><tr>
			<th>Time</th><th>Agent</th><th>Action</th><th>Target</th><th>Risk</th><th>Status</th>
		</tr></thead>
		<tbody>${rows}</tbody>
	</table>`;
}

export function sessionRow(s: SessionSummary): string {
	const riskBadgeHtml = s.highRisk > 0
		? ` ${riskBadge(s.highestRisk)} <span style="color:var(--text-dim)">${s.highRisk}</span>`
		: `<span style="color:var(--text-muted)">clean</span>`;
	return `<tr class="clickable" onclick="window.location='/sessions/${encodeURIComponent(s.id)}'">
		<td class="mono" style="font-size:13px">${escapeHtml(s.id.slice(0, 20))}</td>
		<td>${agentBadge(s.agent)}</td>
		<td>${escapeHtml(s.project)}</td>
		<td>${formatTime(s.started)}</td>
		<td>${formatDuration(s.durationMs)}</td>
		<td>${s.count}</td>
		<td>${s.writes}</td>
		<td>${s.commands}</td>
		<td>${riskBadgeHtml}</td>
	</tr>`;
}

export function sessionTable(sessions: SessionSummary[]): string {
	if (sessions.length === 0) {
		return `<div class="empty">No sessions found.</div>`;
	}
	const rows = sessions.map(sessionRow).join("\n");
	return `<table>
		<thead><tr>
			<th>Session</th><th>Agent</th><th>Project</th><th>Started</th><th>Duration</th><th>Events</th><th>Writes</th><th>Cmds</th><th>Risk</th>
		</tr></thead>
		<tbody>${rows}</tbody>
	</table>`;
}

export function timelineEvent(event: AuditEvent): string {
	const target = event.target?.path
		|| event.target?.command?.slice(0, 80)
		|| event.target?.url?.slice(0, 80)
		|| event.target?.tool_name
		|| "";
	return `<div class="timeline-event risk-${event.risk.level}">
		<div class="timeline-time">${formatTimeShort(event.timestamp)}</div>
		<div class="timeline-action">${event.action} ${riskBadge(event.risk.level)} ${statusBadge(event.status)}</div>
		${target ? `<div class="timeline-target">${escapeHtml(target)}</div>` : ""}
	</div>`;
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
