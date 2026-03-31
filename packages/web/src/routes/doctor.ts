import { Hono } from "hono";
import type { Store } from "@patchwork/core";
import { verifyChain, loadActivePolicy } from "@patchwork/core";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { layout } from "../templates/layout.js";

interface Check {
	label: string;
	status: "pass" | "fail" | "warn";
	message: string;
	fix?: string;
}

export function doctorRoutes(store: Store, dataDir: string) {
	const app = new Hono();

	app.get("/doctor", (c) => {
		const home = process.env.HOME || "";
		const settingsPath = join(home, ".claude", "settings.json");
		const eventsPath = join(dataDir, "events.jsonl");
		const guardStatusPath = join(dataDir, "state", "guard-status.json");
		const checks: Check[] = [];

		// 1. Settings.json
		if (existsSync(settingsPath)) {
			checks.push({ label: "settings.json", status: "pass", message: "Exists" });
		} else {
			checks.push({ label: "settings.json", status: "fail", message: "NOT FOUND", fix: "patchwork init claude-code --strict-profile --policy-mode fail-closed" });
		}

		// 2. Hooks
		let hooks: Record<string, any[]> = {};
		let preToolCmd = "";
		if (existsSync(settingsPath)) {
			try {
				const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
				hooks = settings.hooks || {};
				const expected = ["PreToolUse", "PostToolUse", "SessionStart", "SessionEnd"];
				const missing = expected.filter(e => !hooks[e]?.length);
				if (missing.length === 0) {
					checks.push({ label: "Hooks installed", status: "pass", message: `${Object.keys(hooks).length} hook events configured` });
				} else {
					checks.push({ label: "Hooks installed", status: "fail", message: `Missing: ${missing.join(", ")}`, fix: "patchwork init claude-code --strict-profile --policy-mode fail-closed" });
				}
				preToolCmd = hooks.PreToolUse?.[0]?.command || "";
			} catch {
				checks.push({ label: "Hooks installed", status: "fail", message: "settings.json is invalid JSON" });
			}
		}

		// 3. Explicit node path
		if (preToolCmd.includes("/node ")) {
			checks.push({ label: "Architecture-safe hooks", status: "pass", message: "Uses explicit node path" });
		} else if (preToolCmd.includes("patchwork hook")) {
			checks.push({ label: "Architecture-safe hooks", status: "warn", message: "Uses bare 'patchwork' — may fail on mixed-arch Macs", fix: "patchwork init claude-code --strict-profile --policy-mode fail-closed" });
		}

		// 4. Fail-closed
		if (preToolCmd.includes("PATCHWORK_PRETOOL_FAIL_CLOSED=1")) {
			checks.push({ label: "Fail-closed mode", status: "pass", message: "Enabled" });
		} else {
			checks.push({ label: "Fail-closed mode", status: "warn", message: "NOT enabled — hooks fail-open on errors", fix: "patchwork init claude-code --strict-profile --policy-mode fail-closed" });
		}

		// 5. Audit store
		if (existsSync(dataDir)) {
			checks.push({ label: "Audit store", status: "pass", message: dataDir });
			if (existsSync(eventsPath)) {
				const lines = readFileSync(eventsPath, "utf-8").trim().split("\n").length;
				checks.push({ label: "Events file", status: "pass", message: `${lines} events` });
			} else {
				checks.push({ label: "Events file", status: "warn", message: "No events recorded yet" });
			}
		} else {
			checks.push({ label: "Audit store", status: "fail", message: "Directory not found" });
		}

		// 6. Policy
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

		// 7. Guard status
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
		} else {
			checks.push({ label: "Session guard", status: "warn", message: "Never run" });
		}

		// 8. Watchdog
		try {
			const launchctl = execSync("launchctl list 2>/dev/null", { stdio: "pipe", encoding: "utf-8", timeout: 3000 });
			if (launchctl.includes("com.patchwork")) {
				checks.push({ label: "Watchdog", status: "pass", message: "LaunchAgent running" });
			} else {
				checks.push({ label: "Watchdog", status: "warn", message: "Not running", fix: "launchctl load ~/Library/LaunchAgents/com.patchwork.watchdog.plist" });
			}
		} catch {
			checks.push({ label: "Watchdog", status: "warn", message: "Could not check" });
		}

		// 9. Hash chain
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
