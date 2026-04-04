import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TeamDb } from "../../src/server/db/schema.js";
import { createTeamApp } from "../../src/server/app.js";
import { insertTeam, insertMachine, getTeamEventCount } from "../../src/server/db/queries.js";
import { generateApiKey, hashApiKey, computeBatchHash, signEnvelope } from "../../src/crypto.js";
import { SyncAgent } from "../../src/sync/agent.js";
import { readCursor } from "../../src/sync/cursor.js";
import type { TeamConfig } from "../../src/protocol.js";

function makeRelayEventLine(id: string): string {
	return JSON.stringify({
		id,
		session_id: "ses_integration",
		timestamp: new Date().toISOString(),
		agent: "claude-code",
		action: "file_read",
		status: "completed",
		risk: { level: "low", flags: [] },
		target: { type: "file", path: "test.ts" },
		project: { root: "/tmp", name: "test" },
		event_hash: `sha256:hash_${id}`,
		prev_hash: null,
		_relay_hash: `sha256:relay_${id}`,
		_relay: { received_at: new Date().toISOString() },
	});
}

function makeHeartbeatLine(): string {
	return JSON.stringify({
		type: "heartbeat",
		timestamp: new Date().toISOString(),
		relay_chain_tip: null,
		relay_event_count: 0,
		uptime_ms: 1000,
	});
}

describe("SyncAgent integration", () => {
	let tmpDir: string;
	let db: TeamDb;
	let app: ReturnType<typeof createTeamApp>;
	let teamId: string;
	let apiKey: string;
	let logPath: string;
	let sealsPath: string;
	let cursorPath: string;
	let config: TeamConfig;

	// Mock server URL — we'll call app.request directly instead of fetch
	// So we need to intercept fetch calls in the transport

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-agent-test-"));
		logPath = join(tmpDir, "events.relay.jsonl");
		sealsPath = join(tmpDir, "seals.relay.jsonl");
		cursorPath = join(tmpDir, "sync-cursor.json");

		db = new TeamDb(":memory:");
		app = createTeamApp(db);

		teamId = insertTeam(db, "TestTeam");
		apiKey = generateApiKey();
		insertMachine(db, teamId, "hw-test", "test-host", "Tester", hashApiKey(apiKey), "darwin");

		config = {
			schema_version: 1,
			team_id: teamId,
			team_name: "TestTeam",
			server_url: "http://localhost:0", // Not used — we test via cycle()
			machine_id: "hw-test",
			developer_name: "Tester",
			api_key: apiKey,
			enrolled_at: new Date().toISOString(),
		};

		// Write some events to the relay log
		const lines = [
			makeHeartbeatLine(),
			makeRelayEventLine("evt_1"),
			makeRelayEventLine("evt_2"),
			makeHeartbeatLine(),
			makeRelayEventLine("evt_3"),
		].join("\n") + "\n";
		writeFileSync(logPath, lines);
	});

	afterEach(() => {
		db.close();
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("reads events from relay log and pushes to server", async () => {
		// We can't easily mock fetch for the full agent, so test the pieces:
		// 1. Reader reads events
		const { readNewEvents } = await import("../../src/sync/reader.js");
		const { events, newByteOffset } = readNewEvents(logPath, 0);
		expect(events).toHaveLength(3); // 3 events, heartbeats skipped

		// 2. Build and sign envelope
		const envelope = signEnvelope({
			schema_version: 1,
			type: "event-batch",
			machine_id: config.machine_id,
			machine_name: "test-host",
			developer_id: config.developer_name,
			team_id: config.team_id,
			events,
			batch_hash: computeBatchHash(events),
			first_event_hash: (events[0] as any).event_hash ?? null,
			last_event_hash: (events[events.length - 1] as any).event_hash ?? null,
			relay_chain_tip: (events[events.length - 1] as any)._relay_hash ?? null,
			signature: "",
			signed_at: "",
			byte_offset_start: 0,
			byte_offset_end: newByteOffset,
		}, apiKey);

		// 3. Push to server via app.request
		const res = await app.request("/api/v1/ingest", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(envelope),
		});

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.ok).toBe(true);
		expect(body.accepted).toBe(3);

		// 4. Events are in the DB
		expect(getTeamEventCount(db, teamId)).toBe(3);
	});

	it("cursor advances after successful push", async () => {
		const { readNewEvents } = await import("../../src/sync/reader.js");
		const { writeCursor } = await import("../../src/sync/cursor.js");
		const { DEFAULT_SYNC_CURSOR } = await import("../../src/protocol.js");

		const { events, newByteOffset } = readNewEvents(logPath, 0);

		// Simulate successful push by writing cursor
		writeCursor({
			...DEFAULT_SYNC_CURSOR,
			last_synced_offset: newByteOffset,
			last_synced_event_hash: (events[events.length - 1] as any).event_hash,
			last_synced_at: new Date().toISOString(),
		}, cursorPath);

		const cursor = readCursor(cursorPath);
		expect(cursor.last_synced_offset).toBe(newByteOffset);
		expect(cursor.consecutive_failures).toBe(0);

		// Second read from new offset should return empty
		const { events: events2 } = readNewEvents(logPath, cursor.last_synced_offset);
		expect(events2).toHaveLength(0);
	});

	it("picks up new events appended after initial read", async () => {
		const { readNewEvents } = await import("../../src/sync/reader.js");

		// First read
		const { newByteOffset } = readNewEvents(logPath, 0);

		// Append more events
		appendFileSync(logPath, makeRelayEventLine("evt_4") + "\n");
		appendFileSync(logPath, makeRelayEventLine("evt_5") + "\n");

		// Second read from where we left off
		const { events } = readNewEvents(logPath, newByteOffset);
		expect(events).toHaveLength(2);
		expect((events[0] as any).id).toBe("evt_4");
		expect((events[1] as any).id).toBe("evt_5");
	});

	it("handles duplicate pushes idempotently", async () => {
		const { readNewEvents } = await import("../../src/sync/reader.js");
		const { events } = readNewEvents(logPath, 0);

		const envelope = signEnvelope({
			schema_version: 1,
			type: "event-batch",
			machine_id: config.machine_id,
			machine_name: "test-host",
			developer_id: config.developer_name,
			team_id: config.team_id,
			events,
			batch_hash: computeBatchHash(events),
			first_event_hash: (events[0] as any).event_hash ?? null,
			last_event_hash: (events[events.length - 1] as any).event_hash ?? null,
			relay_chain_tip: null,
			signature: "",
			signed_at: "",
			byte_offset_start: 0,
			byte_offset_end: 1024,
		}, apiKey);

		// Push twice
		await app.request("/api/v1/ingest", {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
			body: JSON.stringify(envelope),
		});

		const res = await app.request("/api/v1/ingest", {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
			body: JSON.stringify(envelope),
		});

		const body = await res.json();
		expect(body.ok).toBe(true);
		expect(body.accepted).toBe(0);
		expect(body.duplicates).toBe(3);
		expect(getTeamEventCount(db, teamId)).toBe(3);
	});
});
