import { Command } from "commander";
import chalk from "chalk";
import type { AuditEvent } from "@patchwork/core";
import { getReadStore } from "../store.js";

export interface StatsResult {
	totalEvents: number;
	byAction: Record<string, number>;
	byAgent: Record<string, number>;
	byRisk: Record<string, number>;
	byDay: Record<string, number>;
	topFiles: Array<[string, number]>;
	topCommands: Array<[string, number]>;
}

export function computeStats(events: AuditEvent[]): StatsResult {
	const byAction: Record<string, number> = {};
	const byAgent: Record<string, number> = {};
	const byRisk: Record<string, number> = {};
	const byDay: Record<string, number> = {};
	const fileCounts: Record<string, number> = {};
	const commandCounts: Record<string, number> = {};

	for (const e of events) {
		byAction[e.action] = (byAction[e.action] || 0) + 1;
		byAgent[e.agent] = (byAgent[e.agent] || 0) + 1;
		byRisk[e.risk.level] = (byRisk[e.risk.level] || 0) + 1;

		const day = e.timestamp.slice(0, 10);
		byDay[day] = (byDay[day] || 0) + 1;

		if (e.target?.path && ["file_write", "file_edit", "file_create"].includes(e.action)) {
			fileCounts[e.target.path] = (fileCounts[e.target.path] || 0) + 1;
		}

		if (e.target?.command && e.action === "command_execute") {
			const cmd = e.target.command.slice(0, 80);
			commandCounts[cmd] = (commandCounts[cmd] || 0) + 1;
		}
	}

	const topFiles = Object.entries(fileCounts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10);

	const topCommands = Object.entries(commandCounts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10);

	return {
		totalEvents: events.length,
		byAction,
		byAgent,
		byRisk,
		byDay,
		topFiles,
		topCommands,
	};
}

function bar(count: number, max: number, width = 30): string {
	const filled = max > 0 ? Math.round((count / max) * width) : 0;
	return chalk.green("\u2588".repeat(filled)) + chalk.dim("\u2591".repeat(width - filled));
}

export const statsCommand = new Command("stats")
	.description("Aggregate statistics across audit events")
	.option("--since <time>", "Events since (ISO date or relative)")
	.option("--session <id>", "Filter by session ID")
	.option("--json", "Output as JSON")
	.action((opts) => {
		const store = getReadStore();
		let events: AuditEvent[];

		if (opts.session) {
			events = store.query({ sessionId: opts.session });
		} else if (opts.since) {
			events = store.query({ since: new Date(opts.since) });
		} else {
			events = store.readAll();
		}

		if (events.length === 0) {
			console.log(chalk.dim("No events to analyze."));
			return;
		}

		const stats = computeStats(events);

		if (opts.json) {
			console.log(JSON.stringify(stats, null, 2));
			return;
		}

		console.log(chalk.bold(`\n  Patchwork Stats — ${stats.totalEvents} events\n`));

		// By action
		console.log(chalk.bold("  Actions"));
		const maxAction = Math.max(...Object.values(stats.byAction));
		for (const [action, count] of Object.entries(stats.byAction).sort((a, b) => b[1] - a[1])) {
			console.log(`    ${action.padEnd(20)} ${bar(count, maxAction)} ${count}`);
		}

		// By agent
		console.log(chalk.bold("\n  Agents"));
		const maxAgent = Math.max(...Object.values(stats.byAgent));
		for (const [agent, count] of Object.entries(stats.byAgent).sort((a, b) => b[1] - a[1])) {
			console.log(`    ${agent.padEnd(20)} ${bar(count, maxAgent)} ${count}`);
		}

		// By risk
		console.log(chalk.bold("\n  Risk Levels"));
		const riskOrder = ["critical", "high", "medium", "low", "none"];
		const maxRisk = Math.max(...Object.values(stats.byRisk));
		for (const level of riskOrder) {
			const count = stats.byRisk[level] || 0;
			if (count > 0) {
				const color = level === "critical" || level === "high" ? chalk.red : level === "medium" ? chalk.yellow : chalk.dim;
				console.log(`    ${color(level.padEnd(20))} ${bar(count, maxRisk)} ${count}`);
			}
		}

		// Activity by day
		const days = Object.entries(stats.byDay).sort((a, b) => a[0].localeCompare(b[0]));
		if (days.length > 1) {
			console.log(chalk.bold("\n  Activity by Day"));
			const maxDay = Math.max(...days.map(([, c]) => c));
			for (const [day, count] of days.slice(-14)) {
				console.log(`    ${day}  ${bar(count, maxDay, 20)} ${count}`);
			}
		}

		// Top files
		if (stats.topFiles.length > 0) {
			console.log(chalk.bold("\n  Top Files Modified"));
			for (const [path, count] of stats.topFiles) {
				console.log(`    ${String(count).padStart(4)}  ${path}`);
			}
		}

		// Top commands
		if (stats.topCommands.length > 0) {
			console.log(chalk.bold("\n  Top Commands"));
			for (const [cmd, count] of stats.topCommands) {
				console.log(`    ${String(count).padStart(4)}  ${chalk.yellow(cmd)}`);
			}
		}

		console.log();
	});
