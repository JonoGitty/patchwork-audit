import { Command } from "commander";
import chalk from "chalk";
import { installClaudeCodeHooks, detectInstalledAgents } from "@patchwork/agents";
import type { InstallOptions, PolicyMode, TelemetryDest, TelemetryLockMode } from "@patchwork/agents";

const VALID_POLICY_MODES = ["audit", "fail-closed"] as const;
const VALID_TELEMETRY_DESTS = ["stderr", "file", "both"] as const;
const VALID_LOCK_MODES = ["always", "rotate-only"] as const;

interface InitOpts {
	project?: string;
	strictProfile?: true;
	policyMode?: string;
	pretoolFailClosed?: true;
	pretoolWarnMs?: string;
	pretoolTelemetryJson?: true;
	pretoolTelemetryDest?: string;
	pretoolTelemetryFile?: string;
	pretoolTelemetryMaxBytes?: string;
	pretoolTelemetryMaxFiles?: string;
	pretoolTelemetryLockMode?: string;
}

export const initCommand = new Command("init")
	.description("Install Patchwork hooks for AI coding agents")
	.argument("[agent]", "Agent to configure: claude-code, codex, or all")
	.option("--project <path>", "Install project-level hooks instead of global")
	.option("--strict-profile", "Strict enforcement: fail-closed + telemetry + warn at 500ms")
	.option("--policy-mode <mode>", "Policy mode: audit (default) or fail-closed")
	.option("--pretool-fail-closed", "Enable fail-closed mode for PreToolUse hooks (legacy)")
	.option("--pretool-warn-ms <ms>", "Latency warning threshold for PreToolUse (ms)")
	.option("--pretool-telemetry-json", "Emit structured JSON telemetry for PreToolUse")
	.option("--pretool-telemetry-dest <dest>", "Telemetry destination: stderr (default), file, or both")
	.option("--pretool-telemetry-file <path>", "File path for telemetry JSONL output")
	.option("--pretool-telemetry-max-bytes <n>", "Max telemetry file size before rotation (0 = disabled)")
	.option("--pretool-telemetry-max-files <n>", "Max rotated telemetry files to keep (default: 5)")
	.option("--pretool-telemetry-lock-mode <mode>", "Lock mode for telemetry writes: always (default) or rotate-only")
	.action((agent: string | undefined, opts: InitOpts) => {
		const installOpts = buildInstallOptions(opts);
		if (!installOpts) return; // validation error already printed

		if (!agent || agent === "all") {
			// Auto-detect and install for all found agents
			const detected = detectInstalledAgents();
			const installed = detected.filter((a) => a.installed);

			if (installed.length === 0) {
				console.log(chalk.yellow("No AI coding agents detected."));
				console.log("Supported agents: Claude Code, Codex CLI, Cursor");
				return;
			}

			console.log(chalk.bold("Detected agents:\n"));
			for (const a of installed) {
				console.log(`  ${chalk.green("+")} ${a.name} ${a.version ? chalk.dim(`v${a.version}`) : ""}`);
			}
			console.log();

			for (const a of installed) {
				if (a.type === "claude-code") {
					installClaude(opts.project, installOpts);
				} else if (a.type === "codex") {
					installCodex();
				} else if (a.type === "cursor") {
					console.log(chalk.yellow(`  Cursor support coming soon.`));
				}
			}
			return;
		}

		switch (agent) {
			case "claude-code":
				installClaude(opts.project, installOpts);
				break;
			case "codex":
				installCodex();
				break;
			case "cursor":
				console.log(chalk.yellow("Cursor support coming soon."));
				break;
			default:
				console.log(chalk.red(`Unknown agent: ${agent}`));
				console.log("Supported: claude-code, codex, cursor, all");
		}
	});

