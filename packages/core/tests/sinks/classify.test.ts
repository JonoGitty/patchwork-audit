import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { homedir } from "node:os";
import {
	classifyToolEvent,
	highestSeverity,
} from "../../src/sinks/classify.js";
import type { ToolEvent, TaintSnapshot } from "../../src/core/tool-event.js";

const HOME = process.env.HOME || process.env.USERPROFILE || homedir();

function makeEvent(overrides: Partial<ToolEvent>): ToolEvent {
	return {
		tool: "Write",
		phase: "pre",
		cwd: "/tmp/proj",
		project_root: "/tmp/proj",
		raw_input: {},
		target_paths: [],
		resolved_paths: [],
		urls: [],
		hosts: [],
		policy_version: "v0.6.11-test",
		...overrides,
	};
}

function emptyTaint(): TaintSnapshot {
	return {
		session_id: "sess-test",
		by_kind: {},
		generated_files: {},
	};
}

function tainted(kind: string): TaintSnapshot {
	return {
		session_id: "sess-test",
		by_kind: {
			[kind]: [
				{ ts: 0, ref: "test://source", content_hash: "deadbeef" },
			],
		},
		generated_files: {},
	};
}

describe("classifyToolEvent — claude_file_write_persistence", () => {
	it("flags Write to ~/.zshrc as persistence sink (untainted = approval_required)", () => {
		const event = makeEvent({
			tool: "Write",
			resolved_paths: [join(HOME, ".zshrc")],
		});
		const matches = classifyToolEvent(event);
		expect(matches).toHaveLength(1);
		expect(matches[0].class).toBe("claude_file_write_persistence");
		expect(matches[0].severity).toBe("approval_required");
		expect(matches[0].matched_path).toBe(join(HOME, ".zshrc"));
	});

	it("escalates to deny when ANY taint is active", () => {
		const event = makeEvent({
			tool: "Write",
			resolved_paths: [join(HOME, ".zshrc")],
			taint_state: tainted("prompt"),
		});
		const matches = classifyToolEvent(event);
		expect(matches).toHaveLength(1);
		expect(matches[0].severity).toBe("deny");
		expect(matches[0].reason).toMatch(/under active taint/i);
	});

	it("matches all four Claude-native write tools", () => {
		for (const tool of ["Write", "Edit", "MultiEdit", "NotebookEdit"]) {
			const event = makeEvent({
				tool,
				resolved_paths: [join(HOME, ".bashrc")],
			});
			const matches = classifyToolEvent(event);
			expect(matches.length, `${tool} must classify`).toBe(1);
			expect(matches[0].class).toBe("claude_file_write_persistence");
		}
	});

	it("does NOT classify Bash even with persistence-shaped target_paths", () => {
		// Bash sink classification is deferred to commit 4 (shell recognizer).
		// Until then, classify.ts must not pretend to handle Bash sinks.
		const event = makeEvent({
			tool: "Bash",
			resolved_paths: [join(HOME, ".zshrc")],
			target_paths: [join(HOME, ".zshrc")],
		});
		expect(classifyToolEvent(event)).toEqual([]);
	});

	it("matches GitHub Actions workflow path under any project root", () => {
		const event = makeEvent({
			tool: "Write",
			resolved_paths: ["/some/repo/.github/workflows/release.yml"],
			taint_state: tainted("prompt"),
		});
		const matches = classifyToolEvent(event);
		expect(matches[0].class).toBe("claude_file_write_persistence");
		expect(matches[0].severity).toBe("deny");
		expect(matches[0].matched_pattern).toBe("**/.github/workflows/**");
	});

	it("matches git hooks path", () => {
		const event = makeEvent({
			tool: "Write",
			resolved_paths: ["/some/repo/.git/hooks/pre-commit"],
			taint_state: tainted("network_content"),
		});
		const matches = classifyToolEvent(event);
		expect(matches[0].class).toBe("claude_file_write_persistence");
		expect(matches[0].severity).toBe("deny");
	});

	it("matches macOS LaunchAgent under home", () => {
		const event = makeEvent({
			tool: "Write",
			resolved_paths: [join(HOME, "Library/LaunchAgents/com.evil.plist")],
		});
		const matches = classifyToolEvent(event);
		expect(matches[0].class).toBe("claude_file_write_persistence");
	});

	it("matches direnv .envrc", () => {
		const event = makeEvent({
			tool: "Edit",
			resolved_paths: ["/some/repo/.envrc"],
			taint_state: tainted("prompt"),
		});
		const matches = classifyToolEvent(event);
		expect(matches[0].severity).toBe("deny");
	});

	it("matches Claude Code project settings (hooks vector)", () => {
		const event = makeEvent({
			tool: "Write",
			resolved_paths: ["/some/repo/.claude/settings.json"],
			taint_state: tainted("prompt"),
		});
		const matches = classifyToolEvent(event);
		expect(matches[0].class).toBe("claude_file_write_persistence");
		expect(matches[0].severity).toBe("deny");
	});

	it("does NOT match unrelated source files in the project", () => {
		const event = makeEvent({
			tool: "Write",
			resolved_paths: ["/some/repo/src/index.ts"],
			taint_state: tainted("prompt"),
		});
		expect(classifyToolEvent(event)).toEqual([]);
	});

	it("is case-insensitive (HFS+/APFS path-folding defense)", () => {
		const event = makeEvent({
			tool: "Write",
			resolved_paths: [join(HOME, ".SSH/AUTHORIZED_KEYS")],
		});
		const matches = classifyToolEvent(event);
		expect(matches.length).toBeGreaterThan(0);
		expect(matches[0].class).toBe("claude_file_write_persistence");
	});

	it("ignores empty taint snapshot (no by_kind entries) and stays at approval_required", () => {
		const event = makeEvent({
			tool: "Write",
			resolved_paths: [join(HOME, ".zshrc")],
			taint_state: emptyTaint(),
		});
		const matches = classifyToolEvent(event);
		expect(matches[0].severity).toBe("approval_required");
	});

	it("falls back to target_paths when resolved_paths is empty", () => {
		// Pre-commit-7 events won't have resolved_paths populated. The
		// classifier must still match on target_paths so detection
		// degrades gracefully — commit-8 enforcement layer separately
		// fail-closes when only the unresolved field is present under taint.
		const event = makeEvent({
			tool: "Write",
			resolved_paths: [],
			target_paths: [join(HOME, ".bashrc")],
		});
		const matches = classifyToolEvent(event);
		expect(matches.length).toBe(1);
		expect(matches[0].class).toBe("claude_file_write_persistence");
	});
});

