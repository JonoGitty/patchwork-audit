import { Hono } from "hono";
import type { Store } from "@patchwork/core";
import { loadActivePolicy, SYSTEM_POLICY_PATH } from "@patchwork/core";
import { detectInstalledAgents } from "@patchwork/agents";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { layout } from "../templates/layout.js";
import { riskBadge } from "../templates/components.js";

export function settingsRoutes(store: Store, dataDir: string) {
	const app = new Hono();

	app.get("/settings", (c) => {
		const events = store.readAll();
		const sessionIds = new Set(events.map(e => e.session_id));
		const lastEvent = events.length > 0 ? events[events.length - 1] : null;

		// File sizes
		const eventsPath = join(dataDir, "events.jsonl");
		const dbPath = join(dataDir, "db", "audit.db");
		const eventsSize = existsSync(eventsPath) ? formatBytes(statSync(eventsPath).size) : "—";
		const dbSize = existsSync(dbPath) ? formatBytes(statSync(dbPath).size) : "—";

		// Policy
		const { policy, source } = loadActivePolicy();
		const isSystemPolicy = source.startsWith("system:");

		// Agents
		let agents: Array<{ name: string; installed: boolean; version?: string }> = [];
		try {
			agents = detectInstalledAgents();
		} catch {
			agents = [
				{ name: "claude-code", installed: false },
				{ name: "codex", installed: false },
				{ name: "cursor", installed: false },
			];
		}

		const content = `
		<h1>Settings & Status</h1>

		<div class="settings-section card mb-24">
			<h2>System</h2>
			${settingsRow("Data Directory", dataDir)}
			${settingsRow("JSONL Size", eventsSize)}
			${settingsRow("SQLite Size", dbSize)}
			${settingsRow("Total Events", String(events.length))}
			${settingsRow("Total Sessions", String(sessionIds.size))}
			${settingsRow("Last Event", lastEvent ? new Date(lastEvent.timestamp).toLocaleString() : "—")}
		</div>

		<div class="settings-section card mb-24">
			<h2>Installed Agents</h2>
			<table>
				<thead><tr><th>Agent</th><th>Status</th><th>Version</th></tr></thead>
				<tbody>
					${agents.map(a => `<tr>
						<td>${a.name}</td>
						<td>${a.installed
							? '<span style="color:var(--green)">installed</span>'
							: '<span style="color:var(--text-muted)">not found</span>'}</td>
						<td class="mono">${a.version || "—"}</td>
					</tr>`).join("")}
				</tbody>
			</table>
		</div>

		<div class="settings-section card mb-24">
			<h2>Active Policy</h2>
			${settingsRow("Policy Name", policy.name)}
			${settingsRow("Source", source)}
			${settingsRow("System Policy", isSystemPolicy ? '<span style="color:var(--green)">active</span>' : '<span style="color:var(--text-muted)">not installed</span>')}
			${settingsRow("Max Risk", riskBadge(policy.max_risk))}
			${settingsRow("File Deny Rules", String(policy.files.deny.length))}
			${settingsRow("File Allow Rules", String(policy.files.allow.length))}
			${settingsRow("Command Deny Rules", String(policy.commands.deny.length))}
			${settingsRow("Command Allow Rules", String(policy.commands.allow.length))}
			${settingsRow("Network Deny Rules", String(policy.network.deny.length))}
			${settingsRow("MCP Deny Rules", String(policy.mcp.deny.length))}

			${policy.files.deny.length > 0 ? `
			<h3 style="margin-top:16px">File Deny Rules</h3>
			<table>
				<thead><tr><th>Pattern</th><th>Reason</th></tr></thead>
				<tbody>
					${policy.files.deny.map(r => `<tr>
						<td class="mono" style="color:var(--critical)">${escapeHtml(r.pattern)}</td>
						<td style="color:var(--text-dim)">${escapeHtml(r.reason || "")}</td>
					</tr>`).join("")}
				</tbody>
			</table>` : ""}

			${policy.commands.deny.length > 0 ? `
			<h3 style="margin-top:16px">Command Deny Rules</h3>
			<table>
				<thead><tr><th>Rule</th><th>Reason</th></tr></thead>
				<tbody>
					${policy.commands.deny.map(r => {
						const rule = r.prefix || r.exact || r.regex || "—";
						return `<tr>
							<td class="mono" style="color:var(--critical)">${escapeHtml(rule)}</td>
							<td style="color:var(--text-dim)">${escapeHtml(r.reason || "")}</td>
						</tr>`;
					}).join("")}
				</tbody>
			</table>` : ""}
		</div>

		<div class="settings-section card mb-24">
			<h2>System Policy Path</h2>
			${settingsRow("Expected at", SYSTEM_POLICY_PATH)}
			${settingsRow("Exists", existsSync(SYSTEM_POLICY_PATH)
				? '<span style="color:var(--green)">yes</span>'
				: '<span style="color:var(--text-muted)">no</span>')}
		</div>`;

		return c.html(layout("Settings", "/settings", content));
	});

	return app;
}

function settingsRow(label: string, value: string): string {
	return `<div class="settings-row">
		<span class="settings-label">${label}</span>
		<span class="settings-value">${value}</span>
	</div>`;
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
