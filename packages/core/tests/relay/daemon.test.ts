import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { connect } from "node:net";
import { RelayDaemon } from "../../src/relay/daemon.js";
import { RELAY_PROTOCOL_VERSION, type RelayMessage, type RelayResponse } from "../../src/relay/protocol.js";
import type { AuditEvent } from "../../src/schema/event.js";

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
	return {
		schema_version: 1,
		id: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
		session_id: "ses_relay_test",
		timestamp: new Date().toISOString(),
		agent: "claude-code",
		action: "file_read",
		status: "completed",
		risk: { level: "low", flags: [] },
		...overrides,
	};
}

function sendMessage(socketPath: string, msg: RelayMessage): Promise<RelayResponse> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error("Timeout")), 2000);
		const socket = connect(socketPath, () => {
			socket.write(JSON.stringify(msg) + "\n");
		});
		socket.on("data", (chunk) => {
			clearTimeout(timer);
			resolve(JSON.parse(chunk.toString().trim()));
			socket.destroy();
		});
		socket.on("error", (err) => {
			clearTimeout(timer);
			reject(err);
		});
	});
}

describe("RelayDaemon", () => {
	let tmpDir: string;
	let daemon: RelayDaemon;
	let socketPath: string;
	let logPath: string;
	let daemonLogPath: string;
	let pidPath: string;

	beforeEach(async () => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-relay-test-"));
		socketPath = join(tmpDir, "relay.sock");
		logPath = join(tmpDir, "events.relay.jsonl");
		daemonLogPath = join(tmpDir, "relay.log");
		pidPath = join(tmpDir, "relay.pid");

		daemon = new RelayDaemon({
			socketPath,
			logPath,
			daemonLogPath,
			pidPath,
			heartbeatIntervalMs: 60_000, // Long interval so heartbeats don't interfere with tests
		});
		await daemon.start();
	});

	afterEach(async () => {
		await daemon.stop();
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("creates socket and PID file on start", () => {
		expect(existsSync(socketPath)).toBe(true);
		expect(existsSync(pidPath)).toBe(true);
		const pid = readFileSync(pidPath, "utf-8").trim();
		expect(Number(pid)).toBe(process.pid);
	});

	it("responds to ping", async () => {
		const resp = await sendMessage(socketPath, {
			protocol_version: RELAY_PROTOCOL_VERSION,
			type: "ping",
			timestamp: new Date().toISOString(),
		});
		expect(resp.ok).toBe(true);
	});

	it("accepts valid audit events", async () => {
		const event = makeEvent();
		const resp = await sendMessage(socketPath, {
			protocol_version: RELAY_PROTOCOL_VERSION,
			type: "event",
			timestamp: new Date().toISOString(),
			payload: event as unknown as Record<string, unknown>,
		});

		expect(resp.ok).toBe(true);
		expect(resp.relay_hash).toBeDefined();
		expect(resp.relay_hash).toMatch(/^sha256:/);

		// Verify event was written to relay log
		const content = readFileSync(logPath, "utf-8");
		const lines = content.split("\n").filter((l) => l.trim());
		// First line is the initial heartbeat, second is our event
		const eventLines = lines.filter((l) => {
			const p = JSON.parse(l);
			return p.type !== "heartbeat";
		});
		expect(eventLines.length).toBe(1);

		const stored = JSON.parse(eventLines[0]);
		expect(stored.id).toBe(event.id);
		expect(stored._relay).toBeDefined();
		expect(stored._relay.received_at).toBeDefined();
		expect(stored._relay_hash).toMatch(/^sha256:/);
	});

	it("rejects invalid schema events", async () => {
		const resp = await sendMessage(socketPath, {
			protocol_version: RELAY_PROTOCOL_VERSION,
			type: "event",
			timestamp: new Date().toISOString(),
			payload: { bad: "data" },
		});

		expect(resp.ok).toBe(false);
		expect(resp.error).toContain("Schema validation failed");
	});

	it("rejects missing payload", async () => {
		const resp = await sendMessage(socketPath, {
			protocol_version: RELAY_PROTOCOL_VERSION,
			type: "event",
			timestamp: new Date().toISOString(),
		});

		expect(resp.ok).toBe(false);
		expect(resp.error).toContain("Missing event payload");
	});

	it("rejects unsupported protocol version", async () => {
		const resp = await sendMessage(socketPath, {
			protocol_version: 999,
			type: "ping",
			timestamp: new Date().toISOString(),
		});

		expect(resp.ok).toBe(false);
		expect(resp.error).toContain("Unsupported protocol version");
	});

	it("builds relay-side hash chain across multiple events", async () => {
		const event1 = makeEvent({ action: "file_read" });
		const event2 = makeEvent({ action: "file_write" });
		const event3 = makeEvent({ action: "command_execute" });

		const r1 = await sendMessage(socketPath, {
			protocol_version: RELAY_PROTOCOL_VERSION,
			type: "event",
			timestamp: new Date().toISOString(),
			payload: event1 as unknown as Record<string, unknown>,
		});
		const r2 = await sendMessage(socketPath, {
			protocol_version: RELAY_PROTOCOL_VERSION,
			type: "event",
			timestamp: new Date().toISOString(),
			payload: event2 as unknown as Record<string, unknown>,
		});
		const r3 = await sendMessage(socketPath, {
			protocol_version: RELAY_PROTOCOL_VERSION,
			type: "event",
			timestamp: new Date().toISOString(),
			payload: event3 as unknown as Record<string, unknown>,
		});

		expect(r1.ok).toBe(true);
		expect(r2.ok).toBe(true);
		expect(r3.ok).toBe(true);

		// All hashes should be different
		expect(r1.relay_hash).not.toBe(r2.relay_hash);
		expect(r2.relay_hash).not.toBe(r3.relay_hash);

		// Verify chain in the log
		const content = readFileSync(logPath, "utf-8");
		const eventLines = content.split("\n")
			.filter((l) => l.trim())
			.map((l) => JSON.parse(l))
			.filter((p: Record<string, unknown>) => p.type !== "heartbeat");

		expect(eventLines.length).toBe(3);

		// Second event's relay_prev_hash should be first event's relay_hash
		expect(eventLines[1]._relay.relay_prev_hash).toBe(eventLines[0]._relay_hash);
		expect(eventLines[2]._relay.relay_prev_hash).toBe(eventLines[1]._relay_hash);
	});

	it("tracks event count and chain tip in state", async () => {
		expect(daemon.state.eventCount).toBe(0);
		expect(daemon.state.chainTip).toBeNull();

		const event = makeEvent();
		await sendMessage(socketPath, {
			protocol_version: RELAY_PROTOCOL_VERSION,
			type: "event",
			timestamp: new Date().toISOString(),
			payload: event as unknown as Record<string, unknown>,
		});

		expect(daemon.state.eventCount).toBe(1);
		expect(daemon.state.chainTip).toMatch(/^sha256:/);
	});

	it("writes initial heartbeat on start", () => {
		const content = readFileSync(logPath, "utf-8");
		const lines = content.split("\n").filter((l) => l.trim());
		const heartbeats = lines.filter((l) => {
			const p = JSON.parse(l);
			return p.type === "heartbeat";
		});
		expect(heartbeats.length).toBeGreaterThanOrEqual(1);

		const hb = JSON.parse(heartbeats[0]);
		expect(hb.type).toBe("heartbeat");
		expect(hb.timestamp).toBeDefined();
		expect(hb.relay_event_count).toBe(0);
		expect(typeof hb.uptime_ms).toBe("number");
	});

	it("cleans up socket and PID on stop", async () => {
		await daemon.stop();
		expect(existsSync(socketPath)).toBe(false);
		expect(existsSync(pidPath)).toBe(false);

		// Recreate daemon for afterEach cleanup (it expects to stop)
		daemon = new RelayDaemon({
			socketPath,
			logPath,
			daemonLogPath,
			pidPath,
			heartbeatIntervalMs: 60_000,
		});
		await daemon.start();
	});

	it("recovers chain state from existing log on restart", async () => {
		// Write some events
		const event = makeEvent();
		const r1 = await sendMessage(socketPath, {
			protocol_version: RELAY_PROTOCOL_VERSION,
			type: "event",
			timestamp: new Date().toISOString(),
			payload: event as unknown as Record<string, unknown>,
		});

		const tipAfterWrite = r1.relay_hash;

		// Stop and restart
		await daemon.stop();
		daemon = new RelayDaemon({
			socketPath,
			logPath,
			daemonLogPath,
			pidPath,
			heartbeatIntervalMs: 60_000,
		});
		await daemon.start();

		// State should be recovered
		expect(daemon.state.eventCount).toBe(1);
		expect(daemon.state.chainTip).toBe(tipAfterWrite);
	});

	it("detects tampered event hashes", async () => {
		const event = makeEvent();
		// Manually set a wrong event_hash
		const payload = {
			...(event as unknown as Record<string, unknown>),
			event_hash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
		};

		const resp = await sendMessage(socketPath, {
			protocol_version: RELAY_PROTOCOL_VERSION,
			type: "event",
			timestamp: new Date().toISOString(),
			payload,
		});

		expect(resp.ok).toBe(false);
		expect(resp.error).toContain("hash mismatch");
	});
});
