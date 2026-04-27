import { Command } from "commander";
import chalk from "chalk";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";
import { getHomeDir } from "@patchwork/core";

const PASS = chalk.green("\u2714");
const FAIL = chalk.red("\u2718");
const WARN = chalk.yellow("\u26A0");

/** Extract command string from a hook entry (handles both nested and flat formats). */
function getHookCommand(entry: any): string {
	if (Array.isArray(entry?.hooks) && entry.hooks[0]?.command) {
		return entry.hooks[0].command;
	}
	if (typeof entry?.command === "string") {
		return entry.command;
	}
	return "";
}

export const doctorCommand = new Command("doctor")
	.description("Check Patchwork health: hooks, node, store, policy, watchdog")
	.action(() => {
		console.log(chalk.bold("\n  Patchwork Doctor\n"));

		const home = getHomeDir();
		const settingsPath = join(home, ".claude", "settings.json");
		const patchworkDir = join(home, ".patchwork");
		const eventsPath = join(patchworkDir, "events.jsonl");
		const policyPath = join(patchworkDir, "policy.yml");
		const systemPolicyPath = "/Library/Patchwork/policy.yml";
		const guardStatusPath = join(patchworkDir, "state", "guard-status.json");
		let issues = 0;
		let warnings = 0;

		// 1. Settings.json exists
		if (existsSync(settingsPath)) {
			console.log(`  ${PASS} settings.json exists`);
		} else {
			console.log(`  ${FAIL} settings.json NOT FOUND at ${settingsPath}`);
			console.log(`     Fix: patchwork init claude-code --strict-profile --policy-mode fail-closed`);
			issues++;
		}

		// 2. Hooks present
		let hooks: Record<string, any[]> = {};
		if (existsSync(settingsPath)) {
			try {
				const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
				hooks = settings.hooks || {};
				const hookEvents = Object.keys(hooks);
				const expected = ["PreToolUse", "PostToolUse", "SessionStart", "SessionEnd"];
				const missing = expected.filter(e => !hookEvents.includes(e) || hooks[e].length === 0);

				if (missing.length === 0) {
					console.log(`  ${PASS} All required hooks installed (${hookEvents.length} events)`);
				} else {
					console.log(`  ${FAIL} Missing hooks: ${missing.join(", ")}`);
					console.log(`     Fix: patchwork init claude-code --strict-profile --policy-mode fail-closed`);
					issues++;
				}
			} catch {
				console.log(`  ${FAIL} settings.json is not valid JSON`);
				issues++;
			}
		}

		// 3. Hooks use explicit node path (not bare patchwork)
		const preToolCmd = getHookCommand(hooks.PreToolUse?.[0]);
		const hasExplicitNode = /\/node(?:\.exe)?["'\s]/.test(preToolCmd);
		const usesWrapper = /hook-wrapper\.(sh|cmd|bat|ps1)/.test(preToolCmd);
		if (hasExplicitNode || usesWrapper) {
			const detail = usesWrapper && !hasExplicitNode ? " (via hook-wrapper)" : "";
			console.log(`  ${PASS} Hooks use explicit node path (architecture-safe)${detail}`);
		} else if (preToolCmd.includes("patchwork hook")) {
			console.log(`  ${WARN} Hooks use bare 'patchwork' — may fail on mixed-architecture Macs`);
			console.log(`     Fix: patchwork init claude-code --strict-profile --policy-mode fail-closed`);
			warnings++;
		} else if (preToolCmd) {
			console.log(`  ${WARN} PreToolUse hook command is unusual: ${preToolCmd.slice(0, 60)}`);
			warnings++;
		}

		// 4. Fail-closed enabled
		if (preToolCmd.includes("PATCHWORK_PRETOOL_FAIL_CLOSED=1")) {
			console.log(`  ${PASS} Fail-closed mode enabled`);
		} else {
			console.log(`  ${WARN} Fail-closed mode NOT enabled — hooks fail-open on errors`);
			console.log(`     Fix: patchwork init claude-code --strict-profile --policy-mode fail-closed`);
			warnings++;
		}

		// 5. Hook command actually works
		if (preToolCmd) {
			try {
				// Extract the node + patchwork part and test --version
				const match = preToolCmd.match(/(\S+\/node)\s+(\S+\/patchwork)/);
				if (match) {
					const result = execSync(`${match[1]} ${match[2]} --version`, {
						stdio: "pipe", encoding: "utf-8", timeout: 5000,
					}).trim();
					console.log(`  ${PASS} Hook command executable (patchwork v${result})`);
				} else {
					// Try bare patchwork
					const result = execSync("patchwork --version", {
						stdio: "pipe", encoding: "utf-8", timeout: 5000,
					}).trim();
					console.log(`  ${PASS} Hook command executable (patchwork v${result})`);
				}
			} catch (err: any) {
				const msg = err.message || "";
				if (msg.includes("Bad CPU type")) {
					console.log(`  ${FAIL} Hook command FAILS — wrong CPU architecture for node binary`);
					console.log(`     This is the #1 cause of silent hook failures.`);
					console.log(`     Fix: patchwork init claude-code --strict-profile --policy-mode fail-closed`);
				} else {
					console.log(`  ${FAIL} Hook command FAILS: ${msg.slice(0, 80)}`);
				}
				issues++;
			}
		}

		// 6. Audit store
		if (existsSync(patchworkDir)) {
			console.log(`  ${PASS} Audit store directory exists`);
			try {
				statSync(patchworkDir);
				if (existsSync(eventsPath)) {
					const lines = readFileSync(eventsPath, "utf-8").trim().split("\n").length;
					console.log(`  ${PASS} Events file: ${lines} events`);
				} else {
					console.log(`  ${WARN} No events recorded yet`);
					warnings++;
				}
			} catch {
				console.log(`  ${FAIL} Audit store not readable`);
				issues++;
			}
		} else {
			console.log(`  ${FAIL} Audit store directory NOT FOUND`);
			issues++;
		}

		// 7. Policy
		if (existsSync(systemPolicyPath)) {
			console.log(`  ${PASS} System policy active: ${systemPolicyPath}`);
		} else if (existsSync(policyPath)) {
			console.log(`  ${PASS} User policy active: ${policyPath}`);
		} else {
			console.log(`  ${WARN} No security policy configured — all actions allowed`);
			console.log(`     Fix: patchwork policy init --strict`);
			warnings++;
		}

		// 8. Guard status
		if (existsSync(guardStatusPath)) {
			try {
				const guard = JSON.parse(readFileSync(guardStatusPath, "utf-8"));
				const age = Date.now() - new Date(guard.ts).getTime();
				const ageMin = Math.floor(age / 60000);
				if (guard.status === "ok" && ageMin < 60) {
					console.log(`  ${PASS} Guard last ran ${ageMin}m ago — OK`);
				} else if (guard.status === "ok") {
					console.log(`  ${WARN} Guard last ran ${ageMin}m ago — may be stale`);
					warnings++;
				} else {
					console.log(`  ${FAIL} Guard last status: ${guard.status} (${guard.reason || "unknown"})`);
					issues++;
				}
			} catch {
				console.log(`  ${WARN} Guard status file unreadable`);
				warnings++;
			}
		} else {
			console.log(`  ${WARN} Guard has never run (no status file)`);
			warnings++;
		}

		// 9. Watchdog
		try {
			const launchctl = execSync("launchctl list 2>/dev/null", {
				stdio: "pipe", encoding: "utf-8", timeout: 5000,
			});
			if (launchctl.includes("com.patchwork")) {
				console.log(`  ${PASS} Watchdog LaunchAgent running`);
			} else {
				console.log(`  ${WARN} Watchdog LaunchAgent not running`);
				console.log(`     Fix: launchctl load ~/Library/LaunchAgents/com.patchwork.watchdog.plist`);
				warnings++;
			}
		} catch {
			console.log(`  ${WARN} Could not check LaunchAgent status`);
			warnings++;
		}

		// 10. Hash chain
		if (existsSync(eventsPath)) {
			try {
				const { verifyChain } = require("@patchwork/core");
				const events = require("@patchwork/core").JsonlStore
					? new (require("@patchwork/core").JsonlStore)(eventsPath).readAll()
					: [];
				if (events.length > 0) {
					const result = verifyChain(events);
					if (result.is_valid) {
						console.log(`  ${PASS} Hash chain valid (${result.chained_events} chained, ${result.legacy_events} legacy)`);
					} else {
						console.log(`  ${FAIL} Hash chain BROKEN — audit trail may be tampered`);
						issues++;
					}
				}
			} catch {
				// Can't verify chain — skip
			}
		}

		// Summary
		console.log();
		if (issues === 0 && warnings === 0) {
			console.log(chalk.green.bold("  All checks passed. Patchwork is healthy.\n"));
		} else if (issues === 0) {
			console.log(chalk.yellow.bold(`  ${warnings} warning(s), no critical issues.\n`));
		} else {
			console.log(chalk.red.bold(`  ${issues} issue(s), ${warnings} warning(s). Run the suggested fixes above.\n`));
			process.exitCode = 1;
		}
	});
