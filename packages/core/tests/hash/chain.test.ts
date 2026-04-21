import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	canonicalize,
	computeEventHash,
	verifyChain,
} from "../../src/hash/chain.js";
import { JsonlStore } from "../../src/store/jsonl.js";
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

function makeRawEvent(overrides: Partial<AuditEvent> = {}): Record<string, unknown> {
	return makeEvent(overrides) as Record<string, unknown>;
}

describe("canonicalize", () => {
	it("sorts object keys deterministically", () => {
		const a = canonicalize({ z: 1, a: 2, m: 3 });
		const b = canonicalize({ a: 2, m: 3, z: 1 });
		expect(a).toBe(b);
		expect(a).toBe('{"a":2,"m":3,"z":1}');
	});

	it("handles nested objects with stable ordering", () => {
		const a = canonicalize({ b: { z: 1, a: 2 }, a: 1 });
		const b = canonicalize({ a: 1, b: { a: 2, z: 1 } });
		expect(a).toBe(b);
		expect(a).toBe('{"a":1,"b":{"a":2,"z":1}}');
	});

	it("preserves array element order", () => {
		const result = canonicalize({ items: [3, 1, 2] });
		expect(result).toBe('{"items":[3,1,2]}');
	});

	it("handles null and primitives", () => {
		expect(canonicalize(null)).toBe("null");
		expect(canonicalize("hello")).toBe('"hello"');
		expect(canonicalize(42)).toBe("42");
		expect(canonicalize(true)).toBe("true");
	});

	it("omits undefined values", () => {
		const result = canonicalize({ a: 1, b: undefined, c: 3 });
		expect(result).toBe('{"a":1,"c":3}');
	});
});

describe("computeEventHash", () => {
	it("returns sha256-prefixed hex string", () => {
		const event = { id: "evt_1", action: "file_read" };
		const hash = computeEventHash(event);
		expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
	});

	it("excludes event_hash from computation", () => {
		const event = { id: "evt_1", action: "file_read" };
		const hashWithout = computeEventHash(event);
		const hashWith = computeEventHash({
			...event,
			event_hash: "sha256:something",
		});
		expect(hashWithout).toBe(hashWith);
	});

	it("includes prev_hash in computation", () => {
		const base = { id: "evt_1", action: "file_read" };
		const h1 = computeEventHash({ ...base, prev_hash: null });
		const h2 = computeEventHash({
			...base,
			prev_hash: "sha256:abc",
		});
		expect(h1).not.toBe(h2);
	});

	it("produces different hashes for different events", () => {
		const h1 = computeEventHash({ id: "evt_1", action: "file_read" });
		const h2 = computeEventHash({ id: "evt_2", action: "file_read" });
		expect(h1).not.toBe(h2);
	});

	it("is deterministic across calls", () => {
		const event = {
			id: "evt_1",
			session_id: "ses_1",
			action: "file_read",
			prev_hash: null,
		};
		const h1 = computeEventHash(event);
		const h2 = computeEventHash(event);
		expect(h1).toBe(h2);
	});
});

describe("JsonlStore hash chain", () => {
	let tmpDir: string;
	let store: JsonlStore;
	let filePath: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-chain-test-"));
		filePath = join(tmpDir, "events.jsonl");
		store = new JsonlStore(filePath);
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	function readRawEvents(): Record<string, unknown>[] {
		return readFileSync(filePath, "utf-8")
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line));
	}

	it("sets prev_hash to null for the first event", () => {
		store.append(makeEvent());
		const events = readRawEvents();
		expect(events[0].prev_hash).toBeNull();
	});

	it("sets event_hash as sha256-prefixed string", () => {
		store.append(makeEvent());
		const events = readRawEvents();
		expect(events[0].event_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
	});

	it("chains prev_hash to previous event_hash", () => {
		store.append(makeEvent({ id: "evt_1" }));
		store.append(makeEvent({ id: "evt_2" }));
		const events = readRawEvents();
		expect(events[1].prev_hash).toBe(events[0].event_hash);
	});

	it("builds a continuous chain across multiple events", () => {
		for (let i = 0; i < 5; i++) {
			store.append(makeEvent({ id: `evt_${i}` }));
		}
		const events = readRawEvents();
		expect(events[0].prev_hash).toBeNull();
		for (let i = 1; i < events.length; i++) {
			expect(events[i].prev_hash).toBe(events[i - 1].event_hash);
		}
	});

	it("produces verifiable hashes (recomputed matches stored)", () => {
		store.append(makeEvent({ id: "evt_1" }));
		store.append(makeEvent({ id: "evt_2" }));
		const events = readRawEvents();
		for (const event of events) {
			const recomputed = computeEventHash(event);
			expect(recomputed).toBe(event.event_hash);
		}
	});

	it("does not overwrite caller-provided fields other than chain fields", () => {
		const event = makeEvent({
			id: "evt_custom",
			action: "file_write",
			content: { hash: "sha256:abc", redacted: true },
		});
		store.append(event);
		const events = readRawEvents();
		expect(events[0].action).toBe("file_write");
		expect((events[0].content as Record<string, unknown>).hash).toBe("sha256:abc");
	});
});

