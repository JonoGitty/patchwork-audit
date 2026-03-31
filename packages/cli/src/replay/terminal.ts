import chalk from "chalk";
import { createInterface } from "node:readline";
import type { AuditEvent } from "@patchwork/core";
import { riskIcon } from "../output/colors.js";
import { computeFileDiff } from "../commands/diff.js";
import type { GitDiffResult } from "./git.js";

export interface TerminalReplayOptions {
	all?: boolean;
	speed?: number;
	riskFilter?: string;
	filesOnly?: boolean;
}

const ACTION_ICONS: Record<string, string> = {
	session_start: "\u25B6",
	session_end: "\u25A0",
	file_read: "\u{1F4C4}",
	file_write: "\u{1F4DD}",
	file_edit: "\u270F\uFE0F",
	file_create: "\u2795",
	file_delete: "\u{1F5D1}",
	file_glob: "\u{1F50D}",
	file_grep: "\u{1F50D}",
	command_execute: "\u{1F4BB}",
	web_fetch: "\u{1F310}",
	web_search: "\u{1F310}",
	mcp_tool_call: "\u{1F527}",
	prompt_submit: "\u{1F4AC}",
	subagent_start: "\u{1F916}",
	subagent_stop: "\u{1F916}",
};

function getIcon(action: string): string {
	return ACTION_ICONS[action] || "\u25CB";
}

function formatRelativeTime(ms: number): string {
	const s = Math.floor(ms / 1000);
	if (s < 60) return `+${s}s`.padEnd(8);
	const m = Math.floor(s / 60);
	if (m < 60) return `+${m}m${s % 60}s`.padEnd(8);
	return `+${Math.floor(m / 60)}h${m % 60}m`.padEnd(8);
}

