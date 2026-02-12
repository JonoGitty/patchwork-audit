import { Command } from "commander";
import chalk from "chalk";
import { syncCodexHistory } from "@patchwork/agents";
import { JsonlStore, SqliteStore } from "@patchwork/core";
import { EVENTS_PATH, DB_PATH } from "../store.js";

const syncDb = new Command("db")
	.description("Rebuild SQLite database from JSONL events")
	.action(() => {
		const jsonlStore = new JsonlStore(EVENTS_PATH);
		const events = jsonlStore.readAll();

		if (events.length === 0) {
			console.log(chalk.dim("No events to sync."));
			return;
		}

		console.log(chalk.dim(`Reading ${events.length} events from JSONL...`));

		const sqliteStore = new SqliteStore(DB_PATH);
		let inserted = 0;
		let skipped = 0;

		for (const event of events) {
			try {
				sqliteStore.append(event);
				inserted++;
			} catch {
				skipped++;
			}
		}

		sqliteStore.close();

		console.log(chalk.green(`  Synced:  ${inserted} events to SQLite`));
		if (skipped > 0) {
			console.log(chalk.dim(`  Skipped: ${skipped} (duplicates)`));
		}
		console.log(chalk.dim(`  DB:      ${DB_PATH}`));
	});

export const syncCommand = new Command("sync")
	.description("Sync events from agent history files or rebuild database")
	.argument("[agent]", "Agent to sync: codex, db")
	.action((agent?: string) => {
		if (!agent) {
			console.log("Usage: patchwork sync <codex|db>");
			console.log("  codex  Sync from Codex CLI history");
			console.log("  db     Rebuild SQLite database from JSONL");
			return;
		}
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
				console.log("Supported: codex, db");
		}
	});

syncCommand.addCommand(syncDb);
