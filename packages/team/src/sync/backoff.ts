/**
 * Exponential backoff calculator for sync failures.
 */

import { BACKOFF_SCHEDULE_MS } from "../constants.js";

/**
 * Compute backoff delay in milliseconds based on consecutive failure count.
 * Schedule: 30s, 60s, 120s, 300s, 600s (capped).
 */
export function computeBackoffMs(consecutiveFailures: number): number {
	if (consecutiveFailures <= 0) return 0;
	const idx = Math.min(consecutiveFailures - 1, BACKOFF_SCHEDULE_MS.length - 1);
	return BACKOFF_SCHEDULE_MS[idx];
}
