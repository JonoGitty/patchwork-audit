import { Command } from "commander";
import { existsSync, unlinkSync } from "node:fs";
import chalk from "chalk";
import { syncCodexHistory, readDivergenceMarker } from "@patchwork/agents";
import { JsonlStore, SqliteStore } from "@patchwork/core";
import { EVENTS_PATH, DB_PATH, DIVERGENCE_MARKER_PATH } from "../store.js";

const syncDb = new Command("db")
	.description("Rebuild SQLite database from JSONL events")
	.action(() => {
		// Check for divergence marker before sync
		const markerBefore = readDivergenceMarker(DIVERGENCE_MARKER_PATH);
		if (markerBefore) {
			console.log(
				chalk.yellow(
					`  Divergence detected: ${markerBefore.failure_count} SQLite write failure(s), last at ${markerBefore.last_failure_at}`,
				),
			);
		}

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
		let appendFailures = 0;

		for (const event of events) {
			try {
				sqliteStore.append(event);
				inserted++;
			} catch (err: unknown) {
				// Distinguish genuine failures from dedup skips:
				// SQLite UNIQUE constraint violations are benign duplicates;
				// everything else is a real append failure.
				const msg = err instanceof Error ? err.message : String(err);
				if (msg.includes("UNIQUE constraint")) {
					skipped++;
				} else {
					appendFailures++;
				}
			}
		}

		sqliteStore.close();

		console.log(chalk.green(`  Synced:  ${inserted} events to SQLite`));
		if (skipped > 0) {
			console.log(chalk.dim(`  Skipped: ${skipped} (duplicates)`));
		}
		if (appendFailures > 0) {
			console.log(chalk.red(`  Failed:  ${appendFailures} event(s) could not be written`));
			console.log(chalk.dim("  Divergence marker preserved. Investigate and retry."));
			process.exitCode = 1;
		}
		console.log(chalk.dim(`  DB:      ${DB_PATH}`));

		// Clear divergence marker only on full success (zero append failures)
		if (markerBefore && appendFailures === 0 && existsSync(DIVERGENCE_MARKER_PATH)) {
			try {
				unlinkSync(DIVERGENCE_MARKER_PATH);
				console.log(chalk.green("  Cleared divergence marker."));
			} catch {
				// Best effort
			}
		}
	});

const syncDbStatus = new Command("db-status")
	.description("Check whether a SQLite divergence marker is present")
	.option("--json", "Output result as JSON")
	.option("--marker-file <path>", "Path to divergence marker file (for testing)")
	.action((opts) => {
		const markerPath = opts.markerFile || DIVERGENCE_MARKER_PATH;
		const marker = readDivergenceMarker(markerPath);

		if (opts.json) {
			if (marker) {
				console.log(JSON.stringify({ diverged: true, ...marker }));
			} else {
				console.log(JSON.stringify({ diverged: false }));
			}
			return;
		}

		if (marker) {
			console.log(chalk.yellow("SQLite divergence detected"));
			console.log(`  Failures:     ${marker.failure_count}`);
			console.log(`  First:        ${marker.first_failure_at}`);
			console.log(`  Last:         ${marker.last_failure_at}`);
			console.log(`  Last error:   ${chalk.dim(marker.last_error)}`);
			console.log();
			console.log(chalk.dim("Run 'patchwork sync db' to rebuild and clear."));
		} else {
			console.log(chalk.green("No SQLite divergence detected. Stores are in sync."));
		}
	});

export const syncCommand = new Command("sync")
	.enablePositionalOptions()
	.description("Sync events from agent history files or rebuild database")
	.argument("[agent]", "Agent to sync: codex, db")
	.action((agent?: string) => {
		if (!agent) {
			console.log("Usage: patchwork sync <codex|db>");
			console.log("  codex      Sync from Codex CLI history");
			console.log("  db         Rebuild SQLite database from JSONL");
			console.log("  db-status  Check SQLite divergence status");
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
syncCommand.addCommand(syncDbStatus);
