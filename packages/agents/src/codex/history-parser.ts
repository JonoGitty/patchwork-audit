import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	type Action,
	type AuditEvent,
	classifyRisk,
	generateEventId,
	generateSessionId,
	getHomeDir,
	hashContent,
	JsonlStore,
} from "@patchwork/core";

const HOME_DIR = getHomeDir();
const CODEX_HISTORY_PATH = join(HOME_DIR, ".codex", "history.jsonl");
const PATCHWORK_EVENTS_PATH = join(HOME_DIR, ".patchwork", "events.jsonl");

interface CodexHistoryEntry {
	timestamp?: string;
	session_id?: string;
	prompt?: string;
	response?: string;
	model?: string;
	tool_calls?: CodexToolCall[];
	[key: string]: unknown;
}

interface CodexToolCall {
	type?: string;
	name?: string;
	input?: Record<string, unknown>;
	output?: string;
	[key: string]: unknown;
}

/**
 * Parses Codex CLI's history.jsonl and converts entries to Patchwork events.
 * Deduplicates against already-ingested events by timestamp + content hash.
 */
export function syncCodexHistory(): { ingested: number; skipped: number; errors: number } {
	if (!existsSync(CODEX_HISTORY_PATH)) {
		return { ingested: 0, skipped: 0, errors: 0 };
	}

	const store = new JsonlStore(PATCHWORK_EVENTS_PATH);
	const existingEvents = store.readAll();
	const existingHashes = new Set(existingEvents.map((e) => `${e.timestamp}:${e.content?.hash || ""}`));

	const content = readFileSync(CODEX_HISTORY_PATH, "utf-8");
	const lines = content.split("\n").filter((l) => l.trim().length > 0);

	let ingested = 0;
	let skipped = 0;
	let errors = 0;

	for (const line of lines) {
		try {
			const entry = JSON.parse(line) as CodexHistoryEntry;
			const events = convertCodexEntry(entry);

			for (const event of events) {
				const dedupeKey = `${event.timestamp}:${event.content?.hash || ""}`;
				if (existingHashes.has(dedupeKey)) {
					skipped++;
					continue;
				}
				store.append(event);
				existingHashes.add(dedupeKey);
				ingested++;
			}
		} catch {
			errors++;
		}
	}

	return { ingested, skipped, errors };
}

function convertCodexEntry(entry: CodexHistoryEntry): AuditEvent[] {
	const events: AuditEvent[] = [];
	const sessionId = entry.session_id ? `codex_${entry.session_id}` : generateSessionId();
	const timestamp = entry.timestamp || new Date().toISOString();

	// Session-level event
	if (entry.prompt) {
		events.push({
			id: generateEventId(),
			session_id: sessionId,
			timestamp,
			agent: "codex",
			agent_version: entry.model,
			action: "prompt_submit",
			status: "completed",
			target: { type: "prompt" },
			risk: { level: "none", flags: [] },
			content: {
				hash: hashContent(entry.prompt),
				size_bytes: Buffer.byteLength(entry.prompt, "utf-8"),
				redacted: true,
			},
		});
	}

	// Tool call events
	if (entry.tool_calls) {
		for (const call of entry.tool_calls) {
			const mapped = mapCodexToolCall(call);
			if (mapped) {
				const risk = classifyRisk(mapped.action, mapped.target);
				events.push({
					id: generateEventId(),
					session_id: sessionId,
					timestamp,
					agent: "codex",
					agent_version: entry.model,
					action: mapped.action,
					status: "completed",
					target: mapped.target,
					risk,
					content: call.output
						? {
								hash: hashContent(call.output),
								size_bytes: Buffer.byteLength(call.output, "utf-8"),
								redacted: true,
							}
						: undefined,
					provenance: {
						hook_event: "history_sync",
						tool_name: call.name,
					},
				});
			}
		}
	}

	return events;
}

function mapCodexToolCall(call: CodexToolCall): { action: Action; target: AuditEvent["target"] } | null {
	const name = (call.name || call.type || "").toLowerCase();
	const input = call.input || {};

	if (name.includes("write") || name.includes("create_file")) {
		return {
			action: "file_write",
			target: { type: "file", path: (input.path || input.file_path) as string },
		};
	}
	if (name.includes("read") || name.includes("view_file")) {
		return {
			action: "file_read",
			target: { type: "file", path: (input.path || input.file_path) as string },
		};
	}
	if (name.includes("edit") || name.includes("patch")) {
		return {
			action: "file_edit",
			target: { type: "file", path: (input.path || input.file_path) as string },
		};
	}
	if (name.includes("shell") || name.includes("exec") || name.includes("bash")) {
		return {
			action: "command_execute",
			target: { type: "command", command: (input.command || input.cmd) as string },
		};
	}
	if (name.includes("search") || name.includes("web")) {
		return {
			action: "web_search",
			target: { type: "url", url: (input.query || input.url) as string },
		};
	}

	// Unknown tool — log as MCP
	return {
		action: "mcp_tool_call",
		target: { type: "mcp_tool", tool_name: name },
	};
}
