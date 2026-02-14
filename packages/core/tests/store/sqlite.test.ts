import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, existsSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteStore } from "../../src/store/sqlite.js";
import type { AuditEvent } from "../../src/schema/event.js";

// Windows does not enforce POSIX file permissions (chmod 0o600/0o700 is a no-op)
const isWindows = process.platform === "win32";

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
	return {
		id: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
		session_id: "ses_test",
		timestamp: new Date().toISOString(),
		agent: "claude-code",
		action: "file_read",
		status: "completed",
		risk: { level: "low", flags: [] },
		...overrides,
	};
}

describe("SqliteStore", () => {
	let tmpDir: string;
	let store: SqliteStore;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-sqlite-test-"));
		store = new SqliteStore(join(tmpDir, "db", "audit.db"));
	});

	afterEach(() => {
		store.close();
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("creates DB file on disk", () => {
		expect(existsSync(join(tmpDir, "db", "audit.db"))).toBe(true);
	});

	it("uses WAL mode", () => {
		// WAL file should exist after first write
		store.append(makeEvent());
		expect(existsSync(join(tmpDir, "db", "audit.db-wal"))).toBe(true);
	});

	it("starts empty", () => {
		expect(store.readAll()).toEqual([]);
	});

	it("appends and reads a single event", () => {
		const event = makeEvent();
		store.append(event);
		const events = store.readAll();
		expect(events).toHaveLength(1);
		expect(events[0].id).toBe(event.id);
	});

	it("appends multiple events in order", () => {
		const e1 = makeEvent({ action: "file_read", timestamp: "2026-01-01T00:00:01.000Z" });
		const e2 = makeEvent({ action: "file_write", timestamp: "2026-01-01T00:00:02.000Z" });
		const e3 = makeEvent({ action: "command_execute", timestamp: "2026-01-01T00:00:03.000Z" });
		store.append(e1);
		store.append(e2);
		store.append(e3);

		const events = store.readAll();
		expect(events).toHaveLength(3);
		expect(events[0].action).toBe("file_read");
		expect(events[1].action).toBe("file_write");
		expect(events[2].action).toBe("command_execute");
	});

	it("readRecent returns last N events", () => {
		for (let i = 0; i < 10; i++) {
			store.append(makeEvent({
				action: `action_${i}` as any,
				timestamp: new Date(Date.now() + i * 1000).toISOString(),
			}));
		}
		const recent = store.readRecent(3);
		expect(recent).toHaveLength(3);
		expect(recent[0].action).toBe("action_7");
		expect(recent[2].action).toBe("action_9");
	});

	it("ignores duplicate IDs", () => {
		const event = makeEvent({ id: "evt_dupe" });
		store.append(event);
		store.append(event);
		expect(store.readAll()).toHaveLength(1);
	});

	describe("query", () => {
		beforeEach(() => {
			store.append(makeEvent({
				agent: "claude-code", action: "file_read",
				risk: { level: "low", flags: [] },
				timestamp: "2026-01-15T10:00:01.000Z",
			}));
			store.append(makeEvent({
				agent: "claude-code", action: "file_write",
				risk: { level: "medium", flags: [] },
				timestamp: "2026-01-15T10:00:02.000Z",
			}));
			store.append(makeEvent({
				agent: "codex", action: "command_execute",
				risk: { level: "high", flags: ["dangerous_command"] },
				timestamp: "2026-01-15T10:00:03.000Z",
			}));
			store.append(makeEvent({
				agent: "claude-code", action: "web_fetch",
				risk: { level: "medium", flags: ["network_access"] },
				timestamp: "2026-01-15T10:00:04.000Z",
			}));
		});

		it("filters by agent", () => {
			const results = store.query({ agent: "codex" });
			expect(results).toHaveLength(1);
			expect(results[0].action).toBe("command_execute");
		});

		it("filters by action", () => {
			const results = store.query({ action: "file_write" });
			expect(results).toHaveLength(1);
		});

		it("filters by minimum risk level", () => {
			const results = store.query({ minRisk: "medium" });
			expect(results).toHaveLength(3); // medium, high, medium
		});

		it("filters by high risk", () => {
			const results = store.query({ minRisk: "high" });
			expect(results).toHaveLength(1);
		});

		it("filters by session ID", () => {
			store.append(makeEvent({
				session_id: "ses_other", action: "file_read",
				timestamp: "2026-01-15T10:00:05.000Z",
			}));
			const results = store.query({ sessionId: "ses_other" });
			expect(results).toHaveLength(1);
		});

		it("respects limit", () => {
			const results = store.query({ limit: 2 });
			expect(results).toHaveLength(2);
		});

		it("filters by project name", () => {
			store.append(makeEvent({
				project: { root: "/test/my-project", name: "my-project" },
				action: "file_read",
				timestamp: "2026-01-15T10:00:05.000Z",
			}));
			const results = store.query({ projectName: "my-project" });
			expect(results).toHaveLength(1);
		});
	});

	describe("search (FTS5)", () => {
		beforeEach(() => {
			store.append(makeEvent({
				action: "file_write",
				target: { type: "file", path: "src/auth/login.ts" },
				timestamp: "2026-01-15T10:00:01.000Z",
			}));
			store.append(makeEvent({
				action: "command_execute",
				target: { type: "command", command: "npm run build" },
				timestamp: "2026-01-15T10:00:02.000Z",
			}));
			store.append(makeEvent({
				action: "mcp_tool_call",
				target: { type: "mcp_tool", tool_name: "database_query" },
				timestamp: "2026-01-15T10:00:03.000Z",
			}));
		});

		it("searches by target path", () => {
			const results = store.search("auth");
			expect(results).toHaveLength(1);
			expect(results[0].target?.path).toBe("src/auth/login.ts");
		});

		it("searches by command", () => {
			const results = store.search("build");
			expect(results).toHaveLength(1);
			expect(results[0].target?.command).toBe("npm run build");
		});

		it("searches by tool name", () => {
			const results = store.search("database_query");
			expect(results).toHaveLength(1);
			expect(results[0].target?.tool_name).toBe("database_query");
		});

		it("returns empty for no matches", () => {
			const results = store.search("nonexistent_xyz");
			expect(results).toHaveLength(0);
		});

		it("respects limit", () => {
			store.append(makeEvent({
				action: "file_read",
				target: { type: "file", path: "src/auth/logout.ts" },
				timestamp: "2026-01-15T10:00:04.000Z",
			}));
			const results = store.search("auth", 1);
			expect(results).toHaveLength(1);
		});

		it("searches by action", () => {
			const results = store.search("file_write");
			expect(results).toHaveLength(1);
		});
	});

	describe.skipIf(isWindows)("file permissions", () => {
		it("creates directory with 0700", () => {
			const subDir = join(tmpDir, "secure-db");
			const s = new SqliteStore(join(subDir, "audit.db"));
			const stat = statSync(subDir);
			expect(stat.mode & 0o777).toBe(0o700);
			s.close();
		});

		it("creates DB file with 0600", () => {
			const dbPath = join(tmpDir, "secure-db2", "audit.db");
			const s = new SqliteStore(dbPath);
			const stat = statSync(dbPath);
			expect(stat.mode & 0o777).toBe(0o600);
			s.close();
		});

		it("corrects insecure existing directory permissions on init", () => {
			const subDir = join(tmpDir, "insecure-dir");
			mkdirSync(subDir, { mode: 0o755 });
			expect(statSync(subDir).mode & 0o777).toBe(0o755);

			const s = new SqliteStore(join(subDir, "audit.db"));
			expect(statSync(subDir).mode & 0o777).toBe(0o700);
			s.close();
		});

		it("corrects insecure existing DB file permissions on init", () => {
			// Create a DB first with correct perms, then widen them
			const subDir = join(tmpDir, "insecure-file");
			mkdirSync(subDir, { mode: 0o700 });
			const dbPath = join(subDir, "audit.db");
			const s1 = new SqliteStore(dbPath);
			s1.close();
			chmodSync(dbPath, 0o644);
			expect(statSync(dbPath).mode & 0o777).toBe(0o644);

			// Re-opening should fix it
			const s2 = new SqliteStore(dbPath);
			expect(statSync(dbPath).mode & 0o777).toBe(0o600);
			s2.close();
		});
	});

	describe("schema validation", () => {
		it("rejects invalid event on append", () => {
			const bad = { id: "x" } as unknown as AuditEvent;
			expect(() => store.append(bad)).toThrow(/Invalid event/);
		});

		it("reports read errors for corrupt raw_json", () => {
			// Insert a valid event first
			store.append(makeEvent());

			// Manually insert corrupt raw_json via raw SQL
			(store as any).db.prepare(
				`INSERT INTO events (id, session_id, timestamp, agent, action, status, risk_level, raw_json)
				 VALUES ('evt_corrupt', 'ses_x', '2026-01-01T00:00:00.000Z', 'claude-code', 'file_read', 'completed', 'low', '{"broken":true}')`
			).run();

			const events = store.readAll();
			expect(events).toHaveLength(1); // only the valid one
			expect(store.lastReadErrors).toBe(1);
		});
	});

	describe("schema_version and idempotency_key", () => {
		it("accepts schema_version: 1", () => {
			const event = makeEvent({ schema_version: 1 });
			store.append(event);
			const events = store.readAll();
			expect(events[0].schema_version).toBe(1);
		});

		it("accepts schema_version: undefined (backward compat)", () => {
			const event = makeEvent();
			store.append(event);
			const events = store.readAll();
			expect(events[0].schema_version).toBeUndefined();
		});

		it("rejects schema_version: 2 (unknown future version)", () => {
			const event = makeEvent({ schema_version: 2 as any });
			expect(() => store.append(event)).toThrow(/Invalid event/);
		});

		it("stores and retrieves idempotency_key", () => {
			const event = makeEvent({ idempotency_key: "ses_test:PostToolUse:file_read:tu_123" });
			store.append(event);
			const events = store.readAll();
			expect(events[0].idempotency_key).toBe("ses_test:PostToolUse:file_read:tu_123");
		});
	});
});
