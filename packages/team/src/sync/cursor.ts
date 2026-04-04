/**
 * Sync cursor — tracks position in the relay log for incremental sync.
 */

import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { SyncCursorSchema, DEFAULT_SYNC_CURSOR, type SyncCursor } from "../protocol.js";
import { SYNC_CURSOR_PATH } from "../constants.js";

/**
 * Read the sync cursor from disk. Returns default cursor if missing or corrupt.
 */
export function readCursor(cursorPath?: string): SyncCursor {
	const p = cursorPath ?? SYNC_CURSOR_PATH;

	if (!existsSync(p)) return { ...DEFAULT_SYNC_CURSOR };

	try {
		const content = readFileSync(p, "utf-8");
		const parsed = SyncCursorSchema.safeParse(JSON.parse(content));
		if (parsed.success) return parsed.data;
		return { ...DEFAULT_SYNC_CURSOR };
	} catch {
		return { ...DEFAULT_SYNC_CURSOR };
	}
}

/**
 * Write the sync cursor atomically (tmp + rename).
 */
export function writeCursor(cursor: SyncCursor, cursorPath?: string): void {
	const p = cursorPath ?? SYNC_CURSOR_PATH;
	const dir = dirname(p);

	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true, mode: 0o700 });
	}

	const tmpPath = `${p}.${randomBytes(4).toString("hex")}.tmp`;
	writeFileSync(tmpPath, JSON.stringify(cursor, null, 2) + "\n", { mode: 0o600 });
	renameSync(tmpPath, p);
}