describe("verifyChain", () => {
	it("returns valid for an empty log", () => {
		const result = verifyChain([]);
		expect(result.is_valid).toBe(true);
		expect(result.total_events).toBe(0);
	});

	it("returns valid for a correct chain", () => {
		// Build a valid chain manually
		const e1: Record<string, unknown> = {
			id: "evt_1",
			session_id: "ses_1",
			timestamp: "2026-01-01T00:00:00.000Z",
			agent: "claude-code",
			action: "file_read",
			risk: { level: "low", flags: [] },
			prev_hash: null,
		};
		e1.event_hash = computeEventHash(e1);

		const e2: Record<string, unknown> = {
			id: "evt_2",
			session_id: "ses_1",
			timestamp: "2026-01-01T00:00:01.000Z",
			agent: "claude-code",
			action: "file_write",
			risk: { level: "medium", flags: [] },
			prev_hash: e1.event_hash,
		};
		e2.event_hash = computeEventHash(e2);

		const result = verifyChain([e1, e2]);
		expect(result.is_valid).toBe(true);
		expect(result.chained_events).toBe(2);
		expect(result.hash_mismatch_count).toBe(0);
		expect(result.prev_link_mismatch_count).toBe(0);
	});

	it("detects hash tampering (field modification)", () => {
		const e1 = makeRawEvent({
			id: "evt_1",
			action: "file_read",
			prev_hash: null,
		});
		e1.event_hash = computeEventHash(e1);

		// Tamper with the action after hashing
		const tampered = { ...e1, action: "command_execute" };

		const result = verifyChain([tampered]);
		expect(result.is_valid).toBe(false);
		expect(result.hash_mismatch_count).toBe(1);
		expect(result.first_failure_index).toBe(0);
	});

	it("detects broken prev_hash link", () => {
		const e1 = makeRawEvent({
			id: "evt_1",
			action: "file_read",
			prev_hash: null,
		});
		e1.event_hash = computeEventHash(e1);

		const e2 = makeRawEvent({
			id: "evt_2",
			action: "file_write",
			prev_hash: "sha256:wrong_hash", // broken link
		});
		e2.event_hash = computeEventHash(e2);

		const result = verifyChain([e1, e2]);
		expect(result.is_valid).toBe(false);
		expect(result.prev_link_mismatch_count).toBe(1);
		expect(result.first_failure_index).toBe(1);
	});

	it("counts legacy events (no event_hash)", () => {
		const legacy = makeRawEvent({ id: "evt_legacy", action: "file_read" });
		const result = verifyChain([legacy]);
		expect(result.is_valid).toBe(true);
		expect(result.legacy_events).toBe(1);
		expect(result.chained_events).toBe(0);
	});

	it("handles mixed legacy and chained events", () => {
		const legacy = makeRawEvent({ id: "evt_legacy", action: "file_read" });
		const chained = makeRawEvent({
			id: "evt_1",
			action: "file_write",
			prev_hash: null,
		});
		chained.event_hash = computeEventHash(chained);

		const result = verifyChain([legacy, chained]);
		expect(result.is_valid).toBe(true);
		expect(result.legacy_events).toBe(1);
		expect(result.chained_events).toBe(1);
	});

	it("reports first_failure_index accurately", () => {
		const events: Record<string, unknown>[] = [];
		// Build 3 valid events
		for (let i = 0; i < 3; i++) {
			const e = makeRawEvent({
				id: `evt_${i}`,
				action: "file_read",
				prev_hash: i === 0 ? null : events[i - 1].event_hash,
			});
			e.event_hash = computeEventHash(e);
			events.push(e);
		}
		// Tamper with event at index 2
		events[2] = { ...events[2], action: "command_execute" };

		const result = verifyChain(events);
		expect(result.is_valid).toBe(false);
		expect(result.first_failure_index).toBe(2);
	});

	it("fails closed when an event is schema-invalid", () => {
		const invalid = { id: "evt_bad" } as Record<string, unknown>;
		const result = verifyChain([invalid]);
		expect(result.is_valid).toBe(false);
		expect(result.invalid_schema_events).toBe(1);
		expect(result.first_failure_index).toBe(0);
	});

	it("integrates with JsonlStore end-to-end", () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "patchwork-verify-test-"));
		const filePath = join(tmpDir, "events.jsonl");
		const store = new JsonlStore(filePath);

		store.append(makeEvent({ id: "evt_1" }));
		store.append(makeEvent({ id: "evt_2" }));
		store.append(makeEvent({ id: "evt_3" }));

		const raw = readFileSync(filePath, "utf-8")
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line));

		const result = verifyChain(raw);
		expect(result.is_valid).toBe(true);
		expect(result.chained_events).toBe(3);
		expect(result.hash_mismatch_count).toBe(0);
		expect(result.prev_link_mismatch_count).toBe(0);

		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("treats a non-null first prev_hash as a chain anchor, not a mismatch", () => {
		// Simulates a log rotated or compacted from an earlier chain: the first
		// event points to a prior tip that isn't in this file.
		const anchorHash = "sha256:843fadacca1649d8eec3efa75095b57654e894df7f23b3b68018d538e3845de5";
		const e1 = makeRawEvent({
			id: "evt_rooted",
			action: "file_read",
			prev_hash: anchorHash,
		});
		e1.event_hash = computeEventHash(e1);
		const e2 = makeRawEvent({
			id: "evt_next",
			action: "file_read",
			prev_hash: e1.event_hash as string,
		});
		e2.event_hash = computeEventHash(e2);

		const result = verifyChain([e1, e2]);

		expect(result.is_valid).toBe(true);
		expect(result.prev_link_mismatch_count).toBe(0);
		expect(result.chain_anchor_hash).toBe(anchorHash);
	});

	it("sets chain_anchor_hash to null for genesis-rooted logs", () => {
		const e1 = makeRawEvent({
			id: "evt_genesis",
			action: "file_read",
			prev_hash: null,
		});
		e1.event_hash = computeEventHash(e1);

		const result = verifyChain([e1]);
		expect(result.is_valid).toBe(true);
		expect(result.chain_anchor_hash).toBeNull();
	});
});

