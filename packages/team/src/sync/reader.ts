/**
 * Relay log reader — reads new events from the relay log starting at a byte offset.
 */

import { openSync, readSync, closeSync, statSync } from "node:fs";
import { MAX_BATCH_EVENTS, MAX_BATCH_BYTES } from "../constants.js";
import { RELAY_LOG_PATH } from "@patchwork/core";

export interface ReadResult {
	events: Record<string, unknown>[];
	newByteOffset: number;
	bytesRead: number;
}

/**
 * Read new events from the relay log starting at byteOffset.
 * Skips heartbeat records. Stops at MAX_BATCH_EVENTS or MAX_BATCH_BYTES.
 * Returns only complete lines (doesn't advance past a partial line at EOF).
 */
export function readNewEvents(
	logPath?: string,
	byteOffset = 0,
	maxEvents = MAX_BATCH_EVENTS,
	maxBytes = MAX_BATCH_BYTES,
): ReadResult {
	const p = logPath ?? RELAY_LOG_PATH;

	let fileSize: number;
	try {
		fileSize = statSync(p).size;
	} catch {
		return { events: [], newByteOffset: byteOffset, bytesRead: 0 };
	}

	if (byteOffset >= fileSize) {
		return { events: [], newByteOffset: byteOffset, bytesRead: 0 };
	}

	// Read the new bytes
	const bytesToRead = Math.min(fileSize - byteOffset, maxBytes);
	const buffer = Buffer.alloc(bytesToRead);
	const fd = openSync(p, "r");
	try {
		readSync(fd, buffer, 0, bytesToRead, byteOffset);
	} finally {
		closeSync(fd);
	}

	const raw = buffer.toString("utf-8");
	const lines = raw.split("\n");

	const events: Record<string, unknown>[] = [];
	let consumedBytes = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Last element after split: empty string if file ends with \n, or partial line
		if (i === lines.length - 1) {
			if (line.length === 0) break; // Trailing \n produced empty string — nothing to consume
			if (!raw.endsWith("\n")) break; // Partial line at EOF — don't consume
		}

		// Account for the newline delimiter
		consumedBytes += Buffer.byteLength(line, "utf-8") + 1; // +1 for \n

		if (line.trim().length === 0) continue;

		try {
			const parsed = JSON.parse(line);

			// Skip heartbeat records
			if (parsed.type === "heartbeat") continue;

			events.push(parsed);

			if (events.length >= maxEvents) break;
		} catch {
			// Skip corrupt lines
		}
	}

	return {
		events,
		newByteOffset: byteOffset + consumedBytes,
		bytesRead: consumedBytes,
	};
}
