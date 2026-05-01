import { createHash } from "node:crypto";
import { AuditEventSchema } from "../schema/event.js";

/**
 * Canonical JSON serializer: deterministic key ordering for hash stability.
 * Recursively sorts object keys; arrays preserve element order.
 */
export function canonicalize(obj: unknown): string {
	if (obj === null || obj === undefined) {
		return JSON.stringify(obj);
	}
	if (Array.isArray(obj)) {
		return `[${obj.map((item) => canonicalize(item)).join(",")}]`;
	}
	if (typeof obj === "object") {
		const sorted = Object.keys(obj as Record<string, unknown>)
			.sort()
			.map((key) => {
				const val = (obj as Record<string, unknown>)[key];
				if (val === undefined) return null;
				return `${JSON.stringify(key)}:${canonicalize(val)}`;
			})
			.filter((entry) => entry !== null);
		return `{${sorted.join(",")}}`;
	}
	return JSON.stringify(obj);
}

/**
 * Compute the tamper-evident hash for an event.
 * Hashes the canonical JSON of all fields EXCEPT `event_hash` itself.
 */
export function computeEventHash(
	event: Record<string, unknown>,
): string {
	const { event_hash: _, ...rest } = event;
	const canonical = canonicalize(rest);
	const hash = createHash("sha256");
	hash.update(canonical);
	return `sha256:${hash.digest("hex")}`;
}

/** Result of verifying per-event hash integrity of a non-contiguous event set. */
export interface EventIntegrityResult {
	total: number;
	/** Events with schema validation failures. */
	invalid_schema_count: number;
	/** Events missing event_hash (legacy, pre-chain). */
	unhashed_count: number;
	/** Events whose stored event_hash does not match the recomputed hash. */
	hash_mismatch_count: number;
	/** Index of the first failure, or null if all events pass. */
	first_failure_index: number | null;
	is_valid: boolean;
	/**
	 * True when there are events but NONE of them carry `event_hash`. A verifier
	 * cannot tell a genuine pre-hash log from a fully-stripped one — callers
	 * that only issue chained logs should treat this as a downgrade signal.
	 */
	legacy_only_log: boolean;
}

export interface VerifyOptions {
	/**
	 * When true, ANY event missing event_hash fails verification (no legacy
	 * tolerance at all). Use this for newly-cut logs or in tests where you
	 * know hashing was on from the start.
	 *
	 * Default false — verifyEventHashes/verifyChain still catch the
	 * downgrade attack (mid-chain unhashed event) with default settings,
	 * but pure-legacy pre-chain logs continue to validate as `is_valid:true`
	 * with `unhashed_count: total` so callers can decide what to do.
	 */
	strict?: boolean;

	/**
	 * When true, a log that contains zero chained events (every event is
	 * legacy/unhashed) is treated as INVALID rather than legacy-tolerant.
	 *
	 * Why this exists separately from `strict`: a verifier cannot structurally
	 * distinguish a genuine pre-hash log from one whose `event_hash` fields
	 * have all been stripped by an attacker. Callers that know they only
	 * issue/accept hash-protected logs (auto-seal-on installs, anything
	 * post-v0.6.0) should set this so a fully-stripped log doesn't slip
	 * through with `is_valid:true`. The result still reports
	 * `legacy_only_log: true` so callers can also branch on the signal.
	 */
	requireChainProtected?: boolean;
}

/**
 * Verify per-event hash integrity without requiring prev_hash linkage between
 * events. Use this when checking a *filtered* subset of the global chain
 * (e.g. events from one session) — subset events do not chain to each other
 * because events from other sessions are interleaved between them.
 *
 * This still catches tampering: if any event's stored event_hash does not
 * match the deterministic hash of its content, it fails. Additionally, once
 * a hashed event has been observed, any subsequent unhashed event is treated
 * as a failure (defends against the "delete event_hash to demote tampered
 * events to legacy" attack).
 */
export function verifyEventHashes(
	events: Record<string, unknown>[],
	options: VerifyOptions = {},
): EventIntegrityResult {
	const result: EventIntegrityResult = {
		total: events.length,
		invalid_schema_count: 0,
		unhashed_count: 0,
		hash_mismatch_count: 0,
		first_failure_index: null,
		is_valid: true,
		legacy_only_log: false,
	};

	let sawHashed = false;

	for (let i = 0; i < events.length; i++) {
		const raw = events[i];
		const parsed = AuditEventSchema.safeParse(raw);
		if (!parsed.success) {
			result.invalid_schema_count++;
			result.is_valid = false;
			if (result.first_failure_index === null) result.first_failure_index = i;
			continue;
		}

		const eventHash = (raw as Record<string, unknown>).event_hash as string | undefined;
		if (!eventHash) {
			result.unhashed_count++;
			// Strict mode: never tolerate unhashed events.
			// Default mode: tolerate unhashed events ONLY if no hashed event has
			// been observed yet (pure-legacy log). Once we've seen a hashed
			// event, an unhashed one is a downgrade attack signal.
			if (options.strict || sawHashed) {
				result.is_valid = false;
				if (result.first_failure_index === null) result.first_failure_index = i;
			}
			continue;
		}

		sawHashed = true;

		const recomputed = computeEventHash(raw as Record<string, unknown>);
		if (recomputed !== eventHash) {
			result.hash_mismatch_count++;
			result.is_valid = false;
			if (result.first_failure_index === null) result.first_failure_index = i;
		}
	}

	// Distinguish "genuine empty/legacy log" from "hash-protected log" so
	// callers and downstream consumers can detect full-strip downgrades.
	if (result.total > 0 && !sawHashed && result.invalid_schema_count === 0) {
		result.legacy_only_log = true;
		if (options.requireChainProtected) {
			result.is_valid = false;
			if (result.first_failure_index === null) result.first_failure_index = 0;
		}
	}

	return result;
}

