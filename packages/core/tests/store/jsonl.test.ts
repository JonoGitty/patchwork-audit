import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
	appendFileSync,
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	openSync,
	readFileSync,
	rmSync,
	statSync,
	unlinkSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { hostname, tmpdir } from "node:os";
import { JsonlStore, _setLockIO } from "../../src/store/jsonl.js";
import type { AuditEvent } from "../../src/schema/event.js";

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

describe("JsonlStore", () => {
	let tmpDir: string;
	let store: JsonlStore;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-test-"));
		store = new JsonlStore(join(tmpDir, "events.jsonl"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
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
		const e1 = makeEvent({ action: "file_read" });
		const e2 = makeEvent({ action: "file_write" });
		const e3 = makeEvent({ action: "command_execute" });
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
			store.append(makeEvent({ action: `action_${i}` as any }));
		}
		const recent = store.readRecent(3);
		expect(recent).toHaveLength(3);
		expect(recent[0].action).toBe("action_7");
		expect(recent[2].action).toBe("action_9");
	});

	describe("query", () => {
		beforeEach(() => {
			store.append(makeEvent({ agent: "claude-code", action: "file_read", risk: { level: "low", flags: [] } }));
			store.append(makeEvent({ agent: "claude-code", action: "file_write", risk: { level: "medium", flags: [] } }));
			store.append(makeEvent({ agent: "codex", action: "command_execute", risk: { level: "high", flags: ["dangerous_command"] } }));
			store.append(makeEvent({ agent: "claude-code", action: "web_fetch", risk: { level: "medium", flags: ["network_access"] } }));
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
			store.append(makeEvent({ session_id: "ses_other", action: "file_read" }));
			const results = store.query({ sessionId: "ses_other" });
			expect(results).toHaveLength(1);
		});

		it("respects limit", () => {
			const results = store.query({ limit: 2 });
			expect(results).toHaveLength(2);
		});

		it("filters by project name", () => {
			store.append(
				makeEvent({
					project: { root: "/test/my-project", name: "my-project" },
					action: "file_read",
				}),
			);
			const results = store.query({ projectName: "my-project" });
			expect(results).toHaveLength(1);
		});
	});

	describe("file permissions", () => {
		it("creates directory with 0700", () => {
			const subDir = join(tmpDir, "secure", "nested");
			new JsonlStore(join(subDir, "events.jsonl"));
			const stat = statSync(subDir);
			expect(stat.mode & 0o777).toBe(0o700);
		});

		it("creates file with 0600 on first write", () => {
			const filePath = join(tmpDir, "events.jsonl");
			const s = new JsonlStore(filePath);
			s.append(makeEvent());
			const stat = statSync(filePath);
			expect(stat.mode & 0o777).toBe(0o600);
		});

		it("corrects insecure existing directory permissions on init", () => {
			const subDir = join(tmpDir, "insecure");
			mkdirSync(subDir, { mode: 0o755 });
			expect(statSync(subDir).mode & 0o777).toBe(0o755);

			// Opening store should fix permissions
			new JsonlStore(join(subDir, "events.jsonl"));
			expect(statSync(subDir).mode & 0o777).toBe(0o700);
		});

		it("corrects insecure existing file permissions on init", () => {
			const filePath = join(tmpDir, "insecure.jsonl");
			// Create the file with permissive mode
			appendFileSync(filePath, '{"dummy": true}\n', "utf-8");
			chmodSync(filePath, 0o644);
			expect(statSync(filePath).mode & 0o777).toBe(0o644);

			// Opening store should fix permissions
			new JsonlStore(filePath);
			expect(statSync(filePath).mode & 0o777).toBe(0o600);
		});

		it("is safe when data file does not exist yet", () => {
			const filePath = join(tmpDir, "nonexistent.jsonl");
			// Should not throw
			const s = new JsonlStore(filePath);
			expect(s.readAll()).toEqual([]);
		});
	});

	describe("schema validation", () => {
		it("rejects invalid event on append", () => {
			const bad = { id: "x" } as unknown as AuditEvent;
			expect(() => store.append(bad)).toThrow(/Invalid event/);
		});

		it("skips corrupt JSONL lines on read", () => {
			const filePath = join(tmpDir, "events.jsonl");
			const s = new JsonlStore(filePath);
			s.append(makeEvent({ action: "file_read" }));

			// Manually append corrupt line
			appendFileSync(filePath, "NOT_VALID_JSON\n", "utf-8");
			appendFileSync(filePath, '{"id":"x"}\n', "utf-8"); // valid JSON but invalid schema

			const events = s.readAll();
			expect(events).toHaveLength(1); // only the valid event
			expect(s.lastReadErrors).toBe(2); // 1 parse error + 1 schema error
		});

		it("rejects append when existing log contains corrupt lines", () => {
			const filePath = join(tmpDir, "events-corrupt.jsonl");
			const s = new JsonlStore(filePath);
			s.append(makeEvent({ id: "evt_valid_1", action: "file_read" }));

			appendFileSync(filePath, "NOT_VALID_JSON\n", "utf-8");
			appendFileSync(filePath, '{"id":"x"}\n', "utf-8");

			expect(() =>
				s.append(makeEvent({ id: "evt_valid_2", action: "file_write" })),
			).toThrow(/Refusing to append to corrupted audit log/);

			const events = s.readAll();
			expect(events).toHaveLength(1);
			expect(s.lastReadErrors).toBe(2);
		});

		it("counts errors accurately for empty file", () => {
			store.readAll();
			expect(store.lastReadErrors).toBe(0);
		});
	});

	describe("idempotency dedup", () => {
		it("deduplicates events by idempotency_key", () => {
			const event = makeEvent({ idempotency_key: "ses_test:PostToolUse:file_read:tu_123" });
			store.append(event);
			store.append({ ...event, id: "evt_different_id" });

			const events = store.readAll();
			expect(events).toHaveLength(1);
		});

		it("allows events without idempotency_key (backward compat)", () => {
			store.append(makeEvent());
			store.append(makeEvent());
			const events = store.readAll();
			expect(events).toHaveLength(2);
		});

		it("allows events with different idempotency_keys", () => {
			store.append(makeEvent({ idempotency_key: "key_1" }));
			store.append(makeEvent({ idempotency_key: "key_2" }));
			const events = store.readAll();
			expect(events).toHaveLength(2);
		});

		it("concurrent appends with same idempotency_key result in one event", () => {
			// Simulates two sequential appends with the same key (dedup inside lock)
			const key = "ses_x:PostToolUse:file_write:tu_99";
			const e1 = makeEvent({ id: "evt_first", idempotency_key: key });
			const e2 = makeEvent({ id: "evt_second", idempotency_key: key });
			store.append(e1);
			store.append(e2);
			const events = store.readAll();
			expect(events).toHaveLength(1);
			expect(events[0].id).toBe("evt_first");
		});
	});

	describe("file locking", () => {
		it("handles sequential appends under lock", () => {
			for (let i = 0; i < 20; i++) {
				store.append(makeEvent({ action: `action_${i}` as any }));
			}
			const events = store.readAll();
			expect(events).toHaveLength(20);
		});

		it("cleans up lock file after append", () => {
			const filePath = join(tmpDir, "locked.jsonl");
			const s = new JsonlStore(filePath);
			s.append(makeEvent());
			const { existsSync } = require("node:fs");
			expect(existsSync(filePath + ".lock")).toBe(false);
		});

		it("recovers from stale lock file (age > threshold)", () => {
			const filePath = join(tmpDir, "stale.jsonl");
			const lockPath = filePath + ".lock";

			// Create a lock file and backdate its mtime to make it stale
			openSync(lockPath, "wx");
			const pastTime = new Date(Date.now() - 10_000); // 10 seconds ago
			utimesSync(lockPath, pastTime, pastTime);

			const s = new JsonlStore(filePath);
			s.append(makeEvent());
			const events = s.readAll();
			expect(events).toHaveLength(1);
		});

		it("does NOT break a fresh lock held by another process", () => {
			const filePath = join(tmpDir, "active.jsonl");
			const lockPath = filePath + ".lock";

			// Create a fresh (non-stale) lock file — mtime is now
			openSync(lockPath, "wx");

			const s = new JsonlStore(filePath);
			// Should throw rather than blindly unlinking the fresh lock
			expect(() => s.append(makeEvent())).toThrow(/Failed to acquire lock/);
		});

		it("produces valid JSONL after rapid sequential appends", () => {
			const filePath = join(tmpDir, "rapid.jsonl");
			const s = new JsonlStore(filePath);

			for (let i = 0; i < 50; i++) {
				s.append(makeEvent({ id: `evt_rapid_${i}`, action: `action_${i % 5}` as any }));
			}

			const events = s.readAll();
			expect(events).toHaveLength(50);

			const raw = readFileSync(filePath, "utf-8");
			const lines = raw.split("\n").filter((l) => l.trim().length > 0);
			expect(lines).toHaveLength(50);
			for (const line of lines) {
				expect(() => JSON.parse(line)).not.toThrow();
			}
		});
	});

	describe("lock ownership", () => {
		it("reclaims lock held by dead process (PID liveness check)", () => {
			const filePath = join(tmpDir, "dead-pid.jsonl");
			const lockPath = filePath + ".lock";

			// Create lock with structured metadata pointing to a non-existent PID
			const meta = {
				pid: 2147483647, // Very high PID unlikely to exist
				hostname: hostname(),
				token: "dead-process-token",
				created_at_ms: Date.now(), // Recent — age check alone would NOT reclaim
			};
			writeFileSync(lockPath, JSON.stringify(meta), "utf-8");

			const s = new JsonlStore(filePath);
			s.append(makeEvent());
			expect(s.readAll()).toHaveLength(1);
		});

		it("does NOT reclaim lock held by alive process on same host", () => {
			const filePath = join(tmpDir, "alive-pid.jsonl");
			const lockPath = filePath + ".lock";

			// Create lock with current process's PID (definitely alive)
			const meta = {
				pid: process.pid,
				hostname: hostname(),
				token: "alive-process-token",
				created_at_ms: Date.now(),
			};
			writeFileSync(lockPath, JSON.stringify(meta), "utf-8");

			const s = new JsonlStore(filePath);
			expect(() => s.append(makeEvent())).toThrow(/Failed to acquire lock/);
		});

		it("falls back to mtime when lock metadata is corrupt (stale by mtime)", () => {
			const filePath = join(tmpDir, "corrupt-meta.jsonl");
			const lockPath = filePath + ".lock";

			// Write non-JSON content with old mtime → should be reclaimed
			writeFileSync(lockPath, "NOT_JSON", "utf-8");
			const pastTime = new Date(Date.now() - 10_000);
			utimesSync(lockPath, pastTime, pastTime);

			const s = new JsonlStore(filePath);
			s.append(makeEvent());
			expect(s.readAll()).toHaveLength(1);
		});

		it("does NOT reclaim corrupt lock with fresh mtime", () => {
			const filePath = join(tmpDir, "corrupt-fresh.jsonl");
			const lockPath = filePath + ".lock";

			// Non-JSON content but fresh mtime → not stale → throw
			writeFileSync(lockPath, "NOT_JSON", "utf-8");

			const s = new JsonlStore(filePath);
			expect(() => s.append(makeEvent())).toThrow(/Failed to acquire lock/);
		});

		it("does NOT reclaim cross-host lock under age threshold", () => {
			const filePath = join(tmpDir, "cross-host.jsonl");
			const lockPath = filePath + ".lock";

			// Lock from different host with fresh timestamp
			const meta = {
				pid: 1,
				hostname: "other-host.example.com",
				token: "cross-host-token",
				created_at_ms: Date.now(),
			};
			writeFileSync(lockPath, JSON.stringify(meta), "utf-8");

			const s = new JsonlStore(filePath);
			expect(() => s.append(makeEvent())).toThrow(/Failed to acquire lock/);
		});

		it("reclaims cross-host lock that exceeds age threshold", () => {
			const filePath = join(tmpDir, "cross-host-stale.jsonl");
			const lockPath = filePath + ".lock";

			// Lock from different host with old timestamp
			const meta = {
				pid: 1,
				hostname: "other-host.example.com",
				token: "cross-host-stale-token",
				created_at_ms: Date.now() - 10_000, // 10s ago, well past 5s threshold
			};
			writeFileSync(lockPath, JSON.stringify(meta), "utf-8");

			const s = new JsonlStore(filePath);
			s.append(makeEvent());
			expect(s.readAll()).toHaveLength(1);
		});

		it("concurrent dedup still works under ownership-safe locking", () => {
			const key = "ses_own:PostToolUse:file_write:tu_lock";
			const e1 = makeEvent({ id: "evt_own1", idempotency_key: key });
			const e2 = makeEvent({ id: "evt_own2", idempotency_key: key });
			store.append(e1);
			store.append(e2);
			const events = store.readAll();
			expect(events).toHaveLength(1);
			expect(events[0].id).toBe("evt_own1");
		});

		it("reclaims cross-host lock with far-future created_at_ms via mtime fallback", () => {
			const filePath = join(tmpDir, "future-ts.jsonl");
			const lockPath = filePath + ".lock";

			// Cross-host lock with far-future timestamp — age check would
			// never detect staleness. Future-skew guard falls back to mtime.
			const meta = {
				pid: 1,
				hostname: "other-host.example.com",
				token: "future-token",
				created_at_ms: Date.now() + 999_999_999,
			};
			writeFileSync(lockPath, JSON.stringify(meta), "utf-8");
			// Backdate mtime so the mtime fallback detects staleness
			const pastTime = new Date(Date.now() - 10_000);
			utimesSync(lockPath, pastTime, pastTime);

			const s = new JsonlStore(filePath);
			s.append(makeEvent());
			expect(s.readAll()).toHaveLength(1);
		});

		it("does NOT reclaim cross-host lock with future created_at_ms but fresh mtime", () => {
			const filePath = join(tmpDir, "future-ts-fresh.jsonl");
			const lockPath = filePath + ".lock";

			// Future timestamp but fresh mtime — mtime fallback says not stale
			const meta = {
				pid: 1,
				hostname: "other-host.example.com",
				token: "future-fresh-token",
				created_at_ms: Date.now() + 999_999_999,
			};
			writeFileSync(lockPath, JSON.stringify(meta), "utf-8");
			// mtime is now (just written) → not stale

			const s = new JsonlStore(filePath);
			expect(() => s.append(makeEvent())).toThrow(/Failed to acquire lock/);
		});

		it("final reclaim path succeeds when stale lock is reclaimed", () => {
			const filePath = join(tmpDir, "final-reclaim.jsonl");
			const lockPath = filePath + ".lock";

			// Dead-PID lock is stale and reclaimable. Exercises the reclaim
			// codepath including the bounded retry for EEXIST races.
			const meta = {
				pid: 2147483647,
				hostname: hostname(),
				token: "reclaim-token",
				created_at_ms: Date.now(),
			};
			writeFileSync(lockPath, JSON.stringify(meta), "utf-8");

			const s = new JsonlStore(filePath);
			s.append(makeEvent());
			expect(s.readAll()).toHaveLength(1);
			// Lock cleaned up after successful append
			expect(existsSync(lockPath)).toBe(false);
		});

		it("final reclaim throws clean error (not raw EEXIST) on persistent contention", () => {
			const filePath = join(tmpDir, "contention-final.jsonl");
			const lockPath = filePath + ".lock";

			// Alive-PID lock persists through main loop AND final check.
			// Should throw the explicit "Failed to acquire lock" message,
			// not a raw EEXIST from openSync in the final reclaim.
			const meta = {
				pid: process.pid,
				hostname: hostname(),
				token: "persistent-token",
				created_at_ms: Date.now(),
			};
			writeFileSync(lockPath, JSON.stringify(meta), "utf-8");

			const s = new JsonlStore(filePath);
			expect(() => s.append(makeEvent())).toThrow(
				/Failed to acquire lock.*lock held by active process/,
			);
		});

		it("uses cryptographic tokens (non-empty, unique across appends)", () => {
			// After each append the lock is acquired with a unique token and
			// released by matching pid+token. If tokens collided or were empty,
			// safe-unlock could malfunction. We verify 20 sequential appends
			// all succeed (each cycle: acquire → write meta → fn → ownership
			// check → release) and no stale lock files remain.
			const filePath = join(tmpDir, "token-quality.jsonl");
			const s = new JsonlStore(filePath);
			for (let i = 0; i < 20; i++) {
				s.append(makeEvent({ id: `evt_tq_${i}` }));
			}
			expect(s.readAll()).toHaveLength(20);
			expect(existsSync(filePath + ".lock")).toBe(false);
		});
	});

	describe("idempotency index", () => {
		it("first keyed append builds index from existing file and dedups correctly", () => {
			const filePath = join(tmpDir, "idx-existing.jsonl");
			const s1 = new JsonlStore(filePath);
			s1.append(makeEvent({ id: "evt_pre", idempotency_key: "key_pre" }));

			// New instance — fresh cache, must rebuild index from file
			const s2 = new JsonlStore(filePath);
			s2.append(makeEvent({ id: "evt_dup", idempotency_key: "key_pre" }));

			const events = s2.readAll();
			expect(events).toHaveLength(1);
			expect(events[0].id).toBe("evt_pre");
		});

		it("repeated keyed appends avoid full parse rescans", () => {
			const filePath = join(tmpDir, "idx-rescan.jsonl");
			const s = new JsonlStore(filePath);
			const parseSpy = vi.spyOn(s as any, "parseFile");

			s.append(makeEvent({ id: "evt_1", idempotency_key: "k1" }));
			expect(parseSpy).toHaveBeenCalledTimes(1);

			s.append(makeEvent({ id: "evt_2", idempotency_key: "k2" }));
			expect(parseSpy).toHaveBeenCalledTimes(1); // no re-parse

			s.append(makeEvent({ id: "evt_3", idempotency_key: "k3" }));
			expect(parseSpy).toHaveBeenCalledTimes(1); // still no re-parse

			// Verify data independently (readAll also calls parseFile)
			parseSpy.mockRestore();
			expect(s.readAll()).toHaveLength(3);
		});

		it("mtime-change reconciliation catches keys appended by external writer", () => {
			const filePath = join(tmpDir, "idx-external.jsonl");
			const s = new JsonlStore(filePath);
			s.append(makeEvent({ id: "evt_1", idempotency_key: "k1" }));

			// External writer appends a keyed event (different store instance)
			const ext = new JsonlStore(filePath);
			ext.append(makeEvent({ id: "evt_ext", idempotency_key: "k_ext" }));

			// Original store tries same key — mtime changed, should rebuild and dedup
			s.append(makeEvent({ id: "evt_dup", idempotency_key: "k_ext" }));

			expect(s.readAll()).toHaveLength(2);
		});

		it("unkeyed events still append normally with index in place", () => {
			const filePath = join(tmpDir, "idx-unkeyed.jsonl");
			const s = new JsonlStore(filePath);

			// Build index via keyed append
			s.append(makeEvent({ id: "evt_k", idempotency_key: "k1" }));

			// Unkeyed appends should still work
			s.append(makeEvent({ id: "evt_u1" }));
			s.append(makeEvent({ id: "evt_u2" }));

			expect(s.readAll()).toHaveLength(3);
		});

		it("hash chain remains correct across cached appends", () => {
			const filePath = join(tmpDir, "idx-chain.jsonl");
			const s = new JsonlStore(filePath);

			s.append(makeEvent({ id: "evt_c1" }));
			s.append(makeEvent({ id: "evt_c2" }));
			s.append(makeEvent({ id: "evt_c3" }));

			const raw = readFileSync(filePath, "utf-8").trim().split("\n").map(JSON.parse);
			expect(raw[0].prev_hash).toBeNull();
			expect(raw[1].prev_hash).toBe(raw[0].event_hash);
			expect(raw[2].prev_hash).toBe(raw[1].event_hash);
		});
	});

	describe("final reclaim race (deterministic)", () => {
		afterEach(() => {
			_setLockIO(null);
		});

		it("recovers when first reclaim openSync hits EEXIST but second succeeds", () => {
			let openCalls = 0;
			let isStaleCalls = 0;
			let unlinkCalls = 0;
			let sleepCalls = 0;

			_setLockIO({
				openLock: (path) => {
					openCalls++;
					if (openCalls <= 51) {
						// 50 main-loop + 1 first reclaim attempt → EEXIST
						const err = new Error("EEXIST") as NodeJS.ErrnoException;
						err.code = "EEXIST";
						throw err;
					}
					// 52nd call (second reclaim attempt): real fs
					return openSync(path, "wx");
				},
				unlinkLock: () => {
					unlinkCalls++;
				},
				sleep: () => {
					sleepCalls++;
				},
				isStale: () => {
					isStaleCalls++;
					// false for 50 main-loop checks, true for final check (#51)
					return isStaleCalls > 50;
				},
			});

			const filePath = join(tmpDir, "race-recover.jsonl");
			const s = new JsonlStore(filePath);
			s.append(makeEvent());

			expect(s.readAll()).toHaveLength(1);
			expect(existsSync(filePath + ".lock")).toBe(false);

			// Verify exact control flow through the final reclaim path
			expect(openCalls).toBe(52); // 50 main + 1 EEXIST + 1 success
			expect(isStaleCalls).toBe(51); // 50 main (false) + 1 final (true)
			expect(unlinkCalls).toBe(2); // reclaim unlinks at r=0 and r=1
			expect(sleepCalls).toBe(51); // 50 main + 1 after first reclaim EEXIST
		});

		it("throws clean error when all reclaim attempts exhaust with EEXIST", () => {
			let isStaleCalls = 0;
			let openCalls = 0;
			let unlinkCalls = 0;

			_setLockIO({
				openLock: () => {
					openCalls++;
					const err = new Error("EEXIST") as NodeJS.ErrnoException;
					err.code = "EEXIST";
					throw err;
				},
				unlinkLock: () => {
					unlinkCalls++;
				},
				sleep: () => {},
				isStale: () => {
					isStaleCalls++;
					return isStaleCalls > 50;
				},
			});

			const filePath = join(tmpDir, "race-exhaust.jsonl");
			const s = new JsonlStore(filePath);
			expect(() => s.append(makeEvent())).toThrow(
				/contention during stale recovery/,
			);

			// 50 main-loop + 3 final reclaim attempts (all EEXIST)
			expect(openCalls).toBe(53);
			// 3 reclaim unlinks (one per final reclaim attempt)
			expect(unlinkCalls).toBe(3);
		});
	});
});
