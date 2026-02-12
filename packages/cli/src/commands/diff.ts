import { Command } from "commander";
import chalk from "chalk";
import type { AuditEvent } from "@patchwork/core";
import { getReadStore } from "../store.js";

export interface FileChange {
	path: string;
	changeType: "CREATED" | "MODIFIED" | "DELETED";
	events: Array<{
		timestamp: string;
		action: string;
		hash?: string;
		size?: number;
	}>;
}

export function computeFileDiff(events: AuditEvent[]): FileChange[] {
	const fileActions = ["file_write", "file_edit", "file_create", "file_delete", "file_read"];
	const fileEvents = events.filter(
		(e) => fileActions.includes(e.action) && e.target?.path,
	);

	const byFile = new Map<string, AuditEvent[]>();
	for (const e of fileEvents) {
		const path = e.target!.path!;
		const list = byFile.get(path) || [];
		list.push(e);
		byFile.set(path, list);
	}

	const changes: FileChange[] = [];
	for (const [path, evts] of byFile) {
		const modifyingEvents = evts.filter((e) =>
			["file_write", "file_edit", "file_create", "file_delete"].includes(e.action),
		);

		if (modifyingEvents.length === 0) continue;

		let changeType: FileChange["changeType"] = "MODIFIED";
		const lastModify = modifyingEvents[modifyingEvents.length - 1];
		if (lastModify.action === "file_delete") {
			changeType = "DELETED";
		} else if (modifyingEvents[0].action === "file_create") {
			changeType = "CREATED";
		}

		changes.push({
			path,
			changeType,
			events: modifyingEvents.map((e) => ({
				timestamp: e.timestamp,
				action: e.action,
				hash: e.content?.hash,
				size: e.content?.size_bytes,
			})),
		});
	}

	return changes.sort((a, b) => a.path.localeCompare(b.path));
}

export const diffCommand = new Command("diff")
	.description("Show file changes in a session")
	.argument("<session-id>", "Session ID to analyze")
	.option("--json", "Output as JSON")
	.action((sessionId: string, opts) => {
		const store = getReadStore();
		const events = store.query({ sessionId });

		if (events.length === 0) {
			console.log(chalk.red(`Session not found: ${sessionId}`));
			return;
		}

		const changes = computeFileDiff(events);

		if (changes.length === 0) {
			console.log(chalk.dim("No file modifications in this session."));
			return;
		}

		if (opts.json) {
			console.log(JSON.stringify(changes, null, 2));
			return;
		}

		console.log(chalk.bold(`\n File Changes — ${sessionId}\n`));

		for (const change of changes) {
			const badge =
				change.changeType === "CREATED"
					? chalk.green("CREATED")
					: change.changeType === "DELETED"
						? chalk.red("DELETED")
						: chalk.yellow("MODIFIED");

			console.log(`  ${badge}  ${change.path}`);

			for (const evt of change.events) {
				const time = new Date(evt.timestamp).toLocaleTimeString();
				const hash = evt.hash ? chalk.dim(` ${evt.hash.slice(0, 16)}...`) : "";
				const size = evt.size ? chalk.dim(` ${evt.size}B`) : "";
				console.log(chalk.dim(`    ${time}  ${evt.action}${hash}${size}`));
			}
			console.log();
		}

		const created = changes.filter((c) => c.changeType === "CREATED").length;
		const modified = changes.filter((c) => c.changeType === "MODIFIED").length;
		const deleted = changes.filter((c) => c.changeType === "DELETED").length;

		console.log(
			chalk.dim(
				`  ${changes.length} files: ${created} created, ${modified} modified, ${deleted} deleted`,
			),
		);
		console.log();
	});
