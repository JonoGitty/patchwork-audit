import { Command } from "commander";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import chalk from "chalk";
import {
	verifyChain,
	computeSealPayload,
	signSeal,
	ensureSealKey,
	type SealRecord,
} from "@patchwork/core";
import { EVENTS_PATH, SEAL_KEY_PATH, SEALS_PATH } from "../store.js";

export const sealCommand = new Command("seal")
	.description("HMAC-seal the current chain tip to detect full-log rewrites")
	.option("--file <path>", "Path to events JSONL file")
	.option("--key-file <path>", "Path to seal key file")
	.option("--seal-file <path>", "Path to seals JSONL file")
	.option("--allow-invalid", "Do not fail on invalid/corrupt event lines")
	.option("--json", "Output result as JSON")
	.action((opts) => {
		const eventsPath = opts.file || EVENTS_PATH;
		const keyPath = opts.keyFile || SEAL_KEY_PATH;
		const sealPath = opts.sealFile || SEALS_PATH;

		if (!existsSync(eventsPath)) {
			if (opts.json) {
				console.log(JSON.stringify({ error: "No audit log found", path: eventsPath }));
			} else {
				console.log(chalk.yellow("No audit log found at:"), chalk.dim(eventsPath));
			}
			process.exitCode = 1;
			return;
		}

		// Parse events
		const content = readFileSync(eventsPath, "utf-8");
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

		// Verify chain to get tip info
		const chainResult = verifyChain(events);
		chainResult.invalid_schema_events += parseErrors;

		if (!opts.allowInvalid && chainResult.invalid_schema_events > 0) {
			if (opts.json) {
				console.log(JSON.stringify({
					error: "Invalid/corrupt events detected",
					invalid_schema_events: chainResult.invalid_schema_events,
				}));
			} else {
				console.log(chalk.red(`${chainResult.invalid_schema_events} invalid/corrupt event(s) detected.`));
				console.log(chalk.dim("Use --allow-invalid to seal anyway, or run 'patchwork verify' to inspect."));
			}
			process.exitCode = 1;
			return;
		}

		if (chainResult.chained_events === 0) {
			if (opts.json) {
				console.log(JSON.stringify({ error: "No chained events to seal" }));
			} else {
				console.log(chalk.yellow("No chained events found. Nothing to seal."));
			}
			process.exitCode = 1;
			return;
		}

		// Find the tip hash (last chained event's event_hash)
		let tipHash: string | null = null;
		for (let i = events.length - 1; i >= 0; i--) {
			const h = events[i].event_hash;
			if (typeof h === "string") {
				tipHash = h;
				break;
			}
		}

		if (!tipHash) {
			console.log(chalk.red("Could not determine chain tip hash."));
			process.exitCode = 1;
			return;
		}

		// Load or create seal key
		const key = ensureSealKey(keyPath);

		// Create seal record
		const sealedAt = new Date().toISOString();
		const payload = computeSealPayload(tipHash, chainResult.chained_events, sealedAt);
		const signature = signSeal(payload, key);

		const seal: SealRecord = {
			sealed_at: sealedAt,
			tip_hash: tipHash,
			chained_events: chainResult.chained_events,
			signature,
		};

		appendFileSync(sealPath, JSON.stringify(seal) + "\n", "utf-8");

		if (opts.json) {
			console.log(JSON.stringify(seal, null, 2));
		} else {
			console.log(chalk.bold("Seal created"));
			console.log();
			console.log(`  Sealed at:        ${sealedAt}`);
			console.log(`  Tip hash:         ${chalk.dim(tipHash)}`);
			console.log(`  Chained events:   ${chainResult.chained_events}`);
			console.log(`  Signature:        ${chalk.dim(signature.slice(0, 30))}...`);
			console.log();
			console.log(chalk.green("Seal appended to:"), chalk.dim(sealPath));
		}
	});
