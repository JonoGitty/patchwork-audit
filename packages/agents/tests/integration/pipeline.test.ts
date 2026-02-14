import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleClaudeCodeHook } from "../../src/claude-code/adapter.js";
import { JsonlStore, type AuditEvent } from "@patchwork/core";
import type { ClaudeCodeHookInput } from "../../src/claude-code/types.js";

/**
 * End-to-end integration test.
 * Simulates a complete Claude Code session with multiple tool uses
 * and verifies the full audit pipeline.
 */
describe("E2E: Claude Code session pipeline", () => {
	let testDir: string;
	let eventsPath: string;
	let originalHome: string | undefined;

	beforeEach(() => {
		testDir = mkdtempSync(join(tmpdir(), "patchwork-e2e-"));
		eventsPath = join(testDir, ".patchwork", "events.jsonl");
		originalHome = process.env.HOME;
		process.env.HOME = testDir;
		mkdirSync(join(testDir, ".patchwork"), { recursive: true });
	});

	afterEach(() => {
		process.env.HOME = originalHome;
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// Windows: open file handles (e.g. better-sqlite3) may prevent cleanup
		}
	});

	function makeInput(overrides: Partial<ClaudeCodeHookInput>): ClaudeCodeHookInput {
		return {
			session_id: "ses_test_e2e",
			transcript_path: "/tmp/transcript.jsonl",
			cwd: "/home/user/project",
			hook_event_name: "PostToolUse",
			...overrides,
		};
	}

	function getEvents(): AuditEvent[] {
		const store = new JsonlStore(eventsPath);
		return store.readAll();
	}

	it("captures a complete session lifecycle", () => {
		// 1. Session starts
		handleClaudeCodeHook(makeInput({
			hook_event_name: "SessionStart",
		}));

		// 2. User submits a prompt
		handleClaudeCodeHook(makeInput({
			hook_event_name: "UserPromptSubmit",
			prompt: "Please fix the bug in auth.ts",
		}));

		// 3. Agent reads a file
		handleClaudeCodeHook(makeInput({
			hook_event_name: "PostToolUse",
			tool_name: "Read",
			tool_input: { file_path: "/home/user/project/src/auth.ts" },
			tool_response: { output: "const auth = () => { ... }" },
		}));

		// 4. Agent searches for related code
		handleClaudeCodeHook(makeInput({
			hook_event_name: "PostToolUse",
			tool_name: "Grep",
			tool_input: { pattern: "authenticate", path: "/home/user/project/src" },
			tool_response: { output: "src/auth.ts:5: function authenticate()" },
		}));

		// 5. Agent edits the file
		handleClaudeCodeHook(makeInput({
			hook_event_name: "PostToolUse",
			tool_name: "Edit",
			tool_input: {
				file_path: "/home/user/project/src/auth.ts",
				old_string: "const auth = () => {}",
				new_string: "const auth = (token: string) => { validate(token); }",
			},
			tool_response: { output: "File updated" },
		}));

		// 6. Agent runs tests
		handleClaudeCodeHook(makeInput({
			hook_event_name: "PostToolUse",
			tool_name: "Bash",
			tool_input: { command: "npm test" },
			tool_response: { stdout: "All tests passed" },
		}));

		// 7. Session ends
		handleClaudeCodeHook(makeInput({
			hook_event_name: "SessionEnd",
		}));

		// Verify the full event timeline
		const events = getEvents();
		expect(events).toHaveLength(7);

		// Check session lifecycle
		expect(events[0].action).toBe("session_start");
		expect(events[6].action).toBe("session_end");

		// Check prompt
		expect(events[1].action).toBe("prompt_submit");
		expect(events[1].content).toBeDefined();
		expect(events[1].content?.hash).toMatch(/^sha256:/);

		// Check file read
		expect(events[2].action).toBe("file_read");
		expect(events[2].target?.path).toContain("auth.ts");

		// Check grep
		expect(events[3].action).toBe("file_grep");

		// Check file edit
		expect(events[4].action).toBe("file_edit");
		expect(events[4].target?.path).toContain("auth.ts");
		expect(events[4].risk.level).toBe("medium"); // write operations are medium

		// Check command execution
		expect(events[5].action).toBe("command_execute");
		expect(events[5].target?.command).toBe("npm test");
		expect(events[5].risk.level).toBe("medium"); // commands are at least medium

		// All events share the session ID
		for (const event of events) {
			expect(event.session_id).toBe("ses_test_e2e");
		}

		// All events have unique IDs
		const ids = new Set(events.map((e) => e.id));
		expect(ids.size).toBe(7);

		// All events have project context
		for (const event of events) {
			expect(event.project?.name).toBe("project");
		}
	});

	it("captures failed tool uses", () => {
		handleClaudeCodeHook(makeInput({
			hook_event_name: "PostToolUseFailure",
			tool_name: "Bash",
			tool_input: { command: "npm test" },
			tool_response: { stderr: "Error: test failed" },
		}));

		const events = getEvents();
		expect(events).toHaveLength(1);
		expect(events[0].status).toBe("failed");
		expect(events[0].action).toBe("command_execute");
	});

	it("captures subagent lifecycle", () => {
		handleClaudeCodeHook(makeInput({
			hook_event_name: "SubagentStart",
			subagent_type: "Explore",
		}));

		handleClaudeCodeHook(makeInput({
			hook_event_name: "SubagentStop",
			subagent_type: "Explore",
		}));

		const events = getEvents();
		expect(events).toHaveLength(2);
		expect(events[0].action).toBe("subagent_start");
		expect(events[0].target?.tool_name).toBe("Explore");
		expect(events[1].action).toBe("subagent_stop");
	});

	it("PreToolUse returns allow in default mode", () => {
		const result = handleClaudeCodeHook(makeInput({
			hook_event_name: "PreToolUse",
			tool_name: "Bash",
			tool_input: { command: "npm test" },
		}));

		expect(result).toEqual({ allow: true });
	});

	it("classifies risk correctly through the pipeline", () => {
		// Write to .env (critical risk)
		handleClaudeCodeHook(makeInput({
			hook_event_name: "PostToolUse",
			tool_name: "Write",
			tool_input: { file_path: "/home/user/project/.env", content: "SECRET=abc" },
			tool_response: { output: "File written" },
		}));

		// Normal file write (medium risk)
		handleClaudeCodeHook(makeInput({
			hook_event_name: "PostToolUse",
			tool_name: "Write",
			tool_input: { file_path: "/home/user/project/src/app.ts", content: "export const app = {};" },
			tool_response: { output: "File written" },
		}));

		// Dangerous command (critical risk)
		handleClaudeCodeHook(makeInput({
			hook_event_name: "PostToolUse",
			tool_name: "Bash",
			tool_input: { command: "rm -rf /tmp/test" },
			tool_response: { output: "" },
		}));

		const events = getEvents();
		expect(events).toHaveLength(3);

		expect(events[0].risk.level).toBe("critical");
		expect(events[0].risk.flags).toContain("sensitive_path");

		expect(events[1].risk.level).toBe("medium");

		expect(events[2].risk.level).toBe("critical");
		expect(events[2].risk.flags).toContain("dangerous_command");
	});

	it("stores events persistently and can query them", () => {
		// Create some events
		handleClaudeCodeHook(makeInput({
			hook_event_name: "SessionStart",
		}));
		handleClaudeCodeHook(makeInput({
			hook_event_name: "PostToolUse",
			tool_name: "Write",
			tool_input: { file_path: "/project/src/index.ts", content: "..." },
			tool_response: { output: "OK" },
		}));

		// Read them back with a fresh store
		const store = new JsonlStore(eventsPath);
		const allEvents = store.readAll();
		expect(allEvents).toHaveLength(2);

		// Query with filters
		const highRisk = store.query({ minRisk: "high" });
		expect(highRisk.length).toBeLessThanOrEqual(allEvents.length);

		const sessionEvents = store.query({ sessionId: "ses_test_e2e" });
		expect(sessionEvents).toHaveLength(2);
	});
});
