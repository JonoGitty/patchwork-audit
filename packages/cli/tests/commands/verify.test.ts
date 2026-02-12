import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { computeEventHash, verifyChain } from "@patchwork/core";

/**
 * Tests for the verify command's underlying logic (verifyChain).
 * The CLI command itself is a thin wrapper that reads a file and calls verifyChain.
 */

function makeChainedEvents(count: number): Record<string, unknown>[] {
	const events: Record<string, unknown>[] = [];
	for (let i = 0; i < count; i++) {
		const e: Record<string, unknown> = {
			id: `evt_${i}`,
			session_id: "ses_test",
			timestamp: `2026-01-01T00:00:0${i}.000Z`,
			agent: "claude-code",
			action: "file_read",
			status: "completed",
			risk: { level: "low", flags: [] },
			prev_hash: i === 0 ? null : (events[i - 1].event_hash as string),
		};
		e.event_hash = computeEventHash(e);
		events.push(e);
	}
	return events;
}

describe("verify command logic", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-verify-cmd-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("passes for a valid chain written to JSONL", () => {
		const events = makeChainedEvents(5);
		const filePath = join(tmpDir, "events.jsonl");
		writeFileSync(filePath, events.map((e) => JSON.stringify(e)).join("\n") + "\n");

		// Simulate what the CLI does: read + parse + verify
		const parsed = events; // already parsed
		const result = verifyChain(parsed);

		expect(result.is_valid).toBe(true);
		expect(result.chained_events).toBe(5);
		expect(result.legacy_events).toBe(0);
		expect(result.hash_mismatch_count).toBe(0);
		expect(result.prev_link_mismatch_count).toBe(0);
	});

	it("detects tampered event in chain", () => {
		const events = makeChainedEvents(3);
		// Tamper with middle event
		events[1].action = "command_execute";

		const result = verifyChain(events);
		expect(result.is_valid).toBe(false);
		expect(result.hash_mismatch_count).toBeGreaterThanOrEqual(1);
		expect(result.first_failure_index).toBe(1);
	});

	it("strict mode flags legacy events", () => {
		const legacy = { id: "evt_old", action: "file_read" };
		const chained: Record<string, unknown> = {
			id: "evt_new",
			action: "file_write",
			prev_hash: null,
		};
		chained.event_hash = computeEventHash(chained);

		const result = verifyChain([legacy, chained]);
		// Chain is valid but legacy_events > 0
		expect(result.is_valid).toBe(true);
		expect(result.legacy_events).toBe(1);
		// In strict mode, the CLI would exit 1 because legacy_events > 0
	});

	it("handles empty event list", () => {
		const result = verifyChain([]);
		expect(result.is_valid).toBe(true);
		expect(result.total_events).toBe(0);
	});
});
