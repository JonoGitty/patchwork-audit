import { Command } from "commander";
import chalk from "chalk";
import { join } from "node:path";
import { JsonlStore } from "@patchwork/core";
import { formatEvent } from "../output/formatter.js";
import { riskColor } from "../output/colors.js";

const EVENTS_PATH = join(process.env.HOME || "~", ".patchwork", "events.jsonl");

export const showCommand = new Command("show")
	.description("Show full detail for an event or session")
	.argument("<id>", "Event ID (evt_...) or session ID (ses_...)")
	.action((id: string) => {
		const store = new JsonlStore(EVENTS_PATH);
		const events = store.readAll();

		// Event by ID
		if (id.startsWith("evt_")) {
			const event = events.find((e) => e.id === id);
			if (!event) {
				console.log(chalk.red(`Event not found: ${id}`));
				return;
			}
			console.log(JSON.stringify(event, null, 2));
			return;
		}

		// Session by ID
		const sessionEvents = events.filter((e) => e.session_id === id);
		if (sessionEvents.length === 0) {
			console.log(chalk.red(`Session not found: ${id}`));
			return;
		}

		const first = sessionEvents[0];
		const last = sessionEvents[sessionEvents.length - 1];
		const durationMs = new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime();

		console.log(chalk.bold(`\n SESSION ${id}`));
		console.log(
			` ${first.agent} ${first.agent_version ? `v${first.agent_version}` : ""} | ${first.project?.name || "unknown"}`,
		);
		console.log(
			` Started ${new Date(first.timestamp).toLocaleString()} | Duration ${formatDuration(durationMs)} | ${sessionEvents.length} events\n`,
		);

		for (const event of sessionEvents) {
			const time = new Date(event.timestamp).toLocaleTimeString();
			const action = event.action.padEnd(18);
			const target = event.target?.path || event.target?.command || event.target?.url || "";
			const risk = riskDot(event.risk.level);

			console.log(` ${chalk.dim(time)}  ${action} ${target.slice(0, 60).padEnd(60)} ${risk}`);
		}

		// Summary
		const writes = sessionEvents.filter((e) =>
			["file_write", "file_edit", "file_create"].includes(e.action),
		).length;
		const reads = sessionEvents.filter((e) => e.action === "file_read").length;
		const commands = sessionEvents.filter((e) => e.action === "command_execute").length;
		const highRisk = sessionEvents.filter(
			(e) => e.risk.level === "high" || e.risk.level === "critical",
		);

		console.log(
			chalk.dim(`\n Summary: ${reads} files read, ${writes} files written, ${commands} commands run`),
		);

		if (highRisk.length > 0) {
			console.log(chalk.red(` Risk: ${highRisk.length} high-risk event(s)`));
			for (const e of highRisk) {
				const target = e.target?.path || e.target?.command || "";
				console.log(chalk.red(`   ${e.action} ${target} (${e.risk.flags.join(", ")})`));
			}
		}
		console.log();
	});

function riskDot(level: string): string {
	switch (level) {
		case "none":
			return chalk.dim("\u25CB");
		case "low":
			return chalk.dim("\u25D0");
		case "medium":
			return chalk.yellow("\u25D1");
		case "high":
			return chalk.red("\u25C9");
		case "critical":
			return chalk.red("\u25C9 CRITICAL");
		default:
			return chalk.dim("\u25CB");
	}
}

function formatDuration(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const secs = seconds % 60;
	if (minutes < 60) return `${minutes}m ${secs}s`;
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return `${hours}h ${mins}m`;
}