describe("classifyToolEvent — secret_read", () => {
	it("flags Read of ~/.aws/credentials as advisory secret_read", () => {
		const event = makeEvent({
			tool: "Read",
			resolved_paths: [join(HOME, ".aws/credentials")],
		});
		const matches = classifyToolEvent(event);
		expect(matches).toHaveLength(1);
		expect(matches[0].class).toBe("secret_read");
		expect(matches[0].severity).toBe("advisory");
	});

	it("flags Read of ~/.git-credentials", () => {
		const event = makeEvent({
			tool: "Read",
			resolved_paths: [join(HOME, ".git-credentials")],
		});
		const matches = classifyToolEvent(event);
		expect(matches[0].class).toBe("secret_read");
	});

	it("flags Read of project .env", () => {
		const event = makeEvent({
			tool: "Read",
			resolved_paths: ["/some/repo/.env"],
		});
		const matches = classifyToolEvent(event);
		expect(matches[0].class).toBe("secret_read");
	});

	it("flags Read of project .env.production", () => {
		const event = makeEvent({
			tool: "Read",
			resolved_paths: ["/some/repo/.env.production"],
		});
		const matches = classifyToolEvent(event);
		expect(matches[0].class).toBe("secret_read");
	});

	it("flags Read of SSH private key under any path", () => {
		const event = makeEvent({
			tool: "Read",
			resolved_paths: [join(HOME, ".ssh/id_ed25519")],
		});
		const matches = classifyToolEvent(event);
		expect(matches[0].class).toBe("secret_read");
	});

	it("does NOT flag Write to a credential path as secret_read", () => {
		// Write to ~/.aws/credentials is a different (more dangerous) sink
		// — it's persistence, not exfil. Keeps roles distinct so commit 8
		// can decide independently.
		const event = makeEvent({
			tool: "Write",
			resolved_paths: [join(HOME, ".aws/credentials")],
		});
		const matches = classifyToolEvent(event);
		// The path doesn't currently match any persistence pattern (aws
		// credentials aren't on the persistence list), so no match either
		// way. The contract: secret_read fires on Read only.
		expect(matches.find((m) => m.class === "secret_read")).toBeUndefined();
	});

	it("does NOT flag Read of unrelated files", () => {
		const event = makeEvent({
			tool: "Read",
			resolved_paths: ["/some/repo/README.md"],
		});
		expect(classifyToolEvent(event)).toEqual([]);
	});

	it("severity is advisory regardless of taint state (no immediate block)", () => {
		const event = makeEvent({
			tool: "Read",
			resolved_paths: [join(HOME, ".aws/credentials")],
			taint_state: tainted("prompt"),
		});
		const matches = classifyToolEvent(event);
		expect(matches[0].severity).toBe("advisory");
	});
});

