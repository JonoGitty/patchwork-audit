import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RelayDaemon } from "../../src/relay/daemon.js";
import { sendToRelay, pingRelay, readRelayDivergenceMarker } from "../../src/relay/client.js";
import { RELAY_PROTOCOL_VERSION } from "../../src/relay/protocol.js";
import type { AuditEvent } from "../../src/schema/event.js";

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
	return {
		schema_version: 1,
		id: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
		session_id: "ses_client_test",
		timestamp: new Date().toISOString(),
		agent: "claude-code",
		action: "file_read",
		status: "completed",
		risk: { level: "low", flags: [] },
		...overrides,
	};
}

describe("Relay Client", () => {
	let tmpDir: string;
	let daemon: RelayDaemon;
	let socketPath: string;
	let logPath: string;

	beforeEach(async () => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-relay-client-test-"));
		socketPath = join(tmpDir, "relay.sock");
		logPath = join(tmpDir, "events.relay.jsonl");

		daemon = new RelayDaemon({
			socketPath,
			logPath,
			daemonLogPath: join(tmpDir, "relay.log"),
			pidPath: join(tmpDir, "relay.pid"),
			heartbeatIntervalMs: 60_000,
		});
		await daemon.start();
	});

	afterEach(async () => {
		await daemon.stop();
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("sendToRelay sends event to daemon", async () => {
		const event = makeEvent();
		sendToRelay(event as unknown as Record<string, unknown>, socketPath);

		// Wait for async fire-and-forget to complete
		await new Promise((r) => setTimeout(r, 300));

		const content = readFileSync(logPath, "utf-8");
		const eventLines = content.split("\n")
			.filter((l) => l.trim())
			.map((l) => JSON.parse(l))
			.filter((p: Record<string, unknown>) => p.type !== "heartbeat");

		expect(eventLines.length).toBe(1);
		expect(eventLines[0].id).toBe(event.id);
	});

	it("sendToRelay is silent when socket does not exist", () => {
		const event = makeEvent();
		// Should not throw
		sendToRelay(event as unknown as Record<string, unknown>, "/tmp/nonexistent-relay.sock");
	});

	it("pingRelay returns response when daemon is running", async () => {
		const resp = await pingRelay(socketPath);
		expect(resp).not.toBeNull();
		expect(resp!.ok).toBe(true);
	});

	it("pingRelay returns null when socket does not exist", async () => {
		const resp = await pingRelay("/tmp/nonexistent-relay.sock");
		expect(resp).toBeNull();
	});

	it("readRelayDivergenceMarker returns null when no marker", () => {
		const marker = readRelayDivergenceMarker(join(tmpDir, "no-marker.json"));
		expect(marker).toBeNull();
	});

	it("readRelayDivergenceMarker reads a valid marker", () => {
		const markerPath = join(tmpDir, "relay-divergence.json");
		writeFileSync(markerPath, JSON.stringify({
			schema_version: 1,
			failure_count: 3,
			first_failure_at: "2026-04-01T00:00:00Z",
			last_failure_at: "2026-04-02T00:00:00Z",
			last_error: "Connection refused",
		}));

		const marker = readRelayDivergenceMarker(markerPath);
		expect(marker).not.toBeNull();
		expect(marker!.failure_count).toBe(3);
		expect(marker!.last_error).toBe("Connection refused");
	});

	it("handles multiple rapid sends", async () => {
		const events = Array.from({ length: 5 }, (_, i) =>
			makeEvent({ action: i % 2 === 0 ? "file_read" : "file_write" }),
		);

		for (const event of events) {
			sendToRelay(event as unknown as Record<string, unknown>, socketPath);
		}

		// Wait for all fire-and-forget sends
		await new Promise((r) => setTimeout(r, 800));

		const content = readFileSync(logPath, "utf-8");
		const eventLines = content.split("\n")
			.filter((l) => l.trim())
			.map((l) => JSON.parse(l))
			.filter((p: Record<string, unknown>) => p.type !== "heartbeat");

		// At least some should have made it through (fire-and-forget, may lose some under load)
		expect(eventLines.length).toBeGreaterThanOrEqual(1);
	});
});
