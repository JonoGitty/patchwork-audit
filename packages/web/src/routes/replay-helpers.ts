import type { AuditEvent } from "@patchwork/core";

export interface FileChange {
	path: string;
	changeType: "CREATED" | "MODIFIED" | "DELETED";
	events: Array<{ timestamp: string; action: string; hash?: string; size?: number }>;
}

export function computeFileDiff(events: AuditEvent[]): FileChange[] {
	const fileActions = ["file_write", "file_edit", "file_create", "file_delete"];
	const fileEvents = events.filter(e => fileActions.includes(e.action) && e.target?.path);

	const byFile = new Map<string, AuditEvent[]>();
	for (const e of fileEvents) {
		const path = e.target!.path!;
		const list = byFile.get(path) || [];
		list.push(e);
		byFile.set(path, list);
	}

	const changes: FileChange[] = [];
	for (const [path, evts] of byFile) {
		let changeType: FileChange["changeType"] = "MODIFIED";
		const last = evts[evts.length - 1];
		if (last.action === "file_delete") changeType = "DELETED";
		else if (evts[0].action === "file_create") changeType = "CREATED";

		changes.push({
			path,
			changeType,
			events: evts.map(e => ({
				timestamp: e.timestamp,
				action: e.action,
				hash: e.content?.hash,
				size: e.content?.size_bytes,
			})),
		});
	}

	return changes.sort((a, b) => a.path.localeCompare(b.path));
}
