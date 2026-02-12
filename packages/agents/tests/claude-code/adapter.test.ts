import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleClaudeCodeHook } from "../../src/claude-code/adapter.js";
import type { ClaudeCodeHookInput } from "../../src/claude-code/types.js";

describe("handleClaudeCodeHook", () => {
	let originalHome: string | undefined;
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-adapter-test-"));
		originalHome = process.env.HOME;
		process.env.HOME = tmpDir;
	});

	afterEach(() => {
		process.env.HOME = originalHome;
		rmSync(tmpDir, { recursive: true, force: true });
	});

	function makeInput(overrides: Partial<ClaudeCodeHookInput> = {}): ClaudeCodeHookInput {
		return {
			session_id: "ses_test123",
			transcript_path: "/tmp/transcript.json",
			cwd: "/Users/test/my-project",
			hook_event_name: "PostToolUse",
			...overrides,
		};
	}

	it("handles SessionStart", () => {
		const result = handleClaudeCodeHook(makeInput({ hook_event_name: "SessionStart" }));
		expect(result).toBeNull();

		const eventsPath = join(tmpDir, ".patchwork", "events.jsonl");
		expect(existsSync(eventsPath)).toBe(true);
		const events = readFileSync(eventsPath, "utf-8").trim().split("\n").map(JSON.parse);
		expect(events).toHaveLength(1);
		expect(events[0].action).toBe("session_start");
		expect(events[0].agent).toBe("claude-code");
	});

	it("handles SessionEnd", () => {
		handleClaudeCodeHook(makeInput({ hook_event_name: "SessionEnd" }));
		const events = readEvents(tmpDir);
		expect(events[0].action).toBe("session_end");
	});

	it("handles PostToolUse for file Write", () => {
		handleClaudeCodeHook(
			makeInput({
				hook_event_name: "PostToolUse",
				tool_name: "Write",
				tool_input: { file_path: "/test/new-file.ts", content: "export const x = 1;" },
				tool_response: { output: "File written successfully" },
			}),
		);

		const events = readEvents(tmpDir);
		expect(events[0].action).toBe("file_create");
		expect(events[0].target.path).toBe("/test/new-file.ts");
		expect(events[0].provenance.tool_name).toBe("Write");
		expect(events[0].content.hash).toMatch(/^sha256:/);
	});

	it("handles PostToolUse for Bash command", () => {
		handleClaudeCodeHook(
			makeInput({
				hook_event_name: "PostToolUse",
				tool_name: "Bash",
				tool_input: { command: "npm test" },
				tool_response: { stdout: "Tests passed" },
			}),
		);

		const events = readEvents(tmpDir);
		expect(events[0].action).toBe("command_execute");
		expect(events[0].target.command).toBe("npm test");
	});

	it("handles PostToolUse for Read", () => {
		handleClaudeCodeHook(
			makeInput({
				hook_event_name: "PostToolUse",
				tool_name: "Read",
				tool_input: { file_path: "/test/file.ts" },
				tool_response: { content: "file contents here" },
			}),
		);

		const events = readEvents(tmpDir);
		expect(events[0].action).toBe("file_read");
		expect(events[0].risk.level).toBe("low");
	});

	it("handles PostToolUse for WebFetch", () => {
		handleClaudeCodeHook(
			makeInput({
				hook_event_name: "PostToolUse",
				tool_name: "WebFetch",
				tool_input: { url: "https://example.com/api" },
				tool_response: { content: "response body" },
			}),
		);

		const events = readEvents(tmpDir);
		expect(events[0].action).toBe("web_fetch");
		expect(events[0].risk.flags).toContain("network_access");
	});

	it("handles PreToolUse by returning allow", () => {
		const result = handleClaudeCodeHook(makeInput({ hook_event_name: "PreToolUse" }));
		expect(result).toEqual({ allow: true });
	});

	it("handles PostToolUseFailure with failed status", () => {
		handleClaudeCodeHook(
			makeInput({
				hook_event_name: "PostToolUseFailure",
				tool_name: "Bash",
				tool_input: { command: "npm test" },
			}),
		);

		const events = readEvents(tmpDir);
		expect(events[0].status).toBe("failed");
	});

	it("handles UserPromptSubmit", () => {
		handleClaudeCodeHook(
			makeInput({
				hook_event_name: "UserPromptSubmit",
				prompt: "Fix the login bug",
			}),
		);

		const events = readEvents(tmpDir);
		expect(events[0].action).toBe("prompt_submit");
		expect(events[0].content.hash).toMatch(/^sha256:/);
		expect(events[0].content.redacted).toBe(true);
	});

	it("handles SubagentStart", () => {
		handleClaudeCodeHook(
			makeInput({
				hook_event_name: "SubagentStart",
				subagent_type: "Explore",
			}),
		);

		const events = readEvents(tmpDir);
		expect(events[0].action).toBe("subagent_start");
	});

	it("classifies sensitive file writes as critical risk", () => {
		handleClaudeCodeHook(
			makeInput({
				hook_event_name: "PostToolUse",
				tool_name: "Write",
				tool_input: { file_path: "/project/.env" },
				tool_response: { output: "File written" },
			}),
		);

		const events = readEvents(tmpDir);
		expect(events[0].risk.level).toBe("critical");
		expect(events[0].risk.flags).toContain("sensitive_path");
	});

	it("sets project context from cwd", () => {
		handleClaudeCodeHook(makeInput({ cwd: "/Users/test/my-awesome-project" }));
		const events = readEvents(tmpDir);
		expect(events[0].project.root).toBe("/Users/test/my-awesome-project");
		expect(events[0].project.name).toBe("my-awesome-project");
	});

	it("generates unique event IDs", () => {
		handleClaudeCodeHook(makeInput({ hook_event_name: "SessionStart" }));
		handleClaudeCodeHook(makeInput({ hook_event_name: "SessionEnd" }));
		const events = readEvents(tmpDir);
		expect(events[0].id).not.toBe(events[1].id);
		expect(events[0].id).toMatch(/^evt_/);
	});

	it("preserves session_id across events", () => {
		handleClaudeCodeHook(makeInput({ hook_event_name: "SessionStart", session_id: "ses_abc" }));
		handleClaudeCodeHook(
			makeInput({
				hook_event_name: "PostToolUse",
				session_id: "ses_abc",
				tool_name: "Read",
				tool_input: { file_path: "/test.ts" },
			}),
		);
		const events = readEvents(tmpDir);
		expect(events[0].session_id).toBe("ses_abc");
		expect(events[1].session_id).toBe("ses_abc");
	});
});

function readEvents(homeDir: string): any[] {
	const eventsPath = join(homeDir, ".patchwork", "events.jsonl");
	if (!existsSync(eventsPath)) return [];
	return readFileSync(eventsPath, "utf-8")
		.trim()
		.split("\n")
		.map((line) => JSON.parse(line));
}
