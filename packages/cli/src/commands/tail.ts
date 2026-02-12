import { Command } from "commander";
import chalk from "chalk";
import { watch, existsSync, readFileSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { join, dirname } from "node:path";
import { formatEvent, formatEventCompact } from "../output/formatter.js";
import type { AuditEvent } from "@patchwork/core";

const EVENTS_PATH = join(process.env.HOME || "~", ".patchwork", "events.jsonl");

export const tailCommand = new Command("tail")
	.description("Live stream of audit events (like tail -f)")
	.option("--compact", "Compact one-line format")
	.option("--risk <level>", "Minimum risk level to show")
	.option("--agent <agent>", "Filter by agent")
	.option("--json", "Output raw JSON")
	.action((opts) => {
		const filePath = EVENTS_PATH;
		const dir = dirname(filePath);
		const riskOrder = ["none", "low", "medium", "high", "critical"];
		const minRiskIdx = opts.risk ? riskOrder.indexOf(opts.risk) : 0;

		console.log(chalk.bold("Patchwork tail") + chalk.dim(` — watching ${filePath}`));
		console.log(chalk.dim("Press Ctrl+C to stop.\n"));

		if (!existsSync(filePath)) {
			console.log(chalk.dim("Waiting for first event..."));
		}

		let lastSize = existsSync(filePath) ? statSync(filePath).size : 0;
		let buffer = "";

		function processNewData() {
			if (!existsSync(filePath)) return;

			const currentSize = statSync(filePath).size;
			if (currentSize <= lastSize) return;

			// Read only new bytes
			const fd = openSync(filePath, "r");
			const newBytes = Buffer.alloc(currentSize - lastSize);
			readSync(fd, newBytes, 0, newBytes.length, lastSize);
			closeSync(fd);
			lastSize = currentSize;

			buffer += newBytes.toString("utf-8");
			const lines = buffer.split("\n");
			// Keep incomplete last line in buffer
			buffer = lines.pop() || "";

			for (const line of lines) {
				if (line.trim().length === 0) continue;
				try {
					const event: AuditEvent = JSON.parse(line);

					// Apply filters
					if (opts.agent && event.agent !== opts.agent) continue;
					if (minRiskIdx > 0 && riskOrder.indexOf(event.risk.level) < minRiskIdx) continue;

					if (opts.json) {
						console.log(JSON.stringify(event));
					} else if (opts.compact) {
						console.log(formatEventCompact(event));
					} else {
						console.log(formatEvent(event));
					}
				} catch {
					// Skip malformed lines
				}
			}
		}

		// Poll-based watcher (more reliable than fs.watch for appended files)
		const interval = setInterval(processNewData, 250);

		// Also use fs.watch for instant notification when available
		if (existsSync(dir)) {
			try {
				watch(filePath, () => processNewData());
			} catch {
				// fs.watch not always available, polling is fallback
			}
		}

		// Keep process alive
		process.on("SIGINT", () => {
			clearInterval(interval);
			console.log(chalk.dim("\nStopped."));
			process.exit(0);
		});
	});
