import type { AuditEvent, Store, SearchableStore } from "@patchwork/core";

export interface SessionSummary {
	id: string;
	agent: string;
	project: string;
	started: string;
	ended: string;
	durationMs: number;
	count: number;
	writes: number;
	commands: number;
	reads: number;
	webRequests: number;
	highRisk: number;
	denials: number;
	highestRisk: string;
}

export interface StatsResult {
	totalEvents: number;
	totalSessions: number;
	byAction: Record<string, number>;
	byAgent: Record<string, number>;
	byRisk: Record<string, number>;
	byDay: Record<string, number>;
	topFiles: Array<[string, number]>;
	topCommands: Array<[string, number]>;
}

export interface RiskTimelinePoint {
	date: string;
	critical: number;
	high: number;
	medium: number;
	low: number;
	none: number;
}

const RISK_ORDER = ["critical", "high", "medium", "low", "none"];

export function computeStats(events: AuditEvent[]): StatsResult {
	const byAction: Record<string, number> = {};
	const byAgent: Record<string, number> = {};
	const byRisk: Record<string, number> = {};
	const byDay: Record<string, number> = {};
	const fileCounts: Record<string, number> = {};
	const commandCounts: Record<string, number> = {};
	const sessionIds = new Set<string>();

	for (const e of events) {
		byAction[e.action] = (byAction[e.action] || 0) + 1;
		byAgent[e.agent] = (byAgent[e.agent] || 0) + 1;
		byRisk[e.risk.level] = (byRisk[e.risk.level] || 0) + 1;
		sessionIds.add(e.session_id);

		const day = e.timestamp.slice(0, 10);
		byDay[day] = (byDay[day] || 0) + 1;

		if (e.target?.path && ["file_write", "file_edit", "file_create"].includes(e.action)) {
			fileCounts[e.target.path] = (fileCounts[e.target.path] || 0) + 1;
		}
		if (e.target?.command && e.action === "command_execute") {
			const cmd = e.target.command.slice(0, 80);
			commandCounts[cmd] = (commandCounts[cmd] || 0) + 1;
		}
	}

	return {
		totalEvents: events.length,
		totalSessions: sessionIds.size,
		byAction,
		byAgent,
		byRisk,
		byDay,
		topFiles: Object.entries(fileCounts).sort((a, b) => b[1] - a[1]).slice(0, 10),
		topCommands: Object.entries(commandCounts).sort((a, b) => b[1] - a[1]).slice(0, 10),
	};
}

export function groupSessions(events: AuditEvent[]): SessionSummary[] {
	const map = new Map<string, AuditEvent[]>();
	for (const e of events) {
		const list = map.get(e.session_id) || [];
		list.push(e);
		map.set(e.session_id, list);
	}

	return Array.from(map.entries())
		.map(([id, evts]) => {
			const started = evts[0]?.timestamp || "";
			const ended = evts[evts.length - 1]?.timestamp || "";
			const durationMs = started && ended
				? new Date(ended).getTime() - new Date(started).getTime()
				: 0;
			const risks = evts.map(e => e.risk.level);
			const highestRisk = RISK_ORDER.find(r => risks.includes(r)) || "none";

			return {
				id,
				agent: evts[0]?.agent || "unknown",
				project: evts[0]?.project?.name || "unknown",
				started,
				ended,
				durationMs,
				count: evts.length,
				writes: evts.filter(e => ["file_write", "file_edit", "file_create"].includes(e.action)).length,
				commands: evts.filter(e => e.action === "command_execute").length,
				reads: evts.filter(e => e.action === "file_read").length,
				webRequests: evts.filter(e => ["web_fetch", "web_search"].includes(e.action)).length,
				highRisk: evts.filter(e => e.risk.level === "high" || e.risk.level === "critical").length,
				denials: evts.filter(e => e.status === "denied").length,
				highestRisk,
			};
		})
		.sort((a, b) => (b.started || "").localeCompare(a.started || ""));
}

export function riskTimeline(events: AuditEvent[], days: number): RiskTimelinePoint[] {
	const now = new Date();
	const cutoff = new Date(now.getTime() - days * 86400000);
	const filtered = events.filter(e => new Date(e.timestamp) >= cutoff);

	const byDay = new Map<string, RiskTimelinePoint>();
	for (let d = 0; d < days; d++) {
		const date = new Date(now.getTime() - (days - 1 - d) * 86400000).toISOString().slice(0, 10);
		byDay.set(date, { date, critical: 0, high: 0, medium: 0, low: 0, none: 0 });
	}

	for (const e of filtered) {
		const day = e.timestamp.slice(0, 10);
		const point = byDay.get(day);
		if (point && e.risk.level in point) {
			(point as any)[e.risk.level]++;
		}
	}

	return Array.from(byDay.values());
}

export function riskFlagCounts(events: AuditEvent[]): Array<[string, number]> {
	const counts: Record<string, number> = {};
	for (const e of events) {
		for (const flag of e.risk.flags || []) {
			counts[flag] = (counts[flag] || 0) + 1;
		}
	}
	return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
}

export function formatDuration(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const secs = seconds % 60;
	if (minutes < 60) return `${minutes}m ${secs}s`;
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return `${hours}h ${mins}m`;
}

export function formatTime(iso: string): string {
	if (!iso) return "—";
	const d = new Date(iso);
	return d.toLocaleString("en-GB", {
		day: "2-digit", month: "short", year: "numeric",
		hour: "2-digit", minute: "2-digit", second: "2-digit",
	});
}

export function formatTimeShort(iso: string): string {
	if (!iso) return "—";
	const d = new Date(iso);
	return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
