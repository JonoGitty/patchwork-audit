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
 *
 * ## Why divergence is judged on recency, not on count
 *
 * The divergence marker is CUMULATIVE and never self-clears, so a raw
 * `failure_count > 0` test degrades forever after a single historical
 * failure. Measured on one machine over six months: 3,529 accumulated
 * failures, all of them stopping 48 days before the measurement, against
 * a daemon that was entirely healthy at the time of asking. The first
 * recorded failure matched a daemon restart to the minute, which is the
 * expected shape: restarting the relay removes its socket briefly, and
 * any delivery in flight at that moment fails. Twenty-four restarts over
 * the period.
 *
 * So a non-zero count mostly records transient, long-past, and largely
 * unavoidable events. Degrading on it permanently would mean every
 * install that has ever restarted its relay reports DEGRADED forever, and
 * an alarm that is always on is worse than no alarm because it teaches
 * people to dismiss it.
 *
 * Historical divergence is therefore reported as a NOTE, and only RECENT
 * divergence degrades the status. The sharpest case is called out
 * separately: recent failures while the daemon is demonstrably alive
 * means the relay was reachable and still did not take the event, which
 * is a genuine fault rather than a restart or a sleeping host.
 */

import type { RelayDivergenceMarker } from "./client.js";

/** Default window after which heartbeat silence is treated as degraded.
 *  The daemon beats every 30s, so 5 minutes is ten consecutive misses:
 *  comfortably past transient scheduling noise, well short of a window
 *  where a dead relay looks fine. */
export const DEFAULT_MAX_SILENCE_MS = 5 * 60_000;

/** Default window within which a delivery failure is treated as current
 *  rather than historical. An hour is long enough to catch a fault that
 *  is still happening and short enough that yesterday's lid-close does
 *  not read as today's problem. */
export const DEFAULT_DIVERGENCE_WINDOW_MS = 60 * 60_000;

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
	/** Milliseconds since the most recent delivery failure, or null if the
	 *  marker is absent or carries no usable timestamp. */
	divergenceAgeMs: number | null;
	/** Reasons that AFFECT the status, in detection order. Empty on pass. */
	reasons: string[];
	/** Informational findings that do NOT affect the status — most often
	 *  historical delivery failures that are no longer current. */
	notes: string[];
}

export interface AssessRelayHealthInput {
	/** Raw contents of the relay log. */
	logContent: string;
	/** Divergence marker, or null when absent. */
	divergence?: RelayDivergenceMarker | null;
	/** Evaluation time. Injectable so tests are not clock-dependent. */
	now?: number;
	maxSilenceMs?: number;
	/** How recent a delivery failure must be to count as current. */
	divergenceWindowMs?: number;
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
	const divergenceWindowMs =
		input.divergenceWindowMs ?? DEFAULT_DIVERGENCE_WINDOW_MS;
	const divergenceFailures = input.divergence?.failure_count ?? 0;

	const lastFailureRaw = input.divergence?.last_failure_at;
	let divergenceAgeMs: number | null = null;
	if (typeof lastFailureRaw === "string") {
		const parsed = Date.parse(lastFailureRaw);
		if (!Number.isNaN(parsed)) divergenceAgeMs = now - parsed;
	}

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
	const notes: string[] = [];
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
		const plural = divergenceFailures === 1 ? "y" : "ies";
		const daemonAlive = silenceMs !== null && silenceMs <= maxSilenceMs;
		if (divergenceAgeMs === null) {
			// Count without a usable timestamp: cannot tell current from
			// historical, so say so rather than guessing either way.
			notes.push(
				`${divergenceFailures} failed deliver${plural} recorded, with no usable timestamp — age unknown`,
			);
		} else if (divergenceAgeMs > divergenceWindowMs) {
			// Historical. On a laptop this is the normal steady state: the
			// host slept, deliveries failed, the counter never cleared.
			notes.push(
				`${divergenceFailures} failed deliver${plural} recorded, most recently ${formatAge(divergenceAgeMs)} ago — historical, not current. Those events are missing from the relay copy, but nothing is failing now.`,
			);
		} else if (daemonAlive) {
			// The sharp case: reachable daemon, and delivery still failed.
			degrade(
				`${divergenceFailures} failed deliver${plural}, most recently ${formatAge(divergenceAgeMs)} ago, while the daemon is alive — the relay was reachable and still did not take the event`,
			);
		} else {
			degrade(
				`${divergenceFailures} failed deliver${plural}, most recently ${formatAge(divergenceAgeMs)} ago — hooks cannot reach the relay, so recent events are missing`,
			);
		}
	}

	return {
		status,
		events,
		heartbeats,
		corrupt,
		lastHeartbeatAt,
		silenceMs,
		divergenceFailures,
		divergenceAgeMs,
		reasons,
		notes,
	};
}

/** Compact human age, e.g. "45s", "12m", "3h", "9d". */
function formatAge(ms: number): string {
	if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
	if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
	if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h`;
	return `${Math.round(ms / 86_400_000)}d`;
}

/** Process exit code for a report. 0 pass, 1 damaged, 2 degraded. */
export function relayHealthExitCode(report: RelayHealthReport): number {
	if (report.status === "fail") return 1;
	if (report.status === "stale") return 2;
	return 0;
}
