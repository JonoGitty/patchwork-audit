import chalk from "chalk";
import type { AuditEvent } from "@patchwork/core";
import { riskColor, riskIcon } from "./colors.js";

export function formatEvent(event: AuditEvent): string {
	const time = new Date(event.timestamp).toLocaleTimeString();
	const action = event.action.padEnd(18);
	const agent = chalk.dim(event.agent.padEnd(12));
	const target = formatTarget(event);
	const risk = riskIcon(event.risk.level);

	return `  ${chalk.dim(time)}  ${agent}  ${action}  ${target.padEnd(50)}  ${risk}`;
}

export function formatEventCompact(event: AuditEvent): string {
	const time = new Date(event.timestamp).toLocaleTimeString();
	const target = formatTarget(event).slice(0, 40);
	return `${time} ${event.action} ${target}`;
}

function formatTarget(event: AuditEvent): string {
	if (!event.target) return "";

	if (event.target.path) return event.target.path;
	if (event.target.command) return chalk.yellow(event.target.command.slice(0, 60));
	if (event.target.url) return chalk.blue(event.target.url.slice(0, 60));
	if (event.target.tool_name) return chalk.magenta(event.target.tool_name);

	return "";
}
