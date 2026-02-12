import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("syncCodexHistory", () => {
	let tmpDir: string;
	let originalHome: string | undefined;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-codex-test-"));
		originalHome = process.env.HOME;
		process.env.HOME = tmpDir;
	});

	afterEach(() => {
		process.env.HOME = originalHome;
		rmSync(tmpDir, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	async function loadSync() {
		// Reset module registry so top-level constants re-evaluate with new HOME
		vi.resetModules();
		const mod = await import("../../src/codex/history-parser.js");
		return mod.syncCodexHistory;
	}

	it("returns zeros when no history exists", async () => {
		const syncCodexHistory = await loadSync();
		const result = syncCodexHistory();
		expect(result).toEqual({ ingested: 0, skipped: 0, errors: 0 });
	});

	it("handles empty history file", async () => {
		const codexDir = join(tmpDir, ".codex");
		mkdirSync(codexDir, { recursive: true });
		writeFileSync(join(codexDir, "history.jsonl"), "", "utf-8");

		const syncCodexHistory = await loadSync();
		const result = syncCodexHistory();
		expect(result).toEqual({ ingested: 0, skipped: 0, errors: 0 });
	});

	it("ingests prompt_submit events with content hashes", async () => {
		const codexDir = join(tmpDir, ".codex");
		mkdirSync(codexDir, { recursive: true });

		const entry = JSON.stringify({
			timestamp: "2026-01-15T10:00:00.000Z",
			session_id: "abc123",
			prompt: "Fix the bug in auth.ts",
			model: "o3",
		});
		writeFileSync(join(codexDir, "history.jsonl"), entry + "\n", "utf-8");

		const syncCodexHistory = await loadSync();
		const result = syncCodexHistory();
		expect(result.ingested).toBeGreaterThanOrEqual(1);
		expect(result.errors).toBe(0);

		// Verify events were written
		const { JsonlStore } = await import("@patchwork/core");
		const store = new JsonlStore(join(tmpDir, ".patchwork", "events.jsonl"));
		const events = store.readAll();
		expect(events.length).toBeGreaterThanOrEqual(1);

		const promptEvent = events.find((e) => e.action === "prompt_submit");
		expect(promptEvent).toBeDefined();
		expect(promptEvent!.content?.hash).toMatch(/^sha256:/);
	});

	it("maps tool calls to correct actions", async () => {
		const codexDir = join(tmpDir, ".codex");
		mkdirSync(codexDir, { recursive: true });

		const entry = JSON.stringify({
			timestamp: "2026-01-15T10:00:00.000Z",
			session_id: "abc456",
			tool_calls: [
				{ name: "write_file", input: { path: "/tmp/test.ts" }, output: "ok" },
				{ name: "shell_exec", input: { command: "npm test" }, output: "passed" },
				{ name: "read_file", input: { path: "/tmp/read.ts" }, output: "content" },
			],
		});
		writeFileSync(join(codexDir, "history.jsonl"), entry + "\n", "utf-8");

		const syncCodexHistory = await loadSync();
		const result = syncCodexHistory();
		expect(result.ingested).toBe(3);

		const { JsonlStore } = await import("@patchwork/core");
		const store = new JsonlStore(join(tmpDir, ".patchwork", "events.jsonl"));
		const events = store.readAll();

		const actions = events.map((e) => e.action);
		expect(actions).toContain("file_write");
		expect(actions).toContain("command_execute");
		expect(actions).toContain("file_read");
	});

	it("sets agent to codex on all events", async () => {
		const codexDir = join(tmpDir, ".codex");
		mkdirSync(codexDir, { recursive: true });

		const entry = JSON.stringify({
			timestamp: "2026-01-15T10:00:00.000Z",
			session_id: "abc789",
			prompt: "Hello",
			tool_calls: [{ name: "write_file", input: { path: "/tmp/x.ts" } }],
		});
		writeFileSync(join(codexDir, "history.jsonl"), entry + "\n", "utf-8");

		const syncCodexHistory = await loadSync();
		syncCodexHistory();

		const { JsonlStore } = await import("@patchwork/core");
		const store = new JsonlStore(join(tmpDir, ".patchwork", "events.jsonl"));
		const events = store.readAll();

		for (const event of events) {
			expect(event.agent).toBe("codex");
		}
	});

	it("deduplicates on second sync", async () => {
		const codexDir = join(tmpDir, ".codex");
		mkdirSync(codexDir, { recursive: true });

		const entry = JSON.stringify({
			timestamp: "2026-01-15T10:00:00.000Z",
			session_id: "dedup1",
			prompt: "Hello world",
		});
		writeFileSync(join(codexDir, "history.jsonl"), entry + "\n", "utf-8");

		const syncCodexHistory = await loadSync();
		const first = syncCodexHistory();
		expect(first.ingested).toBe(1);

		const second = syncCodexHistory();
		expect(second.skipped).toBe(1);
		expect(second.ingested).toBe(0);
	});

	it("counts parse errors for malformed lines", async () => {
		const codexDir = join(tmpDir, ".codex");
		mkdirSync(codexDir, { recursive: true });

		const lines = [
			JSON.stringify({ timestamp: "2026-01-15T10:00:00.000Z", prompt: "ok" }),
			"not valid json {{{",
			"also broken ]]",
		];
		writeFileSync(join(codexDir, "history.jsonl"), lines.join("\n") + "\n", "utf-8");

		const syncCodexHistory = await loadSync();
		const result = syncCodexHistory();
		expect(result.errors).toBe(2);
		expect(result.ingested).toBe(1);
	});
});