/** Result of verifying the hash chain integrity of an event log. */
export interface ChainVerification {
	total_events: number;
	chained_events: number;
	legacy_events: number;
	invalid_schema_events: number;
	hash_mismatch_count: number;
	prev_link_mismatch_count: number;
	first_failure_index: number | null;
	is_valid: boolean;
	/**
	 * The prev_hash declared by the first chained event. If non-null, the log
	 * is rooted at an anchor from an earlier (rotated/compacted) log and a
	 * matching seal is needed to prove continuity. Null for genesis-rooted logs.
	 */
	chain_anchor_hash?: string | null;
	/**
	 * True when the log has events but none of them carry `event_hash`. This
	 * is structurally indistinguishable from a fully-stripped log, so callers
	 * who only ever issue chain-protected logs (post-v0.6 installs) should
	 * treat this as a downgrade signal — see `requireChainProtected`.
	 */
	legacy_only_log: boolean;
}

/**
 * Verify the hash chain integrity of a sequence of raw parsed events.
 * Each event is expected to be a plain object (JSON.parse output).
 *
 * - Legacy events (no event_hash) are counted but not chain-checked.
 * - Chained events have both event_hash and prev_hash fields.
 * - Hash mismatch: recomputed hash differs from stored event_hash.
 * - Prev-link mismatch: prev_hash doesn't match the prior chained event's event_hash.
 *
 * Downgrade-attack defence: once we've seen a chained event, any subsequent
 * legacy (unhashed) event fails verification. Pre-chain pure-legacy logs
 * (no chained events at all) still validate as `is_valid: true` with
 * `legacy_events: total`. Pass `options.strict = true` to reject all
 * legacy events outright.
 */
export function verifyChain(
	events: Record<string, unknown>[],
	options: VerifyOptions = {},
): ChainVerification {
	const result: ChainVerification = {
		total_events: events.length,
		chained_events: 0,
		legacy_events: 0,
		invalid_schema_events: 0,
		hash_mismatch_count: 0,
		prev_link_mismatch_count: 0,
		first_failure_index: null,
		is_valid: true,
		legacy_only_log: false,
	};

	let lastChainedHash: string | null = null;
	let sawChainedEvent = false;

	for (let i = 0; i < events.length; i++) {
		const raw = events[i];
		const parsed = AuditEventSchema.safeParse(raw);
		if (!parsed.success) {
			result.invalid_schema_events++;
			result.is_valid = false;
			if (result.first_failure_index === null) {
				result.first_failure_index = i;
			}
			continue;
		}

		const event = raw as Record<string, unknown>;
		const eventHash = event.event_hash as string | undefined;
		const prevHash = event.prev_hash as string | null | undefined;

		// Legacy event: no event_hash field
		if (!eventHash) {
			result.legacy_events++;
			// Strict: never tolerate legacy events.
			// Default: tolerate ONLY if no chained event has been seen yet
			// (whole log is legacy). Mid-chain legacy = downgrade attack.
			if (options.strict || sawChainedEvent) {
				result.is_valid = false;
				if (result.first_failure_index === null) {
					result.first_failure_index = i;
				}
			}
			continue;
		}

		result.chained_events++;

		// Verify the event's own hash
		const recomputed = computeEventHash(event);
		if (recomputed !== eventHash) {
			result.hash_mismatch_count++;
			result.is_valid = false;
			if (result.first_failure_index === null) {
				result.first_failure_index = i;
			}
		}

		// Verify the prev_hash link. The first chained event we encounter
		// establishes the chain anchor — its prev_hash either is null
		// (genesis-rooted) or references an earlier log (rotated/compacted),
		// in which case proof of continuity lives in the seal history.
		if (!sawChainedEvent) {
			result.chain_anchor_hash = prevHash ?? null;
			sawChainedEvent = true;
		} else {
			const expectedPrev = lastChainedHash;
			if (prevHash !== expectedPrev) {
				result.prev_link_mismatch_count++;
				result.is_valid = false;
				if (result.first_failure_index === null) {
					result.first_failure_index = i;
				}
			}
		}

		lastChainedHash = eventHash;
	}

	// Distinguish "genuine pre-hash log" from "hash-protected log" so callers
	// who never issue legacy logs can detect a full strip-down attack.
	if (result.total_events > 0 && result.chained_events === 0 && result.invalid_schema_events === 0) {
		result.legacy_only_log = true;
		if (options.requireChainProtected) {
			result.is_valid = false;
			if (result.first_failure_index === null) result.first_failure_index = 0;
		}
	}

	return result;
}