describe("verifyEventHashes (per-event tamper check)", () => {
	it("passes a set of non-contiguous events whose hashes self-verify", async () => {
		// Simulate events from one session that have events from other sessions
		// interleaved in the global chain — their prev_hash fields point to
		// events NOT in this slice, which would fail verifyChain but must not
		// fail a per-event integrity check.
		const { verifyEventHashes } = await import("../../src/hash/chain.js");
		const e1 = makeRawEvent({
			id: "evt_a",
			action: "file_read",
			prev_hash: "sha256:from-another-session-1",
		});
		e1.event_hash = computeEventHash(e1);
		const e2 = makeRawEvent({
			id: "evt_b",
			action: "file_write",
			prev_hash: "sha256:from-another-session-2",
		});
		e2.event_hash = computeEventHash(e2);

		const result = verifyEventHashes([e1, e2]);
		expect(result.is_valid).toBe(true);
		expect(result.hash_mismatch_count).toBe(0);
	});

	it("catches tampering with an individual event", async () => {
		const { verifyEventHashes } = await import("../../src/hash/chain.js");
		const e1 = makeRawEvent({
			id: "evt_a",
			action: "file_read",
			prev_hash: null,
		});
		e1.event_hash = computeEventHash(e1);

		// Tamper with the action after hashing
		const tampered = { ...e1, action: "command_execute" };

		const result = verifyEventHashes([tampered]);
		expect(result.is_valid).toBe(false);
		expect(result.hash_mismatch_count).toBe(1);
		expect(result.first_failure_index).toBe(0);
	});

	it("counts unhashed (legacy) events separately from mismatches", async () => {
		const { verifyEventHashes } = await import("../../src/hash/chain.js");
		const legacy = makeRawEvent({ id: "evt_legacy", action: "file_read" });
		const result = verifyEventHashes([legacy]);
		expect(result.is_valid).toBe(true);
		expect(result.unhashed_count).toBe(1);
		expect(result.hash_mismatch_count).toBe(0);
	});
});
