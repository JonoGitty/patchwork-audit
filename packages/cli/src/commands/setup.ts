import { Command } from "commander";
import chalk from "chalk";
import { createInterface } from "node:readline";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { installClaudeCodeHooks, detectInstalledAgents } from "@patchwork/agents";
import type { InstallOptions } from "@patchwork/agents";
import { getHomeDir, RELAY_SOCKET_PATH } from "@patchwork/core";

// ---------------------------------------------------------------------------
// Interactive prompt helper
// ---------------------------------------------------------------------------

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string): Promise<string> {
	return new Promise((resolve) => rl.question(question, resolve));
}

async function choose(question: string, options: string[], defaultIdx = 0): Promise<number> {
	console.log(chalk.bold(`\n${question}\n`));
	for (let i = 0; i < options.length; i++) {
		const marker = i === defaultIdx ? chalk.cyan("→") : " ";
		const label = i === defaultIdx ? chalk.bold(options[i]) : options[i];
		console.log(`  ${marker} ${chalk.dim(`${i + 1}.`)} ${label}`);
	}
	const raw = await ask(chalk.dim(`\nChoice [${defaultIdx + 1}]: `));
	const idx = raw.trim() === "" ? defaultIdx : parseInt(raw.trim(), 10) - 1;
	if (idx >= 0 && idx < options.length) return idx;
	return defaultIdx;
}

async function confirm(question: string, defaultYes = true): Promise<boolean> {
	const hint = defaultYes ? "Y/n" : "y/N";
	const raw = await ask(`${question} ${chalk.dim(`[${hint}]`)}: `);
	if (raw.trim() === "") return defaultYes;
	return raw.trim().toLowerCase().startsWith("y");
}

// ---------------------------------------------------------------------------
// Setup profiles
// ---------------------------------------------------------------------------

interface SetupProfile {
	name: string;
	description: string;
	policyMode: "audit" | "fail-closed";
	strictProfile: boolean;
	relay: boolean;
	systemInstall: boolean;
	dashboard: boolean;
}

const PROFILES: SetupProfile[] = [
	{
		name: "Personal",
		description: "Audit your own AI usage. Lightweight, no root needed.",
		policyMode: "audit",
		strictProfile: false,
		relay: false,
		systemInstall: false,
		dashboard: true,
	},
	{
		name: "Personal (strict)",
		description: "Personal use with policy enforcement. Blocks dangerous actions.",
		policyMode: "fail-closed",
		strictProfile: true,
		relay: false,
		systemInstall: false,
		dashboard: true,
	},
	{
		name: "Developer workstation",
		description: "Full tamper-proof setup. Relay daemon, locked hooks, strict policy.",
		policyMode: "fail-closed",
		strictProfile: true,
		relay: true,
		systemInstall: true,
		dashboard: true,
	},
	{
		name: "Managed / compliance",
		description: "Enterprise-grade. Tamper-proof, fail-closed, system-level enforcement.",
		policyMode: "fail-closed",
		strictProfile: true,
		relay: true,
		systemInstall: true,
		dashboard: true,
	},
	{
		name: "Custom",
		description: "Choose every option yourself.",
		policyMode: "audit",
		strictProfile: false,
		relay: false,
		systemInstall: false,
		dashboard: false,
	},
];

// ---------------------------------------------------------------------------
// Setup command
// ---------------------------------------------------------------------------

