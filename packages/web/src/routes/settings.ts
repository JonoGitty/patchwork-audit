import { Hono } from "hono";
import type { Store } from "@patchwork/core";
import {
	loadActivePolicy,
	SYSTEM_POLICY_PATH,
	RELAY_SOCKET_PATH,
	RELAY_PROTOCOL_VERSION,
	RELAY_SEALS_PATH,
	pingRelay,
} from "@patchwork/core";
import { detectInstalledAgents } from "@patchwork/agents";
import { existsSync, readFileSync, statSync } from "node:fs";
import { connect } from "node:net";
import { join } from "node:path";
import { layout } from "../templates/layout.js";
import { riskBadge } from "../templates/components.js";

/** Query relay daemon via socket. */
function queryRelay<T>(type: string): Promise<T | null> {
	return new Promise((resolve) => {
		if (!existsSync(RELAY_SOCKET_PATH)) { resolve(null); return; }
		const timer = setTimeout(() => resolve(null), 2_000);
		const socket = connect(RELAY_SOCKET_PATH, () => {
			socket.write(JSON.stringify({
				protocol_version: RELAY_PROTOCOL_VERSION,
				type,
				timestamp: new Date().toISOString(),
			}) + "\n");
		});
		socket.on("data", (chunk) => {
			clearTimeout(timer);
			try { resolve(JSON.parse(chunk.toString().trim())); }
			catch { resolve(null); }
			socket.destroy();
		});
		socket.on("error", () => { clearTimeout(timer); resolve(null); });
	});
}

export function settingsRoutes(store: Store, dataDir: string) {
	const app = new Hono();

	app.get("/settings", async (c) => {
		const home = process.env.HOME || "";
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

		// Hooks
		let hookSummary = "Not configured";
		let hookFormat = "";
		const settingsPath = join(home, ".claude", "settings.json");
		if (existsSync(settingsPath)) {
			try {
				const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
				const hooks = settings.hooks || {};
				const count = Object.keys(hooks).length;
				hookSummary = `${count} event types configured`;

				// Check format
				let allNested = true;
				for (const entries of Object.values(hooks) as any[][]) {
					for (const e of entries) {
						if (typeof e.command === "string" && !e.hooks) {
							allNested = false;
							break;
						}
					}
				}
				hookFormat = allNested ? "Correct (nested matcher)" : "WRONG (flat — hooks won't fire)";
			} catch {
				hookSummary = "settings.json unreadable";
			}
		}

		// Relay status via socket
		const chainState = await queryRelay<any>("get_chain_state");
		const sealStatus = await queryRelay<any>("seal_status");
		const relayOnline = !!chainState?.ok;

		// Commit attestations
		const attestIndexPath = join(dataDir, "commit-attestations", "index.jsonl");
		let attestCount = 0;
		if (existsSync(attestIndexPath)) {
			try {
				const content = readFileSync(attestIndexPath, "utf-8").trim();
				attestCount = content ? content.split("\n").length : 0;
			} catch { /* */ }
		}

		// Team mode
		let teamInfo = "Not enrolled";
		const teamConfigPath = join("/Library/Patchwork/team", "config.json");
		if (existsSync(teamConfigPath)) {
			try {
				const config = JSON.parse(readFileSync(teamConfigPath, "utf-8"));
				teamInfo = `Enrolled in "${config.team_name}" (${config.server_url})`;
			} catch { /* */ }
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
			<h2>Hooks</h2>
			${settingsRow("Status", hookSummary)}
			${hookFormat ? settingsRow("Format", hookFormat.includes("WRONG")
				? `<span style="color:var(--critical)">${escapeHtml(hookFormat)}</span>`
				: `<span style="color:var(--green)">${escapeHtml(hookFormat)}</span>`) : ""}
		</div>

		<div class="settings-section card mb-24">
			<h2>Relay Daemon (Layer 2)</h2>
			${settingsRow("Status", relayOnline
				? '<span style="color:var(--green)">Running</span>'
				: '<span style="color:var(--text-muted)">Not running</span>')}
			${chainState?.ok ? settingsRow("Events", String(chainState.event_count)) : ""}
			${chainState?.ok ? settingsRow("Chain tip", `<code style="font-size:11px">${(chainState.chain_tip || "—").slice(0, 30)}...</code>`) : ""}
			${sealStatus?.ok ? settingsRow("Seals", `${sealStatus.seals_total} (auto-seal ${sealStatus.auto_seal_enabled ? "on" : "off"})`) : ""}
			${chainState?.ok ? settingsRow("Uptime", `${Math.floor(chainState.uptime_ms / 3_600_000)}h ${Math.floor((chainState.uptime_ms % 3_600_000) / 60_000)}m`) : ""}
		</div>

		<div class="settings-section card mb-24">
			<h2>Commit Attestations</h2>
			${settingsRow("Attestations", String(attestCount))}
		</div>

		<div class="settings-section card mb-24">
			<h2>Team Mode</h2>
			${settingsRow("Status", teamInfo)}
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
			${settingsRow("Command Deny Rules", String(policy.commands.deny.length))}

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
