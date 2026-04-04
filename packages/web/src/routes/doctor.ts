import { Hono } from "hono";
import type { Store } from "@patchwork/core";
import {
	verifyChain,
	loadActivePolicy,
	RELAY_SOCKET_PATH,
	RELAY_PID_PATH,
	RELAY_SEALS_PATH,
	RELAY_PROTOCOL_VERSION,
	pingRelay,
	readRelayDivergenceMarker,
} from "@patchwork/core";
import { existsSync, readFileSync, statSync } from "node:fs";
import { connect } from "node:net";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { layout } from "../templates/layout.js";

interface Check {
	label: string;
	status: "pass" | "fail" | "warn";
	message: string;
	fix?: string;
}

/** Extract command string from a hook entry (handles both nested and flat formats). */
function getHookCommand(entry: any): string {
	if (Array.isArray(entry?.hooks) && entry.hooks[0]?.command) {
		return entry.hooks[0].command; // Nested format (correct)
	}
	if (typeof entry?.command === "string") {
		return entry.command; // Flat format (legacy/broken)
	}
	return "";
}

/** Check if a hook entry uses the correct nested format. */
function isNestedFormat(entry: any): boolean {
	return typeof entry?.matcher === "string" && Array.isArray(entry?.hooks);
}

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

export function doctorRoutes(store: Store, dataDir: string) {
	const app = new Hono();

	app.get("/doctor", async (c) => {
		const home = process.env.HOME || "";
		const settingsPath = join(home, ".claude", "settings.json");
		const eventsPath = join(dataDir, "events.jsonl");
		const guardStatusPath = join(dataDir, "state", "guard-status.json");
		const checks: Check[] = [];

		// 1. Settings.json
		if (existsSync(settingsPath)) {
			checks.push({ label: "settings.json", status: "pass", message: "Exists" });
		} else {
			checks.push({ label: "settings.json", status: "fail", message: "NOT FOUND", fix: "patchwork init claude-code" });
		}

		// 2. Hooks
		let hooks: Record<string, any[]> = {};
		let preToolCmd = "";
		let hookFormatOk = true;
		if (existsSync(settingsPath)) {
			try {
				const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
				hooks = settings.hooks || {};
				const expected = ["PreToolUse", "PostToolUse", "SessionStart", "SessionEnd"];
				const missing = expected.filter(e => !hooks[e]?.length);
				if (missing.length === 0) {
					checks.push({ label: "Hooks installed", status: "pass", message: `${Object.keys(hooks).length} hook events configured` });
				} else {
					checks.push({ label: "Hooks installed", status: "fail", message: `Missing: ${missing.join(", ")}`, fix: "patchwork init claude-code" });
				}

				// Check hook format (nested vs flat)
				for (const [event, entries] of Object.entries(hooks)) {
					for (const entry of entries) {
						if (!isNestedFormat(entry) && typeof entry.command === "string") {
							hookFormatOk = false;
							break;
						}
					}
					if (!hookFormatOk) break;
				}

				if (!hookFormatOk) {
					checks.push({
						label: "Hook format",
						status: "fail",
						message: "Uses flat format — hooks will NOT fire",
						fix: "patchwork init claude-code",
					});
				} else {
					checks.push({ label: "Hook format", status: "pass", message: "Correct nested matcher format" });
				}

				// Check for duplicate hooks
				let hasDuplicates = false;
				for (const [event, entries] of Object.entries(hooks)) {
					const patchworkEntries = entries.filter((e: any) => {
						const cmd = getHookCommand(e);
						return /patchwork.*hook\b/.test(cmd);
					});
					if (patchworkEntries.length > 1) {
						hasDuplicates = true;
						break;
					}
				}
				if (hasDuplicates) {
					checks.push({
						label: "Duplicate hooks",
						status: "warn",
						message: "Multiple Patchwork hooks per event — events may be logged twice",
						fix: "Edit settings.json to remove duplicates",
					});
				}

				// Get PreToolUse command for further checks
				if (hooks.PreToolUse?.length) {
					preToolCmd = getHookCommand(hooks.PreToolUse[0]);
				}
			} catch {
				checks.push({ label: "Hooks installed", status: "fail", message: "settings.json is invalid JSON" });
			}
		}

		// 3. Fail-closed
		if (preToolCmd.includes("PATCHWORK_PRETOOL_FAIL_CLOSED=1")) {
			checks.push({ label: "Fail-closed mode", status: "pass", message: "Enabled" });
		} else if (preToolCmd) {
			checks.push({
				label: "Fail-closed mode",
				status: "warn",
				message: "NOT enabled — hooks fail-open on errors",
				fix: "patchwork init claude-code --strict-profile --policy-mode fail-closed",
			});
		}

		// 4. Audit store
		if (existsSync(dataDir)) {
			checks.push({ label: "Audit store", status: "pass", message: dataDir });
			if (existsSync(eventsPath)) {
				try {
					const size = statSync(eventsPath).size;
					const events = store.readRecent(1);
					const total = store.readAll().length;
					checks.push({ label: "Events file", status: "pass", message: `${total} events` });
				} catch {
					checks.push({ label: "Events file", status: "warn", message: "Could not read" });
				}
			} else {
				checks.push({ label: "Events file", status: "warn", message: "No events recorded yet" });
			}
		} else {
			checks.push({ label: "Audit store", status: "fail", message: "Directory not found" });
		}

		// 5. Policy
		try {
			const { policy, source } = loadActivePolicy();
			if (source !== "built-in") {
				checks.push({ label: "Security policy", status: "pass", message: `${policy.name} (${source})` });
			} else {
				checks.push({ label: "Security policy", status: "warn", message: "Using built-in permissive default", fix: "patchwork policy init --strict" });
			}
		} catch {
			checks.push({ label: "Security policy", status: "warn", message: "Could not load policy" });
		}

		// 6. Guard status
		if (existsSync(guardStatusPath)) {
			try {
				const guard = JSON.parse(readFileSync(guardStatusPath, "utf-8"));
				const ageMin = Math.floor((Date.now() - new Date(guard.ts).getTime()) / 60000);
				if (guard.status === "ok" && ageMin < 60) {
					checks.push({ label: "Session guard", status: "pass", message: `Last ran ${ageMin}m ago` });
				} else if (guard.status === "ok") {
					checks.push({ label: "Session guard", status: "warn", message: `Last ran ${ageMin}m ago (stale)` });
				} else {
					checks.push({ label: "Session guard", status: "fail", message: `Status: ${guard.status}` });
				}
			} catch {
				checks.push({ label: "Session guard", status: "warn", message: "Status file unreadable" });
			}
		}

		// 7. Watchdog
		try {
			const launchctl = execSync("launchctl list 2>/dev/null", { stdio: "pipe", encoding: "utf-8", timeout: 3000 });
			if (launchctl.includes("com.patchwork")) {
				checks.push({ label: "Watchdog", status: "pass", message: "LaunchAgent running" });
			} else {
				checks.push({ label: "Watchdog", status: "warn", message: "Not running" });
			}
		} catch {
			checks.push({ label: "Watchdog", status: "warn", message: "Could not check" });
		}

		// 8. Hash chain
		if (existsSync(eventsPath)) {
			try {
				const events = store.readAll();
				if (events.length > 0) {
					const result = verifyChain(events);
					if (result.is_valid) {
						checks.push({ label: "Hash chain", status: "pass", message: `Valid (${result.chained_events} chained, ${result.legacy_events} legacy)` });
					} else {
						checks.push({ label: "Hash chain", status: "fail", message: "BROKEN — audit trail may be tampered" });
					}
				}
			} catch { /* skip */ }
		}

		// 9. Relay daemon — query via socket (not reading entire log)
		const chainState = await queryRelay<any>("get_chain_state");
		const sealStatus = await queryRelay<any>("seal_status");

		if (chainState?.ok) {
			checks.push({ label: "Relay daemon", status: "pass", message: `Running (${chainState.event_count} events)` });

			if (chainState.last_heartbeat) {
				const age = Date.now() - chainState.last_heartbeat;
				const ageStr = age < 60_000 ? `${Math.round(age / 1000)}s ago` : `${Math.round(age / 60_000)}m ago`;
				const status = age < 60_000 ? "pass" as const : age < 120_000 ? "warn" as const : "fail" as const;
				checks.push({ label: "Last heartbeat", status, message: ageStr });
			}

			const uptimeH = Math.floor(chainState.uptime_ms / 3_600_000);
			const uptimeM = Math.floor((chainState.uptime_ms % 3_600_000) / 60_000);
			checks.push({ label: "Relay uptime", status: "pass", message: `${uptimeH}h ${uptimeM}m` });
		} else if (existsSync(RELAY_SOCKET_PATH)) {
			checks.push({ label: "Relay daemon", status: "warn", message: "Socket exists but daemon unreachable" });
		} else {
			checks.push({ label: "Relay daemon", status: "warn", message: "Not installed", fix: "sudo bash scripts/deploy-relay.sh" });
		}

		if (sealStatus?.ok) {
			checks.push({ label: "Auto-seals", status: "pass", message: `${sealStatus.seals_total} seal(s), auto-seal ${sealStatus.auto_seal_enabled ? "on" : "off"}` });
		}

		// 10. Relay divergence
		const divergence = readRelayDivergenceMarker();
		if (divergence && divergence.failure_count > 0) {
			checks.push({ label: "Relay divergence", status: "warn", message: `${divergence.failure_count} failures since ${divergence.first_failure_at}` });
		}

		// 11. Commit attestations
		const attestIndexPath = join(dataDir, "commit-attestations", "index.jsonl");
		if (existsSync(attestIndexPath)) {
			try {
				const content = readFileSync(attestIndexPath, "utf-8").trim();
				const count = content ? content.split("\n").length : 0;
				checks.push({ label: "Commit attestations", status: "pass", message: `${count} attestation(s)` });
			} catch {
				checks.push({ label: "Commit attestations", status: "warn", message: "Index unreadable" });
			}
		} else {
			checks.push({ label: "Commit attestations", status: "warn", message: "None yet — will generate on next git commit" });
		}

		// 12. Team mode
		const teamConfigPath = join("/Library/Patchwork/team", "config.json");
		if (existsSync(teamConfigPath)) {
			try {
				const config = JSON.parse(readFileSync(teamConfigPath, "utf-8"));
				checks.push({ label: "Team mode", status: "pass", message: `Enrolled in "${config.team_name}"` });
			} catch {
				checks.push({ label: "Team mode", status: "warn", message: "Config exists but unreadable" });
			}
		} else {
			checks.push({ label: "Team mode", status: "warn", message: "Not enrolled" });
		}

		const passCount = checks.filter(c => c.status === "pass").length;
		const failCount = checks.filter(c => c.status === "fail").length;
		const warnCount = checks.filter(c => c.status === "warn").length;

		const icons = { pass: "&#10004;", fail: "&#10008;", warn: "&#9888;" };
		const colors = { pass: "var(--green)", fail: "var(--critical)", warn: "var(--medium)" };

		const content = `
		<h1>System Health</h1>
		<p class="subtitle">${passCount} pass, ${failCount} fail, ${warnCount} warnings</p>

		<div class="card">
			<table>
				<thead><tr><th></th><th>Check</th><th>Status</th><th>Fix</th></tr></thead>
				<tbody>
				${checks.map(ch => `<tr>
					<td style="color:${colors[ch.status]};font-size:18px;text-align:center">${icons[ch.status]}</td>
					<td><strong>${esc(ch.label)}</strong></td>
					<td style="color:${colors[ch.status]}">${esc(ch.message)}</td>
					<td>${ch.fix ? `<code style="font-size:12px">${esc(ch.fix)}</code>` : ""}</td>
				</tr>`).join("")}
				</tbody>
			</table>
		</div>

		${failCount > 0 ? `<p style="color:var(--critical);margin-top:16px;font-weight:600">Run the suggested fixes above to resolve critical issues.</p>` : ""}
		${failCount === 0 && warnCount === 0 ? `<p style="color:var(--green);margin-top:16px;font-weight:600">All checks passed. Patchwork is healthy.</p>` : ""}`;

		return c.html(layout("Doctor", "/doctor", content));
	});

	return app;
}

function esc(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
