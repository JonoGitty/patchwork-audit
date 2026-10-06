import { describe, it, expect } from "vitest";
import {
	assessRelayHealth,
	relayHealthExitCode,
	DEFAULT_MAX_SILENCE_MS,
	type RelayDivergenceMarker,
} from "../../src/index.js";

const NOW = Date.parse("2026-10-06T10:00:00.000Z");

function heartbeat(isoTime: string, eventCount = 10): string {
	return JSON.stringify({
		type: "heartbeat",
		timestamp: isoTime,
		relay_chain_tip: "sha256:abc",
		relay_event_count: eventCount,
		uptime_ms: 3_600_000,
	});
}

function event(id: string): string {
	return JSON.stringify({
		id,
		session_id: "ses_1",
		timestamp: "2026-10-06T09:59:00.000Z",
		action: "file_read",
	});
}

function divergence(failures: number): RelayDivergenceMarker {
	return {
		schema_version: 1,
		failure_count: failures,
		first_failure_at: "2026-10-06T08:00:00.000Z",
		last_failure_at: "2026-10-06T09:59:00.000Z",
		last_error: "connect EACCES /Library/Patchwork/relay.sock",
	};
}

describe("assessRelayHealth (F4)", () => {
	it("passes on a fresh, intact, delivering relay", () => {
		const report = assessRelayHealth({
			logContent: [
				event("evt_1"),
				heartbeat("2026-10-06T09:59:30.000Z"),
				event("evt_2"),
			].join("\n"),
			now: NOW,
		});

		expect(report.status).toBe("pass");
		expect(report.events).toBe(2);
		expect(report.heartbeats).toBe(1);
		expect(report.corrupt).toBe(0);
		expect(report.reasons).toEqual([]);
		expect(relayHealthExitCode(report)).toBe(0);
	});

	// The regression this whole module exists for: in v0.6.10 the socket
	// group was wrong, every delivery returned EACCES, and verify reported
	// PASS for days on a chain that was receiving nothing.
	it("is DEGRADED when deliveries are failing, even though every line parses", () => {
		const report = assessRelayHealth({
			logContent: [event("evt_1"), heartbeat("2026-10-06T09:59:30.000Z")].join(
				"\n",
			),
			divergence: divergence(417),
			now: NOW,
		});

		expect(report.corrupt).toBe(0);
		expect(report.status).toBe("stale");
		expect(report.divergenceFailures).toBe(417);
		expect(report.reasons.join(" ")).toMatch(/hooks cannot reach the relay/);
		expect(relayHealthExitCode(report)).toBe(2);
	});

	it("is DEGRADED when the daemon has stopped beating", () => {
		const report = assessRelayHealth({
			logContent: [event("evt_1"), heartbeat("2026-10-06T09:00:00.000Z")].join(
				"\n",
			),
			now: NOW,
		});

		expect(report.status).toBe("stale");
		expect(report.silenceMs).toBe(60 * 60_000);
		expect(report.reasons.join(" ")).toMatch(/no heartbeat for 60m/);
		expect(relayHealthExitCode(report)).toBe(2);
	});

	it("still passes when silence is inside the window", () => {
		const report = assessRelayHealth({
			logContent: heartbeat("2026-10-06T09:57:00.000Z"),
			now: NOW,
		});

		expect(report.silenceMs).toBe(3 * 60_000);
		expect(report.status).toBe("pass");
	});

	it("respects a caller-supplied silence threshold", () => {
		const log = heartbeat("2026-10-06T09:57:00.000Z");

		expect(assessRelayHealth({ logContent: log, now: NOW }).status).toBe("pass");
		expect(
			assessRelayHealth({ logContent: log, now: NOW, maxSilenceMs: 60_000 })
				.status,
		).toBe("stale");
	});

	it("is DEGRADED on an empty log rather than vacuously passing", () => {
		const report = assessRelayHealth({ logContent: "", now: NOW });

		expect(report.status).toBe("stale");
		expect(report.reasons.join(" ")).toMatch(/received nothing/);
		expect(relayHealthExitCode(report)).toBe(2);
	});

	it("is DEGRADED when no heartbeat carries a usable timestamp", () => {
		const report = assessRelayHealth({
			logContent: [
				event("evt_1"),
				JSON.stringify({ type: "heartbeat", timestamp: "not-a-date" }),
			].join("\n"),
			now: NOW,
		});

		expect(report.heartbeats).toBe(1);
		expect(report.silenceMs).toBeNull();
		expect(report.status).toBe("stale");
		expect(report.reasons.join(" ")).toMatch(/cannot establish liveness/);
	});

	it("FAILS on corrupt lines", () => {
		const report = assessRelayHealth({
			logContent: [
				event("evt_1"),
				"{ this is not json",
				heartbeat("2026-10-06T09:59:30.000Z"),
			].join("\n"),
			now: NOW,
		});

		expect(report.corrupt).toBe(1);
		expect(report.status).toBe("fail");
		expect(relayHealthExitCode(report)).toBe(1);
	});

	it("reports FAIL rather than DEGRADED when both apply, but keeps both reasons", () => {
		const report = assessRelayHealth({
			logContent: ["{ broken", heartbeat("2026-10-06T08:00:00.000Z")].join("\n"),
			divergence: divergence(3),
			now: NOW,
		});

		expect(report.status).toBe("fail");
		expect(relayHealthExitCode(report)).toBe(1);
		expect(report.reasons.length).toBe(3);
	});

	it("ignores blank lines and treats a zero divergence marker as healthy", () => {
		const report = assessRelayHealth({
			logContent: `\n${heartbeat("2026-10-06T09:59:30.000Z")}\n\n${event("evt_1")}\n`,
			divergence: divergence(0),
			now: NOW,
		});

		expect(report.corrupt).toBe(0);
		expect(report.events).toBe(1);
		expect(report.heartbeats).toBe(1);
		expect(report.status).toBe("pass");
	});

	it("uses the newest heartbeat, not the last line", () => {
		const report = assessRelayHealth({
			logContent: [
				heartbeat("2026-10-06T09:59:30.000Z"),
				heartbeat("2026-10-06T09:00:00.000Z"),
			].join("\n"),
			now: NOW,
		});

		expect(report.lastHeartbeatAt).toBe("2026-10-06T09:59:30.000Z");
		expect(report.status).toBe("pass");
	});

	it("defaults the silence window to five minutes", () => {
		expect(DEFAULT_MAX_SILENCE_MS).toBe(300_000);
	});
});