function formatDuration(ms: number): string {
	const s = Math.floor(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ${s % 60}s`;
	return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function getTarget(e: AuditEvent): string {
	if (e.target?.path) return e.target.path;
	if (e.target?.command) return e.target.command.slice(0, 80);
	if (e.target?.url) return e.target.url.slice(0, 80);
	if (e.target?.tool_name) return e.target.tool_name;
	return "";
}

function renderEvent(
	event: AuditEvent,
	startTime: number,
	gitDiffs: Map<string, GitDiffResult>,
): string {
	const relMs = new Date(event.timestamp).getTime() - startTime;
	const relTime = formatRelativeTime(relMs);
	const icon = getIcon(event.action);
	const target = getTarget(event);
	const risk = riskIcon(event.risk.level);
	const status = event.status === "denied" ? chalk.red(" DENIED") : "";

	const lines: string[] = [];

	// Main event line
	const actionStr = event.action.replace(/_/g, " ").toUpperCase().padEnd(16);
	lines.push(` ${chalk.dim(relTime)} ${icon}  ${chalk.bold(actionStr)} ${target.padEnd(50)} ${risk}${status}`);

	// Detail lines
	const details: string[] = [];

	if (event.content?.size_bytes) {
		details.push(`${event.content.size_bytes} bytes`);
	}
	if (event.content?.hash) {
		details.push(chalk.dim(event.content.hash.slice(0, 20) + "..."));
	}
	if (event.status === "denied" && event.risk.policy_match) {
		details.push(chalk.red(`Policy: "${event.risk.policy_match}"`));
	}
	if (event.risk.flags && event.risk.flags.length > 0) {
		details.push(chalk.dim(`Flags: ${event.risk.flags.join(", ")}`));
	}

	if (details.length > 0) {
		lines.push(`          ${chalk.dim("\u2514\u2500")} ${details.join(chalk.dim(" | "))}`);
	}

	// Git diff for file modifications
	if (event.target?.path && ["file_write", "file_edit", "file_create"].includes(event.action)) {
		const gitDiff = gitDiffs.get(event.target.path);
		if (gitDiff?.found && gitDiff.diff) {
			lines.push(`          ${chalk.dim("\u2514\u2500 git diff:")}`);
			const diffLines = gitDiff.diff.split("\n").slice(0, 20);
			for (const dl of diffLines) {
				if (dl.startsWith("+") && !dl.startsWith("+++")) {
					lines.push(`             ${chalk.green(dl)}`);
				} else if (dl.startsWith("-") && !dl.startsWith("---")) {
					lines.push(`             ${chalk.red(dl)}`);
				} else if (dl.startsWith("@@")) {
					lines.push(`             ${chalk.cyan(dl)}`);
				} else {
					lines.push(`             ${chalk.dim(dl)}`);
				}
			}
			if (gitDiff.diff.split("\n").length > 20) {
				lines.push(`             ${chalk.dim(`... ${gitDiff.diff.split("\n").length - 20} more lines`)}`);
			}
		}
	}

	return lines.join("\n");
}

function renderSummary(events: AuditEvent[], startTime: number): string {
	const endTime = events.length > 0 ? new Date(events[events.length - 1].timestamp).getTime() : startTime;
	const duration = formatDuration(endTime - startTime);
	const changes = computeFileDiff(events);
	const created = changes.filter(c => c.changeType === "CREATED").length;
	const modified = changes.filter(c => c.changeType === "MODIFIED").length;
	const deleted = changes.filter(c => c.changeType === "DELETED").length;
	const commands = events.filter(e => e.action === "command_execute").length;
	const denials = events.filter(e => e.status === "denied").length;

	const riskCounts: Record<string, number> = {};
	for (const e of events) {
		riskCounts[e.risk.level] = (riskCounts[e.risk.level] || 0) + 1;
	}

	const riskStr = ["critical", "high", "medium", "low", "none"]
		.filter(r => riskCounts[r])
		.map(r => `${riskCounts[r]} ${r}`)
		.join(", ");

	return `
${chalk.dim("\u2500".repeat(60))}
${chalk.bold(" Session Summary")}
 ${events.length} events | ${duration} | ${created} created | ${modified} modified | ${deleted} deleted | ${commands} commands${denials > 0 ? chalk.red(` | ${denials} denied`) : ""}
 ${chalk.dim("Risk:")} ${riskStr}
${chalk.dim("\u2500".repeat(60))}`;
}

/**
 * Render replay in non-interactive mode (--all).
 */
export function renderAllEvents(
	events: AuditEvent[],
	gitDiffs: Map<string, GitDiffResult>,
	sessionHeader: string,
): void {
	console.log(sessionHeader);
	console.log();

	const startTime = events.length > 0 ? new Date(events[0].timestamp).getTime() : Date.now();

	for (const event of events) {
		console.log(renderEvent(event, startTime, gitDiffs));
	}

	console.log(renderSummary(events, startTime));
}

/**
 * Render replay in interactive step-through mode.
 */
export async function renderInteractive(
	events: AuditEvent[],
	gitDiffs: Map<string, GitDiffResult>,
	sessionHeader: string,
	options: TerminalReplayOptions,
): Promise<void> {
	console.log(sessionHeader);
	console.log(chalk.dim("\n Press [Enter] to step, [a] for all remaining, [q] to quit\n"));

	const startTime = events.length > 0 ? new Date(events[0].timestamp).getTime() : Date.now();
	let index = 0;
	let showAll = false;

	const rl = createInterface({ input: process.stdin, output: process.stdout });

	const step = (): Promise<string> => new Promise(resolve => {
		if (showAll) {
			resolve("next");
			return;
		}
		if (options.speed) {
			setTimeout(() => resolve("next"), options.speed);
			return;
		}
		rl.question("", (answer) => {
			resolve(answer.trim().toLowerCase() || "next");
		});
	});

	while (index < events.length) {
		const event = events[index];
		console.log(renderEvent(event, startTime, gitDiffs));

		index++;
		if (index < events.length) {
			const input = await step();
			if (input === "q") break;
			if (input === "a") showAll = true;
		}
	}

	rl.close();
	console.log(renderSummary(events, startTime));
}

export function buildSessionHeader(events: AuditEvent[]): string {
	if (events.length === 0) return "";

	const first = events[0];
	const last = events[events.length - 1];
	const duration = formatDuration(new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime());
	const time = new Date(first.timestamp).toLocaleString();

	return `
${chalk.bold(` SESSION ${first.session_id}`)}
 ${first.agent}${first.agent_version ? ` v${first.agent_version}` : ""} | ${first.project?.name || "unknown"} | ${time} | ${duration} | ${events.length} events`;
}
