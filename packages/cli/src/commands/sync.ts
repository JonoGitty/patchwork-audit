import { Command } from "commander";
import chalk from "chalk";
import { syncCodexHistory } from "@patchwork/agents";

export const syncCommand = new Command("sync")
	.description("Sync events from agent history files")
	.argument("<agent>", "Agent to sync: codex")
	.action((agent: string) => {
		switch (agent) {
			case "codex": {
				console.log(chalk.dim("Syncing Codex CLI history..."));
				const result = syncCodexHistory();
				console.log(chalk.green(`  Ingested: ${result.ingested} events`));
				if (result.skipped > 0) {
					console.log(chalk.dim(`  Skipped:  ${result.skipped} (already synced)`));
				}
				if (result.errors > 0) {
					console.log(chalk.yellow(`  Errors:   ${result.errors}`));
				}
				break;
			}
			default:
				console.log(chalk.red(`Unknown agent: ${agent}`));
				console.log("Supported: codex");
		}
	});
