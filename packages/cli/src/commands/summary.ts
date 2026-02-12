import { Command } from "commander";
import chalk from "chalk";
import { getReadStore } from "../store.js";

export const summaryCommand = new Command("summary")
	.description("Summarize AI agent activity")
	.option("--session <id>", "Summarize a specific session (or 'latest')")
	.option("--today", "Today's activity (default)")
	.option("--week", "This week's activity")
	.action((opts) => {
		const store = getReadStore();
		let events = store.readAll();

		if (opts.session) {
			if (opts.session === "latest") {
				const lastId = events[events.length - 1]?.session_id;
				events = events.filter((e) => e.session_id === lastId);
			} else {
				events = events.filter((e) => e.session_id === opts.session);
			}
		} else if (opts.week) {
			const weekAgo = new Date();
			weekAgo.setDate(weekAgo.getDate() - 7);
			events = events.filter((e) => new Date(e.timestamp) >= weekAgo);
		} else {
			// Default: today
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			events = events.filter((e) => new Date(e.timestamp) >= today);
		}

		if (events.length === 0) {
			console.log(chalk.dim("No activity to summarize."));
			return;
		}

		const sessions = new Set(events.map((e) => e.session_id));
		const agents = new Set(events.map((e) => e.agent));
		const projects = new Set(events.map((e) => e.project?.name).filter(Boolean));

		const fileReads = events.filter((e) => e.action === "file_read").length;
		const fileWrites = events.filter((e) => ["file_write", "file_edit", "file_create"].includes(e.action)).length;
		const fileDeletes = events.filter((e) => e.action === "file_delete").length;
		const commands = events.filter((e) => e.action === "command_execute").length;
		const webRequests = events.filter((e) => ["web_fetch", "web_search"].includes(e.action)).length;
		const highRisk = events.filter((e) => e.risk.level === "high" || e.risk.level === "critical");

		const period = opts.week ? "This Week" : opts.session ? `Session ${opts.session}` : "Today";

		console.log(chalk.bold(`\n  ${period}'s AI Activity\n`));
		console.log(`  Sessions:      ${sessions.size}`);
		console.log(`  Agents:        ${Array.from(agents).join(", ")}`);
		console.log(`  Projects:      ${Array.from(projects).join(", ") || "none"}`);
		console.log(`  Total events:  ${events.length}`);
		console.log();
		console.log(`  Files read:    ${fileReads}`);
		console.log(`  Files written: ${fileWrites}`);
		console.log(`  Files deleted: ${fileDeletes}`);
		console.log(`  Commands run:  ${commands}`);
		console.log(`  Web requests:  ${webRequests}`);

		if (highRisk.length > 0) {
			console.log(chalk.red(`\n  High-risk events: ${highRisk.length}`));
			for (const e of highRisk.slice(0, 5)) {
				const target = e.target?.path || e.target?.command || "";
				console.log(chalk.red(`    ${e.action} ${target} [${e.risk.flags.join(", ")}]`));
			}
			if (highRisk.length > 5) {
				console.log(chalk.red(`    ... and ${highRisk.length - 5} more`));
			}
		} else {
			console.log(chalk.green("\n  No high-risk events."));
		}

		console.log();
	});
