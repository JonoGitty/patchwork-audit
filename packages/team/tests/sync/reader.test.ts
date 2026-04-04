import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readNewEvents } from "../../src/sync/reader.js";

function makeEventLine(id: string, action = "file_read"): string {
	return JSON.stringify({
		id,
		session_id: "ses_1",
		timestamp: new Date().toISOString(),
		agent: "claude-code",
		action,
		status: "completed",
		risk: { level: "low", flags: [] },
		event_hash: `sha256:${id}`,
		prev_hash: null,
		_relay_hash: `sha256:relay_${id}`,
	});
}

function makeHeartbeat(): string {
	return JSON.stringify({
		type: "heartbeat",
		timestamp: new Date().toISOString(),
		relay_chain_tip: null,
		relay_event_count: 0,
		uptime_ms: 1000,
	});
}

describe("readNewEvents", () => {
	let tmpDir: string;
	let logPath: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-reader-test-"));
		logPath = join(tmpDir, "events.relay.jsonl");
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("reads events from the start", () => {
		const lines = [makeEventLine("evt_1"), makeEventLine("evt_2")].join("\n") + "\n";
		writeFileSync(logPath, lines);

		const result = readNewEvents(logPath, 0);
		expect(result.events).toHaveLength(2);
		expect((result.events[0] as any).id).toBe("evt_1");
		expect(result.newByteOffset).toBe(Buffer.byteLength(lines));
	});

	it("reads from a byte offset", () => {
		const line1 = makeEventLine("evt_1") + "\n";
		const line2 = makeEventLine("evt_2") + "\n";
		writeFileSync(logPath, line1 + line2);

		const offset = Buffer.byteLength(line1);
		const result = readNewEvents(logPath, offset);
		expect(result.events).toHaveLength(1);
		expect((result.events[0] as any).id).toBe("evt_2");
	});

	it("skips heartbeat records", () => {
		const lines = [makeHeartbeat(), makeEventLine("evt_1"), makeHeartbeat()].join("\n") + "\n";
		writeFileSync(logPath, lines);

		const result = readNewEvents(logPath, 0);
		expect(result.events).toHaveLength(1);
		expect((result.events[0] as any).id).toBe("evt_1");
	});

	it("respects maxEvents limit", () => {
		const lines = Array.from({ length: 10 }, (_, i) => makeEventLine(`evt_${i}`)).join("\n") + "\n";
		writeFileSync(logPath, lines);

		const result = readNewEvents(logPath, 0, 3);
		expect(result.events).toHaveLength(3);
	});

	it("returns empty for missing file", () => {
		const result = readNewEvents("/nonexistent/path", 0);
		expect(result.events).toHaveLength(0);
		expect(result.bytesRead).toBe(0);
	});

	it("returns empty when offset is at EOF", () => {
		const lines = makeEventLine("evt_1") + "\n";
		writeFileSync(logPath, lines);
		const size = Buffer.byteLength(lines);

		const result = readNewEvents(logPath, size);
		expect(result.events).toHaveLength(0);
	});

	it("handles partial last line", () => {
		// Write a complete line followed by incomplete data
		const complete = makeEventLine("evt_1") + "\n";
		const partial = '{"id":"evt_2","incomplete';
		writeFileSync(logPath, complete + partial);

		const result = readNewEvents(logPath, 0);
		expect(result.events).toHaveLength(1);
		expect((result.events[0] as any).id).toBe("evt_1");
		// Should NOT advance past the partial line
		expect(result.newByteOffset).toBe(Buffer.byteLength(complete));
	});

	it("skips corrupt JSON lines", () => {
		const lines = [makeEventLine("evt_1"), "not valid json", makeEventLine("evt_2")].join("\n") + "\n";
		writeFileSync(logPath, lines);

		const result = readNewEvents(logPath, 0);
		expect(result.events).toHaveLength(2);
	});
});
