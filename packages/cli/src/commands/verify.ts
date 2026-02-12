import { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import chalk from "chalk";
import { verifyChain } from "@patchwork/core";
import { EVENTS_PATH } from "../store.js";

export const verifyCommand = new Command("verify")
	.description("Verify tamper-evident hash chain integrity of the audit log")
	.option("--json", "Output result as JSON")
	.option("--strict", "Exit with code 1 if any legacy (unchained) events exist")
	.option("--file <path>", "Path to JSONL file (default: ~/.patchwork/events.jsonl)")
	.action((opts) => {
		const filePath = opts.file || EVENTS_PATH;

		if (!existsSync(filePath)) {
			if (opts.json) {
				console.log(JSON.stringify({ error: "No audit log found", path: filePath }));
			} else {
				console.log(chalk.yellow("No audit log found at:"), chalk.dim(filePath));
			}
			process.exitCode = 1;
			return;
		}

		const content = readFileSync(filePath, "utf-8");
		const lines = content.split("\n").filter((l) => l.trim().length > 0);
		const events: Record<string, unknown>[] = [];
		let parseErrors = 0;

		for (const line of lines) {
			try {
				events.push(JSON.parse(line));
			} catch {
				parseErrors++;
			}
		}

		const result = verifyChain(events);
		result.invalid_schema_events += parseErrors;

		if (opts.json) {
			console.log(JSON.stringify(result, null, 2));
		} else {
			const status = result.is_valid
				? chalk.green("PASS")
				: chalk.red("FAIL");

			console.log(chalk.bold("Hash Chain Verification"), status);
			console.log();
			console.log(`  Total events:       ${result.total_events}`);
			console.log(`  Chained events:     ${result.chained_events}`);
			console.log(`  Legacy events:      ${result.legacy_events}`);
			console.log(`  Invalid/corrupt:    ${result.invalid_schema_events}`);
			console.log();

			if (result.hash_mismatch_count > 0) {
				console.log(chalk.red(`  Hash mismatches:    ${result.hash_mismatch_count}`));
			}
			if (result.prev_link_mismatch_count > 0) {
				console.log(chalk.red(`  Link mismatches:    ${result.prev_link_mismatch_count}`));
			}
			if (result.first_failure_index !== null) {
				console.log(chalk.red(`  First failure at:   event index ${result.first_failure_index}`));
			}

			if (result.is_valid && result.chained_events > 0) {
				console.log(chalk.green(`  Chain intact across ${result.chained_events} event(s).`));
			}
		}

		if (!result.is_valid) {
			process.exitCode = 1;
		}

		if (opts.strict && result.legacy_events > 0) {
			if (!opts.json) {
				console.log(chalk.yellow(`\n  --strict: ${result.legacy_events} legacy event(s) without chain hashes.`));
			}
			process.exitCode = 1;
		}
	});
