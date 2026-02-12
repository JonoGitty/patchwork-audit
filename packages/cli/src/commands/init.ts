import { Command } from "commander";
import chalk from "chalk";
import { installClaudeCodeHooks, detectInstalledAgents } from "@patchwork/agents";

export const initCommand = new Command("init")
	.description("Install Patchwork hooks for AI coding agents")
	.argument("[agent]", "Agent to configure: claude-code, codex, or all")
	.option("--project <path>", "Install project-level hooks instead of global")
	.action((agent: string | undefined, opts: { project?: string }) => {
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
					installClaude(opts.project);
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
				installClaude(opts.project);
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

function installClaude(projectPath?: string) {
	const result = installClaudeCodeHooks(projectPath);

	if (result.success) {
		if (result.hooksInstalled.length > 0) {
			console.log(chalk.green(`  Claude Code hooks installed (${result.hooksInstalled.length} events)`));
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
	console.log(chalk.dim("  Real-time: Add notify hook to ~/.codex/config.yaml (see docs)"));
}