function buildInstallOptions(opts: InitOpts): InstallOptions | null {
	const installOpts: InstallOptions = {};

	// Apply strict profile defaults first — explicit flags override below
	if (opts.strictProfile) {
		installOpts.policyMode = "fail-closed";
		installOpts.pretoolTelemetryJson = true;
		installOpts.pretoolWarnMs = 500;
	}

	// Explicit --policy-mode overrides strict default
	if (opts.policyMode !== undefined) {
		if (!VALID_POLICY_MODES.includes(opts.policyMode as PolicyMode)) {
			console.log(chalk.red(`Invalid --policy-mode: "${opts.policyMode}" (must be "audit" or "fail-closed")`));
			process.exitCode = 1;
			return null;
		}
		installOpts.policyMode = opts.policyMode as PolicyMode;
	}

	if (opts.pretoolFailClosed) {
		installOpts.pretoolFailClosed = true;
	}

	// Explicit --pretool-warn-ms overrides strict default
	if (opts.pretoolWarnMs !== undefined) {
		const ms = Number(opts.pretoolWarnMs);
		if (!Number.isInteger(ms) || ms < 0) {
			console.log(chalk.red(`Invalid --pretool-warn-ms: "${opts.pretoolWarnMs}" (must be a non-negative integer)`));
			process.exitCode = 1;
			return null;
		}
		installOpts.pretoolWarnMs = ms;
	}

	if (opts.pretoolTelemetryJson) {
		installOpts.pretoolTelemetryJson = true;
	}

	if (opts.pretoolTelemetryDest !== undefined) {
		if (!VALID_TELEMETRY_DESTS.includes(opts.pretoolTelemetryDest as TelemetryDest)) {
			console.log(chalk.red(`Invalid --pretool-telemetry-dest: "${opts.pretoolTelemetryDest}" (must be "stderr", "file", or "both")`));
			process.exitCode = 1;
			return null;
		}
		installOpts.pretoolTelemetryDest = opts.pretoolTelemetryDest as TelemetryDest;
	}

	if (opts.pretoolTelemetryFile !== undefined) {
		installOpts.pretoolTelemetryFile = opts.pretoolTelemetryFile;
	}

	if (opts.pretoolTelemetryMaxBytes !== undefined) {
		const n = Number(opts.pretoolTelemetryMaxBytes);
		if (!Number.isInteger(n) || n < 0) {
			console.log(chalk.red(`Invalid --pretool-telemetry-max-bytes: "${opts.pretoolTelemetryMaxBytes}" (must be a non-negative integer)`));
			process.exitCode = 1;
			return null;
		}
		installOpts.pretoolTelemetryMaxBytes = n;
	}

	if (opts.pretoolTelemetryMaxFiles !== undefined) {
		const n = Number(opts.pretoolTelemetryMaxFiles);
		if (!Number.isInteger(n) || n < 1) {
			console.log(chalk.red(`Invalid --pretool-telemetry-max-files: "${opts.pretoolTelemetryMaxFiles}" (must be a positive integer)`));
			process.exitCode = 1;
			return null;
		}
		installOpts.pretoolTelemetryMaxFiles = n;
	}

	if (opts.pretoolTelemetryLockMode !== undefined) {
		if (!VALID_LOCK_MODES.includes(opts.pretoolTelemetryLockMode as TelemetryLockMode)) {
			console.log(chalk.red(`Invalid --pretool-telemetry-lock-mode: "${opts.pretoolTelemetryLockMode}" (must be "always" or "rotate-only")`));
			process.exitCode = 1;
			return null;
		}
		installOpts.pretoolTelemetryLockMode = opts.pretoolTelemetryLockMode as TelemetryLockMode;
	}

	// Print strict profile summary
	if (opts.strictProfile) {
		const mode = installOpts.policyMode || "fail-closed";
		const warn = installOpts.pretoolWarnMs ?? 500;
		const telemetry = installOpts.pretoolTelemetryJson ? "on" : "off";
		console.log(chalk.cyan(`  Strict profile: mode=${mode}, warn=${warn}ms, telemetry=${telemetry}`));
	}

	return installOpts;
}

function installClaude(projectPath?: string, options?: InstallOptions) {
	const result = installClaudeCodeHooks(projectPath, undefined, options);

	if (result.success) {
		if (result.hooksInstalled.length > 0) {
			console.log(chalk.green(`  Claude Code hooks installed (${result.hooksInstalled.length} events)`));
			console.log(chalk.dim(`  Settings: ${result.settingsPath}`));
		} else if (result.hooksUpdated.length > 0) {
			console.log(chalk.green(`  Claude Code hooks updated (${result.hooksUpdated.join(", ")})`));
			console.log(chalk.dim(`  Settings: ${result.settingsPath}`));
		} else {
			console.log(chalk.dim("  Claude Code hooks already installed."));
		}
	} else {
		console.log(chalk.red(`  Failed to install Claude Code hooks: ${result.error}`));
	}
}

function installCodex() {
	// Codex uses history parsing + notify, not hooks
	console.log(chalk.green("  Codex CLI configured for history sync."));
	console.log(chalk.dim("  Run 'patchwork sync codex' after sessions to ingest events."));
	console.log(chalk.dim("  Real-time: Add notify hook to ~/.codex/config.toml (or config.yaml, depending on version)."));
}
