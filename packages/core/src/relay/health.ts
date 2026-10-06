/**
 * Relay health assessment (F4).
 *
 * `patchwork relay verify` used to report `Integrity: PASS` whenever every
 * line in the relay log parsed as JSON. That is a real check, but it is
 * only a check on the lines that ARE there. It says nothing about whether
 * the relay is still receiving anything, so a relay that stopped accepting
 * events months ago reports PASS forever.
 *
 * That is not hypothetical. In v0.6.10 the relay socket was tightened from
 * 0777 to 0660 while its group stayed `wheel`. Hook processes run as the
 * user, typically in `staff`, so every delivery returned `connect EACCES`
 * and the divergence counter climbed. `relay verify` kept reporting
 * Integrity: PASS on a chain that had not received an event since the
 * deploy. Silence was indistinguishable from health.
 *
 * This module separates the three questions that were being conflated:
 *
 *   1. Is what we have intact?      (corrupt line count)
 *   2. Is the daemon still alive?   (heartbeat recency)
 *   3. Is delivery working?         (divergence marker)
 *
 * It is a pure function over already-read inputs so it can be tested
 * without a daemon, a socket or root.
 */

import type { RelayDivergenceMarker } from "./client.js";

/** Default window after which heartbeat silence is treated as degraded.
 *  The daemon beats every 30s, so 5 minutes is ten consecutive misses:
 *  comfortably past transient scheduling noise, well short of a window
 *  where a dead relay looks fine. */
export const DEFAULT_MAX_SILENCE_MS = 5 * 60_000;

export type RelayHealthStatus = "pass" | "stale" | "fail";

export interface RelayHealthReport {
	/** `fail` = what we hold is damaged. `stale` = what we hold may be
	 *  incomplete, because the relay is not demonstrably receiving. */
	status: RelayHealthStatus;
	events: number;
	heartbeats: number;
	corrupt: number;
	lastHeartbeatAt: string | null;
	/** Milliseconds since the newest heartbeat, or null if there is none. */
	silenceMs: number | null;
	divergenceFailures: number;
	/** Human-readable reasons, in the order they were detected. Empty on pass. */
	reasons: string[];
}

export interface AssessRelayHealthInput {
	/** Raw contents of the relay log. */
	logContent: string;
	/** Divergence marker, or null when absent. */
	divergence?: RelayDivergenceMarker | null;
	/** Evaluation time. Injectable so tests are not clock-dependent. */
	now?: number;
	maxSilenceMs?: number;
}

/**
 * Assess relay health. `fail` outranks `stale`: damaged data is a stronger
 * statement than possibly-missing data, and the operator should see it
 * first.
 */
export function assessRelayHealth(
	input: AssessRelayHealthInput,
): RelayHealthReport {
	const now = input.now ?? Date.now();
	const maxSilenceMs = input.maxSilenceMs ?? DEFAULT_MAX_SILENCE_MS;
	const divergenceFailures = input.divergence?.failure_count ?? 0;

	let events = 0;
	let heartbeats = 0;
	let corrupt = 0;
	let newestHeartbeatMs: number | null = null;
	let lastHeartbeatAt: string | null = null;

	for (const line of input.logContent.split("\n")) {
		if (!line.trim()) continue;
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch {
			corrupt++;
			continue;
		}
		const rec = parsed as { type?: string; timestamp?: string };
		if (rec.type === "heartbeat") {
			heartbeats++;
			if (typeof rec.timestamp === "string") {
				const t = Date.parse(rec.timestamp);
				// A heartbeat with an unparseable timestamp is counted but
				// cannot contribute freshness. Treating it as fresh would be
				// the exact mistake this module exists to correct.
				if (!Number.isNaN(t) && (newestHeartbeatMs === null || t > newestHeartbeatMs)) {
					newestHeartbeatMs = t;
					lastHeartbeatAt = rec.timestamp;
				}
			}
		} else {
			events++;
		}
	}

	const silenceMs = newestHeartbeatMs === null ? null : now - newestHeartbeatMs;
	const reasons: string[] = [];
	let status: RelayHealthStatus = "pass";

	if (corrupt > 0) {
		status = "fail";
		reasons.push(
			`${corrupt} unparseable line${corrupt === 1 ? "" : "s"} in the relay log`,
		);
	}

	const degrade = (reason: string) => {
		reasons.push(reason);
		if (status !== "fail") status = "stale";
	};

	if (events === 0 && heartbeats === 0) {
		degrade("relay log is empty — the relay has received nothing");
	} else if (newestHeartbeatMs === null) {
		degrade("no heartbeat with a usable timestamp — cannot establish liveness");
	} else if (silenceMs !== null && silenceMs > maxSilenceMs) {
		degrade(
			`no heartbeat for ${Math.round(silenceMs / 60_000)}m (threshold ${Math.round(maxSilenceMs / 60_000)}m) — the daemon is not writing`,
		);
	}

	if (divergenceFailures > 0) {
		degrade(
			`${divergenceFailures} failed deliver${divergenceFailures === 1 ? "y" : "ies"} recorded — hooks cannot reach the relay, so recent events are missing`,
		);
	}

	return {
		status,
		events,
		heartbeats,
		corrupt,
		lastHeartbeatAt,
		silenceMs,
		divergenceFailures,
		reasons,
	};
}

/** Process exit code for a report. 0 pass, 1 damaged, 2 degraded. */
export function relayHealthExitCode(report: RelayHealthReport): number {
	if (report.status === "fail") return 1;
	if (report.status === "stale") return 2;
	return 0;
}
