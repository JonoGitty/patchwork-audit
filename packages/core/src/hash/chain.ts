import { createHash } from "node:crypto";

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
}

/**
 * Verify the hash chain integrity of a sequence of raw parsed events.
 * Each event is expected to be a plain object (JSON.parse output).
 *
 * - Legacy events (no event_hash) are counted but not chain-checked.
 * - Chained events have both event_hash and prev_hash fields.
 * - Hash mismatch: recomputed hash differs from stored event_hash.
 * - Prev-link mismatch: prev_hash doesn't match the prior chained event's event_hash.
 */
export function verifyChain(
	events: Record<string, unknown>[],
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
	};

	let lastChainedHash: string | null = null;

	for (let i = 0; i < events.length; i++) {
		const event = events[i];

		// Skip completely invalid entries (no id field = not a valid event)
		if (typeof event !== "object" || event === null || !("id" in event)) {
			result.invalid_schema_events++;
			continue;
		}

		const eventHash = event.event_hash as string | undefined;
		const prevHash = event.prev_hash as string | null | undefined;

		// Legacy event: no event_hash field
		if (!eventHash) {
			result.legacy_events++;
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

		// Verify the prev_hash link
		const expectedPrev = lastChainedHash;
		if (prevHash !== expectedPrev) {
			result.prev_link_mismatch_count++;
			result.is_valid = false;
			if (result.first_failure_index === null) {
				result.first_failure_index = i;
			}
		}

		lastChainedHash = eventHash;
	}

	return result;
}
