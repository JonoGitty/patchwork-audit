import type { Action, Target } from "@patchwork/core";

/**
 * Maps Claude Code tool names to Patchwork action types and targets.
 */

interface MappedAction {
	action: string;
	target?: Partial<Target>;
}

export function mapClaudeCodeTool(toolName: string, toolInput: Record<string, unknown>): MappedAction {
	switch (toolName) {
		case "Write":
			return {
				action: "file_create",
				target: {
					type: "file",
					path: toolInput.file_path as string,
					abs_path: toolInput.file_path as string,
				},
			};

		case "Edit":
			return {
				action: "file_edit",
				target: {
					type: "file",
					path: toolInput.file_path as string,
					abs_path: toolInput.file_path as string,
				},
			};

		case "Read":
			return {
				action: "file_read",
				target: {
					type: "file",
					path: toolInput.file_path as string,
					abs_path: toolInput.file_path as string,
				},
			};

		case "Bash":
			return {
				action: "command_execute",
				target: {
					type: "command",
					command: toolInput.command as string,
				},
			};

		case "Glob":
			return {
				action: "file_glob",
				target: {
					type: "file",
					path: (toolInput.pattern as string) || (toolInput.path as string),
				},
			};

		case "Grep":
			return {
				action: "file_grep",
				target: {
					type: "file",
					path: (toolInput.path as string) || (toolInput.pattern as string),
				},
			};

		case "WebFetch":
			return {
				action: "web_fetch",
				target: {
					type: "url",
					url: toolInput.url as string,
				},
			};

		case "WebSearch":
			return {
				action: "web_search",
				target: {
					type: "url",
					url: toolInput.query as string,
				},
			};

		case "Task":
			return {
				action: "task_delegate",
				target: {
					type: "prompt",
					tool_name: toolInput.subagent_type as string,
				},
			};

		case "NotebookEdit":
			return {
				action: "file_edit",
				target: {
					type: "file",
					path: toolInput.notebook_path as string,
					abs_path: toolInput.notebook_path as string,
				},
			};

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