describe("classifyToolEvent — empty / negative cases", () => {
	it("returns empty array for tool with no target_paths", () => {
		const event = makeEvent({ tool: "Write" });
		expect(classifyToolEvent(event)).toEqual([]);
	});

	it("returns empty array for unknown tool name", () => {
		const event = makeEvent({
			tool: "TotallyMadeUp",
			resolved_paths: [join(HOME, ".zshrc")],
		});
		expect(classifyToolEvent(event)).toEqual([]);
	});

	it("returns empty array for WebFetch (network sinks are commit 5+)", () => {
		const event = makeEvent({
			tool: "WebFetch",
			urls: ["https://attacker.example/x"],
		});
		expect(classifyToolEvent(event)).toEqual([]);
	});

	it("returns empty array for Read of non-credential path", () => {
		const event = makeEvent({
			tool: "Read",
			resolved_paths: ["/some/repo/src/foo.ts"],
		});
		expect(classifyToolEvent(event)).toEqual([]);
	});
});

describe("highestSeverity", () => {
	it("returns null for empty list", () => {
		expect(highestSeverity([])).toBeNull();
	});

	it("ranks deny > approval_required > advisory", () => {
		const matches = [
			{
				class: "secret_read" as const,
				severity: "advisory" as const,
				reason: "a",
				matched_pattern: "p1",
			},
			{
				class: "claude_file_write_persistence" as const,
				severity: "approval_required" as const,
				reason: "b",
				matched_pattern: "p2",
			},
			{
				class: "claude_file_write_persistence" as const,
				severity: "deny" as const,
				reason: "c",
				matched_pattern: "p3",
			},
		];
		expect(highestSeverity(matches)?.severity).toBe("deny");
	});

	it("returns the deny match unchanged when there is one", () => {
		const denyMatch = {
			class: "claude_file_write_persistence" as const,
			severity: "deny" as const,
			reason: "danger",
			matched_pattern: "**/.github/workflows/**",
		};
		expect(highestSeverity([denyMatch])).toEqual(denyMatch);
	});

	it("picks first match when severities tie", () => {
		const a = {
			class: "secret_read" as const,
			severity: "advisory" as const,
			reason: "a",
			matched_pattern: "p1",
		};
		const b = {
			class: "secret_read" as const,
			severity: "advisory" as const,
			reason: "b",
			matched_pattern: "p2",
		};
		expect(highestSeverity([a, b])?.reason).toBe("a");
	});
});
