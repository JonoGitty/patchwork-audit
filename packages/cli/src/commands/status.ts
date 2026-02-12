import { Command } from "commander";
import chalk from "chalk";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { JsonlStore } from "@patchwork/core";
import { detectInstalledAgents } from "@patchwork/agents";

const DATA_DIR = join(process.env.HOME || "~", ".patchwork");
const EVENTS_PATH = join(DATA_DIR, "events.jsonl");

export const statusCommand = new Command("status")
	.description("Show Patchwork configuration and stats")
	.action(() => {
		console.log(chalk.bold("Patchwork Status\n"));

		// Data directory
		const dataExists = existsSync(DATA_DIR);
		console.log(`  Data:    ${dataExists ? chalk.green(DATA_DIR) : chalk.yellow("Not initialized — run 'patchwork init'")}`);

		// Agents
		const agents = detectInstalledAgents();
		console.log(chalk.bold("\n  Agents:"));
		for (const agent of agents) {
			const status = agent.installed ? chalk.green("installed") : chalk.dim("not found");
			const version = agent.version ? chalk.dim(` v${agent.version}`) : "";
			console.log(`    ${agent.name.padEnd(12)} ${status}${version}`);
		}

		// Event stats
		if (existsSync(EVENTS_PATH)) {
			const store = new JsonlStore(EVENTS_PATH);
			const events = store.readAll();
			const sessions = new Set(events.map((e) => e.session_id));
			const lastEvent = events[events.length - 1];

			console.log(chalk.bold("\n  Audit Trail:"));
			console.log(`    Events:   ${events.length}`);
			console.log(`    Sessions: ${sessions.size}`);
			if (lastEvent) {
				const ago = timeAgo(new Date(lastEvent.timestamp));
				console.log(`    Latest:   ${ago}`);
			}

			// Risk breakdown
			const riskCounts: Record<string, number> = {};
			for (const e of events) {
				riskCounts[e.risk.level] = (riskCounts[e.risk.level] || 0) + 1;
			}
			if (Object.keys(riskCounts).length > 0) {
				console.log(chalk.bold("\n  Risk Breakdown:"));
				for (const level of ["critical", "high", "medium", "low", "none"]) {
					const count = riskCounts[level] || 0;
					if (count > 0) {
						const color = level === "critical" || level === "high" ? chalk.red : level === "medium" ? chalk.yellow : chalk.dim;
						console.log(`    ${level.padEnd(10)} ${color(String(count))}`);
					}
				}
			}
		} else {
			console.log(chalk.dim("\n  No events recorded yet."));
		}

		console.log();
	});

function timeAgo(date: Date): string {
	const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
	if (seconds < 60) return "just now";
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
	if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
	return `${Math.floor(seconds / 86400)}d ago`;
}