export const setupCommand = new Command("setup")
	.description("Interactive guided setup for Patchwork")
	.action(async () => {
		console.log(chalk.bold.cyan("\n  Patchwork Setup\n"));
		console.log(chalk.dim("  The audit trail for AI coding agents.\n"));
		console.log(chalk.dim("  This wizard will configure hooks, policy,"));
		console.log(chalk.dim("  and optionally the tamper-proof relay daemon.\n"));

		// ---------------------------------------------------------------
		// Step 1: Detect environment
		// ---------------------------------------------------------------
		console.log(chalk.bold("─── Environment ───\n"));

		let claudeInstalled = false;
		try {
			const agents = detectInstalledAgents();
			claudeInstalled = agents.some((a) => a.agent === "claude-code" && a.installed);
		} catch {
			// Agent detection may throw for broken installs — non-fatal
		}
		const platform = process.platform;
		const isRoot = process.getuid?.() === 0;
		const relayRunning = existsSync(RELAY_SOCKET_PATH);
		const hooksExist = existsSync(join(getHomeDir(), ".claude", "settings.json"));

		console.log(`  Platform:     ${chalk.bold(platform === "darwin" ? "macOS" : platform === "win32" ? "Windows" : "Linux")}`);
		console.log(`  Claude Code:  ${claudeInstalled ? chalk.green("installed") : chalk.yellow("not found")}`);
		console.log(`  Hooks:        ${hooksExist ? chalk.green("configured") : chalk.dim("not yet")}`);
		console.log(`  Relay:        ${relayRunning ? chalk.green("running") : chalk.dim("not installed")}`);
		console.log(`  Running as:   ${isRoot ? chalk.yellow("root") : chalk.dim(process.env.USER || "user")}`);

		// ---------------------------------------------------------------
		// Step 2: Choose profile
		// ---------------------------------------------------------------
		const profileIdx = await choose(
			"How do you want to use Patchwork?",
			PROFILES.map((p) => `${chalk.bold(p.name)} — ${p.description}`),
			0,
		);
		let profile = { ...PROFILES[profileIdx] };

		// ---------------------------------------------------------------
		// Step 3: Custom options (if Custom profile selected)
		// ---------------------------------------------------------------
		if (profile.name === "Custom") {
			const modeIdx = await choose("Policy mode?", [
				"Audit only — log everything, block nothing",
				"Fail-closed — block dangerous actions, deny on hook errors",
			], 0);
			profile.policyMode = modeIdx === 0 ? "audit" : "fail-closed";
			profile.strictProfile = modeIdx === 1;

			if (platform !== "win32") {
				profile.relay = await confirm("Install relay daemon? (tamper-proof root-owned audit copy, needs sudo)");
				profile.systemInstall = await confirm("Lock hooks with system-level enforcement? (prevents AI from disabling monitoring, needs sudo)");
			}
			profile.dashboard = await confirm("Enable web dashboard?");
		}

		// ---------------------------------------------------------------
		// Step 4: Confirm
		// ---------------------------------------------------------------
		console.log(chalk.bold("\n─── Configuration ───\n"));
		console.log(`  Profile:          ${chalk.bold(profile.name)}`);
		console.log(`  Policy mode:      ${profile.policyMode === "fail-closed" ? chalk.yellow("fail-closed") : chalk.green("audit")}`);
		console.log(`  Strict profile:   ${profile.strictProfile ? chalk.yellow("yes") : chalk.dim("no")}`);
		console.log(`  Relay daemon:     ${profile.relay ? chalk.cyan("yes") : chalk.dim("no")}`);
		console.log(`  System enforce:   ${profile.systemInstall ? chalk.cyan("yes") : chalk.dim("no")}`);
		console.log(`  Dashboard:        ${profile.dashboard ? chalk.cyan("yes") : chalk.dim("no")}`);

		const proceed = await confirm("\nProceed with this configuration?");
		if (!proceed) {
			console.log(chalk.dim("\nSetup cancelled."));
			rl.close();
			return;
		}

		// ---------------------------------------------------------------
		// Step 5: Install
		// ---------------------------------------------------------------
		console.log(chalk.bold("\n─── Installing ───\n"));
		const steps: string[] = [];

		// 5a. Install hooks for Claude Code
		if (claudeInstalled) {
			const opts: InstallOptions = {};
			if (profile.strictProfile) {
				opts.policyMode = "fail-closed";
				opts.pretoolWarnMs = 500;
				opts.pretoolTelemetryJson = true;
			} else if (profile.policyMode === "fail-closed") {
				opts.policyMode = "fail-closed";
			}

			const result = installClaudeCodeHooks(undefined, undefined, opts);
			if (result.success) {
				const count = result.hooksInstalled.length + result.hooksUpdated.length;
				console.log(chalk.green(`  ✓ Claude Code hooks installed (${count} events)`));
				steps.push("hooks");
			} else {
				console.log(chalk.red(`  ✗ Hook install failed: ${result.error}`));
			}
		} else {
			console.log(chalk.yellow("  ⚠ Claude Code not found — skipping hooks"));
			console.log(chalk.dim("    Install Claude Code and re-run: patchwork setup"));
		}

		// 5b. Create policy
		if (profile.strictProfile || profile.policyMode === "fail-closed") {
			const policyPath = join(getHomeDir(), ".patchwork", "policy.yml");
			if (!existsSync(policyPath)) {
				// Use the built-in strict policy
				try {
					const { mkdirSync, writeFileSync } = await import("node:fs");
					const policyDir = join(getHomeDir(), ".patchwork");
					if (!existsSync(policyDir)) mkdirSync(policyDir, { recursive: true, mode: 0o700 });

					const defaultPolicy = `name: patchwork-strict
max_risk: high

files:
  deny:
    - pattern: "**/.env"
      reason: Environment files contain secrets
    - pattern: "**/.env.*"
      reason: Environment files contain secrets
    - pattern: "**/.claude/settings.json"
      reason: Audit hooks must not be modified
    - pattern: "**/.patchwork/**"
      reason: Audit data must not be tampered with
    - pattern: "**/id_rsa"
      reason: SSH private keys
    - pattern: "**/id_ed25519"
      reason: SSH private keys
  default_action: allow

commands:
  deny:
    - prefix: "rm -rf /"
      reason: Recursive force delete of root
    - prefix: sudo
      reason: Elevated privileges blocked
    - prefix: "git push --force"
      reason: Force push blocked by policy
  default_action: allow
`;
					writeFileSync(policyPath, defaultPolicy, { mode: 0o600 });
					console.log(chalk.green("  ✓ Strict policy created"));
					steps.push("policy");
				} catch (err: unknown) {
					console.log(chalk.red(`  ✗ Policy creation failed: ${err instanceof Error ? err.message : err}`));
				}
			} else {
				console.log(chalk.dim("  · Policy already exists — skipping"));
			}
		}

		// 5c. Relay daemon
		if (profile.relay) {
			if (relayRunning) {
				console.log(chalk.dim("  · Relay already running — skipping"));
				steps.push("relay");
			} else if (!isRoot) {
				console.log(chalk.yellow("  ⚠ Relay daemon requires root. Run separately:"));
				console.log(chalk.dim("    sudo bash scripts/deploy-relay.sh"));
			} else {
				console.log(chalk.dim("  · Relay requires separate deployment:"));
				console.log(chalk.dim("    sudo bash scripts/deploy-relay.sh"));
			}
		}

		// 5d. System-level enforcement
		if (profile.systemInstall) {
			if (!isRoot) {
				console.log(chalk.yellow("  ⚠ System enforcement requires root. Run separately:"));
				console.log(chalk.dim("    sudo bash scripts/system-install.sh"));
			} else {
				console.log(chalk.dim("  · System enforcement requires separate script:"));
				console.log(chalk.dim("    sudo bash scripts/system-install.sh"));
			}
		}

		// ---------------------------------------------------------------
		// Step 6: Summary
		// ---------------------------------------------------------------
		console.log(chalk.bold("\n─── Done ───\n"));

		if (steps.length > 0) {
			console.log(chalk.green(`  Setup complete: ${steps.join(", ")} configured.\n`));
		}

		console.log("  Next steps:");
		console.log(chalk.dim("    patchwork status        — verify everything is working"));
		console.log(chalk.dim("    patchwork log           — view recent events"));
		console.log(chalk.dim("    patchwork dashboard     — open the web UI"));

		if (profile.relay && !relayRunning) {
			console.log(chalk.dim("    sudo bash scripts/deploy-relay.sh  — install relay daemon"));
		}
		if (profile.systemInstall && !isRoot) {
			console.log(chalk.dim("    sudo bash scripts/system-install.sh — lock down hooks"));
		}

		console.log("");
		rl.close();
	});
