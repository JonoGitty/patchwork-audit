import { Command } from "commander";
import chalk from "chalk";
import { join } from "node:path";
import { JsonlStore, type AuditEvent } from "@patchwork/core";

const EVENTS_PATH = join(process.env.HOME || "~", ".patchwork", "events.jsonl");

export const sessionsCommand = new Command("sessions")
	.description("List recent AI agent sessions")
	.option("-n, --limit <n>", "Number of sessions to show", "10")
	.option("--agent <agent>", "Filter by agent")
	.action((opts) => {
		const store = new JsonlStore(EVENTS_PATH);
		const events = store.readAll();

		// Group by session
		const sessions = new Map<string, AuditEvent[]>();
		for (const e of events) {
			const list = sessions.get(e.session_id) || [];
			list.push(e);
			sessions.set(e.session_id, list);
		}

		let sessionList = Array.from(sessions.entries())
			.map(([id, evts]) => ({
				id,
				events: evts,
				agent: evts[0]?.agent || "unknown",
				project: evts[0]?.project?.name || "unknown",
				started: evts[0]?.timestamp,
				ended: evts[evts.length - 1]?.timestamp,
				count: evts.length,
				writes: evts.filter((e) => ["file_write", "file_edit", "file_create"].includes(e.action)).length,
				commands: evts.filter((e) => e.action === "command_execute").length,
				highRisk: evts.filter((e) => e.risk.level === "high" || e.risk.level === "critical").length,
			}))
			.sort((a, b) => (a.started || "").localeCompare(b.started || ""))
			.slice(-parseInt(opts.limit, 10));

		if (opts.agent) {
			sessionList = sessionList.filter((s) => s.agent === opts.agent);
		}

		if (sessionList.length === 0) {
			console.log(chalk.dim("No sessions found."));
			return;
		}

		console.log(chalk.bold("Recent Sessions\n"));

		for (const s of sessionList) {
			const duration = s.started && s.ended
				? formatDuration(new Date(s.ended).getTime() - new Date(s.started).getTime())
				: "?";
			const time = s.started ? new Date(s.started).toLocaleString() : "?";
			const riskBadge = s.highRisk > 0 ? chalk.red(` ${s.highRisk} high-risk`) : "";

			console.log(
				`  ${chalk.cyan(s.id.slice(0, 16))}  ${chalk.dim(s.agent.padEnd(12))}  ${s.project.padEnd(20)}  ${time}  ${chalk.dim(duration)}`,
			);
			console.log(
				`  ${chalk.dim("  ")}${s.count} events  ${s.writes} writes  ${s.commands} commands${riskBadge}`,
			);
			console.log();
		}
	});

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
