import type { Action, Target } from "@patchwork/core";

/**
 * Maps Claude Code tool names to Patchwork action types and targets.
 */

interface MappedAction {
	action: Action;
	target?: Partial<Target>;
	/**
	 * Set when the tool was invoked with the wrong input shape (e.g. `file_path`
	 * given as an object). Callers MUST treat this as a deterministic deny —
	 * silently dropping the field would let a non-string `file_path = {x:1}`
	 * skip path-based deny rules entirely, because the resulting target.path is
	 * undefined and matches no glob.
	 */
	malformed?: { reason: string };
}

/**
 * Coerce an arbitrary JSON value to a string, but only if it's already a
 * string. Otherwise return undefined. The mapper now flags `malformed` when a
 * required input is the wrong type so the PreToolUse handler fails closed,
 * rather than relying on policy rules accidentally rejecting the undefined.
 */
function asString(v: unknown): string | undefined {
	return typeof v === "string" ? v : undefined;
}

/** Build the standard "wrong type" message for a required field. */
function badShape(field: string, value: unknown): string {
	return `Claude Code tool input field '${field}' must be a string (got ${typeof value})`;
}

export function mapClaudeCodeTool(toolName: string, toolInput: Record<string, unknown>): MappedAction {
	switch (toolName) {
		case "Write": {
			const fp = asString(toolInput.file_path);
			return {
				action: "file_create",
				target: { type: "file", path: fp, abs_path: fp },
				...(fp === undefined ? { malformed: { reason: badShape("file_path", toolInput.file_path) } } : {}),
			};
		}

		case "Edit": {
			const fp = asString(toolInput.file_path);
			return {
				action: "file_edit",
				target: { type: "file", path: fp, abs_path: fp },
				...(fp === undefined ? { malformed: { reason: badShape("file_path", toolInput.file_path) } } : {}),
			};
		}

		case "Read": {
			const fp = asString(toolInput.file_path);
			return {
				action: "file_read",
				target: { type: "file", path: fp, abs_path: fp },
				...(fp === undefined ? { malformed: { reason: badShape("file_path", toolInput.file_path) } } : {}),
			};
		}

		case "Bash": {
			const cmd = asString(toolInput.command);
			return {
				action: "command_execute",
				target: { type: "command", command: cmd },
				...(cmd === undefined ? { malformed: { reason: badShape("command", toolInput.command) } } : {}),
			};
		}

		case "Glob": {
			const path = asString(toolInput.pattern) || asString(toolInput.path);
			return {
				action: "file_glob",
				target: { type: "file", path },
				...(path === undefined ? { malformed: { reason: badShape("pattern|path", toolInput.pattern ?? toolInput.path) } } : {}),
			};
		}

		case "Grep": {
			const path = asString(toolInput.path) || asString(toolInput.pattern);
			return {
				action: "file_grep",
				target: { type: "file", path },
				...(path === undefined ? { malformed: { reason: badShape("path|pattern", toolInput.path ?? toolInput.pattern) } } : {}),
			};
		}

		case "WebFetch": {
			const url = asString(toolInput.url);
			return {
				action: "web_fetch",
				target: { type: "url", url },
				...(url === undefined ? { malformed: { reason: badShape("url", toolInput.url) } } : {}),
			};
		}

		case "WebSearch": {
			const url = asString(toolInput.query);
			return {
				action: "web_search",
				target: { type: "url", url },
				...(url === undefined ? { malformed: { reason: badShape("query", toolInput.query) } } : {}),
			};
		}

		case "Task": {
			const tool = asString(toolInput.subagent_type);
			return {
				action: "task_delegate",
				target: { type: "prompt", tool_name: tool },
				...(tool === undefined ? { malformed: { reason: badShape("subagent_type", toolInput.subagent_type) } } : {}),
			};
		}

		case "NotebookEdit": {
			const np = asString(toolInput.notebook_path);
			return {
				action: "file_edit",
				target: { type: "file", path: np, abs_path: np },
				...(np === undefined ? { malformed: { reason: badShape("notebook_path", toolInput.notebook_path) } } : {}),
			};
		}

		default: {
			// MCP tools or unknown tools
			if (toolName.startsWith("mcp__")) {
				return {
					action: "mcp_tool_call",
					target: {
						type: "mcp_tool",
						tool_name: toolName,
					},
				};
			}
			return {
				action: "mcp_tool_call",
				target: {
					type: "mcp_tool",
					tool_name: toolName,
				},
			};
		}
	}
}
