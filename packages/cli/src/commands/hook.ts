import { Command } from "commander";
import { handleClaudeCodeHook } from "@patchwork/agents";
import type { ClaudeCodeHookInput } from "@patchwork/agents";

/**
 * Internal hook handlers. Called by AI agent hook systems.
 * Receives JSON on stdin, processes it, writes to audit trail.
 *
 * Not intended for direct user invocation.
 */
export const hookCommand = new Command("hook")
	.description("Internal: handle agent hook events")
	.argument("<event>", "Hook event type")
	.action(async (event: string) => {
		const input = await readStdin();
		if (!input) return;

		try {
			const parsed = JSON.parse(input) as ClaudeCodeHookInput;
			parsed.hook_event_name = mapEventArg(event);

			const output = handleClaudeCodeHook(parsed);

			// Write output for hooks that expect a response (PreToolUse)
			if (output) {
				process.stdout.write(JSON.stringify(output));
			}
		} catch {
			// Hooks must never crash the agent — fail silently
		}
	});

function readStdin(): Promise<string> {
	return new Promise((resolve) => {
		let data = "";
		process.stdin.setEncoding("utf-8");
		process.stdin.on("data", (chunk) => {
			data += chunk;
		});
		process.stdin.on("end", () => {
			resolve(data);
		});
		// Timeout: don't hang if no stdin
		setTimeout(() => resolve(data), 500);
	});
}

function mapEventArg(arg: string): string {
	const map: Record<string, string> = {
		"pre-tool": "PreToolUse",
		"post-tool": "PostToolUse",
		"post-tool-failure": "PostToolUseFailure",
		"session-start": "SessionStart",
		"session-end": "SessionEnd",
		"prompt-submit": "UserPromptSubmit",
		"subagent-start": "SubagentStart",
		"subagent-stop": "SubagentStop",
		"codex-turn": "CodexTurnComplete",
	};
	return map[arg] || arg;
}
