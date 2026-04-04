/**
 * Seal reader — reads new seals from the seals log.
 */

import { existsSync, readFileSync } from "node:fs";
import { RELAY_SEALS_PATH } from "@patchwork/core";

/**
 * Read seals newer than the given timestamp.
 * Returns all seals if lastSealTimestamp is null.
 */
export function readNewSeals(
	sealsPath?: string,
	lastSealTimestamp?: string | null,
): Record<string, unknown>[] {
	const p = sealsPath ?? RELAY_SEALS_PATH;

	if (!existsSync(p)) return [];

	try {
		const content = readFileSync(p, "utf-8");
		const lines = content.split("\n").filter((l) => l.trim().length > 0);
		const seals: Record<string, unknown>[] = [];

		for (const line of lines) {
			try {
				const seal = JSON.parse(line);
				if (lastSealTimestamp && seal.sealed_at && seal.sealed_at <= lastSealTimestamp) {
					continue;
				}
				seals.push(seal);
			} catch {
				// Skip corrupt lines
			}
		}

		return seals;
	} catch {
		return [];
	}
}
