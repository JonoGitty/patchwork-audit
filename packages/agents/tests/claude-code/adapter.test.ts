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

	describe("schema_version and idempotency_key", () => {
		it("sets schema_version on generated events", () => {
			handleClaudeCodeHook(makeInput({ hook_event_name: "SessionStart" }));
			const events = readEvents(tmpDir);
			expect(events[0].schema_version).toBe(1);
		});

		it("generates idempotency_key for tool events with tool_use_id", () => {
			handleClaudeCodeHook(
				makeInput({
					hook_event_name: "PostToolUse",
					session_id: "ses_xyz",
					tool_name: "Read",
					tool_input: { file_path: "/test.ts" },
					tool_use_id: "tu_abc",
				}),
			);
			const events = readEvents(tmpDir);
			expect(events[0].idempotency_key).toBe("ses_xyz:PostToolUse:file_read:tu_abc");
		});

		it("generates idempotency_key for SessionStart (unique per session)", () => {
			handleClaudeCodeHook(
				makeInput({
					hook_event_name: "SessionStart",
					session_id: "ses_xyz",
				}),
			);
			const events = readEvents(tmpDir);
			expect(events[0].idempotency_key).toBe("ses_xyz:SessionStart:session_start");
		});

		it("omits idempotency_key for UserPromptSubmit (not unique per session)", () => {
			handleClaudeCodeHook(
				makeInput({
					hook_event_name: "UserPromptSubmit",
					session_id: "ses_xyz",
					prompt: "hello",
				}),
			);
			const events = readEvents(tmpDir);
			expect(events[0].idempotency_key).toBeUndefined();
		});

		it("omits idempotency_key for SubagentStart (not unique per session)", () => {
			handleClaudeCodeHook(
				makeInput({
					hook_event_name: "SubagentStart",
					session_id: "ses_xyz",
					subagent_type: "Explore",
				}),
			);
			const events = readEvents(tmpDir);
			expect(events[0].idempotency_key).toBeUndefined();
		});

		it("retains multiple UserPromptSubmit events in the same session", () => {
			handleClaudeCodeHook(
				makeInput({
					hook_event_name: "UserPromptSubmit",
					session_id: "ses_multi",
					prompt: "First prompt",
				}),
			);
			handleClaudeCodeHook(
				makeInput({
					hook_event_name: "UserPromptSubmit",
					session_id: "ses_multi",
					prompt: "Second prompt",
				}),
			);
			handleClaudeCodeHook(
				makeInput({
					hook_event_name: "UserPromptSubmit",
					session_id: "ses_multi",
					prompt: "Third prompt",
				}),
			);
			const events = readEvents(tmpDir);
			expect(events).toHaveLength(3);
			expect(events[0].action).toBe("prompt_submit");
			expect(events[1].action).toBe("prompt_submit");
			expect(events[2].action).toBe("prompt_submit");
		});

		it("retains multiple SubagentStart events in the same session", () => {
			handleClaudeCodeHook(
				makeInput({
					hook_event_name: "SubagentStart",
					session_id: "ses_subagents",
					subagent_type: "Explore",
				}),
			);
			handleClaudeCodeHook(
				makeInput({
					hook_event_name: "SubagentStart",
					session_id: "ses_subagents",
					subagent_type: "Plan",
				}),
			);
			const events = readEvents(tmpDir);
			expect(events).toHaveLength(2);
		});

		it("deduplicates on retry with same idempotency_key", () => {
			const input = makeInput({
				hook_event_name: "PostToolUse",
				session_id: "ses_retry",
				tool_name: "Write",
				tool_input: { file_path: "/test.ts", content: "hello" },
				tool_use_id: "tu_retry1",
				tool_response: { output: "ok" },
			});
			handleClaudeCodeHook(input);
			handleClaudeCodeHook(input);

			const events = readEvents(tmpDir);
			expect(events).toHaveLength(1);
		});
	});

	describe("directory permissions", () => {
		it("creates .patchwork directory with 0700", () => {
			handleClaudeCodeHook(makeInput({ hook_event_name: "SessionStart" }));
			const { statSync } = require("node:fs");
			const stat = statSync(join(tmpDir, ".patchwork"));
			expect(stat.mode & 0o777).toBe(0o700);
		});
	});

	describe("privacy-safe defaults", () => {
		let savedAbsPath: string | undefined;
		let savedPromptSize: string | undefined;

		beforeEach(() => {
			savedAbsPath = process.env.PATCHWORK_CAPTURE_ABS_PATH;
			savedPromptSize = process.env.PATCHWORK_CAPTURE_PROMPT_SIZE;
			delete process.env.PATCHWORK_CAPTURE_ABS_PATH;
			delete process.env.PATCHWORK_CAPTURE_PROMPT_SIZE;
		});

		afterEach(() => {
			if (savedAbsPath !== undefined) process.env.PATCHWORK_CAPTURE_ABS_PATH = savedAbsPath;
			else delete process.env.PATCHWORK_CAPTURE_ABS_PATH;
			if (savedPromptSize !== undefined) process.env.PATCHWORK_CAPTURE_PROMPT_SIZE = savedPromptSize;
			else delete process.env.PATCHWORK_CAPTURE_PROMPT_SIZE;
		});

		it("stores file paths relative to cwd by default", () => {
			handleClaudeCodeHook(
				makeInput({
					hook_event_name: "PostToolUse",
					cwd: "/Users/test/my-project",
					tool_name: "Read",
					tool_input: { file_path: "/Users/test/my-project/src/index.ts" },
					tool_response: { content: "code" },
				}),
			);
			const events = readEvents(tmpDir);
			expect(events[0].target.path).toBe("src/index.ts");
		});

		it("keeps absolute path when file is outside cwd", () => {
			handleClaudeCodeHook(
				makeInput({
					hook_event_name: "PostToolUse",
					cwd: "/Users/test/my-project",
					tool_name: "Read",
					tool_input: { file_path: "/etc/hosts" },
					tool_response: { content: "data" },
				}),
			);
			const events = readEvents(tmpDir);
			expect(events[0].target.path).toBe("/etc/hosts");
		});

		it("omits abs_path by default", () => {
			handleClaudeCodeHook(
				makeInput({
					hook_event_name: "PostToolUse",
					cwd: "/Users/test/my-project",
					tool_name: "Write",
					tool_input: { file_path: "/Users/test/my-project/file.ts", content: "x" },
					tool_response: { output: "ok" },
				}),
			);
			const events = readEvents(tmpDir);
			expect(events[0].target.abs_path).toBeUndefined();
		});

		it("includes abs_path when PATCHWORK_CAPTURE_ABS_PATH=1", () => {
			process.env.PATCHWORK_CAPTURE_ABS_PATH = "1";
			handleClaudeCodeHook(
				makeInput({
					hook_event_name: "PostToolUse",
					cwd: "/Users/test/my-project",
					tool_name: "Write",
					tool_input: { file_path: "/Users/test/my-project/file.ts", content: "x" },
					tool_response: { output: "ok" },
				}),
			);
			const events = readEvents(tmpDir);
			expect(events[0].target.abs_path).toBe("/Users/test/my-project/file.ts");
		});

		it("redacts --password values in commands", () => {
			handleClaudeCodeHook(
				makeInput({
					hook_event_name: "PostToolUse",
					tool_name: "Bash",
					tool_input: { command: "mysql --password=secret123 -u root" },
					tool_response: { stdout: "ok" },
				}),
			);
			const events = readEvents(tmpDir);
			expect(events[0].target.command).toBe("mysql --password=[REDACTED] -u root");
		});

		it("redacts --token values in commands", () => {
			handleClaudeCodeHook(
				makeInput({
					hook_event_name: "PostToolUse",
					tool_name: "Bash",
					tool_input: { command: "gh auth login --token ghp_abc123" },
					tool_response: { stdout: "ok" },
				}),
			);
			const events = readEvents(tmpDir);
			expect(events[0].target.command).toBe("gh auth login --token [REDACTED]");
		});

		it("redacts --api-key and --secret values in commands", () => {
			handleClaudeCodeHook(
				makeInput({
					hook_event_name: "PostToolUse",
					tool_name: "Bash",
					tool_input: { command: "cli --api-key abc123 --secret xyz789" },
					tool_response: { stdout: "ok" },
				}),
			);
			const events = readEvents(tmpDir);
			expect(events[0].target.command).toBe("cli --api-key [REDACTED] --secret [REDACTED]");
		});

		it("redacts Authorization Bearer tokens in commands", () => {
			handleClaudeCodeHook(
				makeInput({
					hook_event_name: "PostToolUse",
					tool_name: "Bash",
					tool_input: { command: 'curl -H "Authorization: Bearer mytoken123" https://api.example.com' },
					tool_response: { stdout: "ok" },
				}),
			);
			const events = readEvents(tmpDir);
			expect(events[0].target.command).toContain("Authorization: Bearer [REDACTED]");
			expect(events[0].target.command).not.toContain("mytoken123");
		});

		it("redacts inline API key shapes (sk-...) in commands", () => {
			handleClaudeCodeHook(
				makeInput({
					hook_event_name: "PostToolUse",
					tool_name: "Bash",
					tool_input: { command: "curl https://api.openai.com -d sk-proj-abcdefghijklmnopqrstuvwx" },
					tool_response: { stdout: "ok" },
				}),
			);
			const events = readEvents(tmpDir);
			expect(events[0].target.command).not.toMatch(/sk-[a-zA-Z0-9_-]{20,}/);
			expect(events[0].target.command).toContain("[REDACTED]");
		});

		it("preserves non-secret commands unchanged", () => {
			handleClaudeCodeHook(
				makeInput({
					hook_event_name: "PostToolUse",
					tool_name: "Bash",
					tool_input: { command: "npm test && echo done" },
					tool_response: { stdout: "ok" },
				}),
			);
			const events = readEvents(tmpDir);
			expect(events[0].target.command).toBe("npm test && echo done");
		});

		it("omits prompt size_bytes by default", () => {
			handleClaudeCodeHook(
				makeInput({
					hook_event_name: "UserPromptSubmit",
					prompt: "Fix the bug",
				}),
			);
			const events = readEvents(tmpDir);
			expect(events[0].content.hash).toMatch(/^sha256:/);
			expect(events[0].content.size_bytes).toBeUndefined();
		});

		it("includes prompt size_bytes when PATCHWORK_CAPTURE_PROMPT_SIZE=1", () => {
			process.env.PATCHWORK_CAPTURE_PROMPT_SIZE = "1";
			handleClaudeCodeHook(
				makeInput({
					hook_event_name: "UserPromptSubmit",
					prompt: "Fix the bug",
				}),
			);
			const events = readEvents(tmpDir);
			expect(events[0].content.size_bytes).toBe(Buffer.byteLength("Fix the bug", "utf-8"));
		});
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
