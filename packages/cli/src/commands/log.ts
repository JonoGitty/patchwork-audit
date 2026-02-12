import { Command } from "commander";
import chalk from "chalk";
import { JsonlStore, type AuditEvent } from "@patchwork/core";
import { formatEvent, formatEventCompact } from "../output/formatter.js";
import { join } from "node:path";

const EVENTS_PATH = join(process.env.HOME || "~", ".patchwork", "events.jsonl");

export const logCommand = new Command("log")
	.description("View recent audit events")
	.option("-n, --limit <n>", "Number of events to show", "25")
	.option("--agent <agent>", "Filter by agent (claude-code, codex, cursor)")
	.option("--action <action>", "Filter by action type (file_write, command_execute, etc.)")
	.option("--risk <level>", "Minimum risk level (none, low, medium, high, critical)")
	.option("--session <id>", "Filter by session ID (or 'latest')")
	.option("--project <name>", "Filter by project name")
	.option("--target <glob>", "Filter by target path")
	.option("--since <time>", "Show events since (e.g., '2 hours ago', '2026-02-12')")
	.option("--json", "Output as JSON")
	.option("--compact", "Compact one-line format")
	.action((opts) => {
		const store = new JsonlStore(EVENTS_PATH);

		let events = store.query({
			agent: opts.agent,
			action: opts.action,
			minRisk: opts.risk,
			sessionId: opts.session === "latest" ? undefined : opts.session,
			projectName: opts.project,
			targetGlob: opts.target,
			since: opts.since ? parseRelativeTime(opts.since) : undefined,
			limit: parseInt(opts.limit, 10),
		});

		// Handle "latest" session
		if (opts.session === "latest" && events.length > 0) {
			const allEvents = store.readAll();
			const lastSessionId = allEvents[allEvents.length - 1]?.session_id;
			if (lastSessionId) {
				events = allEvents.filter((e) => e.session_id === lastSessionId);
			}
		}

		if (events.length === 0) {
			console.log(chalk.dim("No events found."));
			return;
		}

		if (opts.json) {
			console.log(JSON.stringify(events, null, 2));
			return;
		}

		for (const event of events) {
			if (opts.compact) {
				console.log(formatEventCompact(event));
			} else {
				console.log(formatEvent(event));
			}
		}

		console.log(chalk.dim(`\n${events.length} events`));
	});

function parseRelativeTime(input: string): Date {
	const now = new Date();

	// Try ISO date
	const iso = new Date(input);
	if (!isNaN(iso.getTime())) return iso;

	// Relative: "N hours/minutes/days ago"
	const match = input.match(/(\d+)\s*(hour|minute|min|day|week)s?\s*ago/i);
	if (match) {
		const amount = parseInt(match[1], 10);
		const unit = match[2].toLowerCase();
		switch (unit) {
			case "minute":
			case "min":
				now.setMinutes(now.getMinutes() - amount);
				break;
			case "hour":
				now.setHours(now.getHours() - amount);
				break;
			case "day":
				now.setDate(now.getDate() - amount);
				break;
			case "week":
				now.setDate(now.getDate() - amount * 7);
				break;
		}
		return now;
	}

	// Fallback: try as date string
	return new Date(input);
}
