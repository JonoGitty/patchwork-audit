import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readCursor, writeCursor } from "../../src/sync/cursor.js";
import { DEFAULT_SYNC_CURSOR } from "../../src/protocol.js";

describe("sync cursor", () => {
	let tmpDir: string;
	let cursorPath: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-cursor-test-"));
		cursorPath = join(tmpDir, "team", "sync-cursor.json");
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("returns default cursor when file missing", () => {
		const cursor = readCursor(cursorPath);
		expect(cursor).toEqual(DEFAULT_SYNC_CURSOR);
	});

	it("round-trips write and read", () => {
		const cursor = {
			...DEFAULT_SYNC_CURSOR,
			last_synced_offset: 12345,
			last_synced_event_hash: "sha256:abc",
			last_synced_at: "2026-04-04T12:00:00Z",
			consecutive_failures: 0,
		};
		writeCursor(cursor, cursorPath);
		const loaded = readCursor(cursorPath);
		expect(loaded).toEqual(cursor);
	});

	it("creates directory if missing", () => {
		writeCursor(DEFAULT_SYNC_CURSOR, cursorPath);
		expect(existsSync(cursorPath)).toBe(true);
	});

	it("returns default for corrupt file", () => {
		const { writeFileSync, mkdirSync } = require("node:fs");
		const { dirname } = require("node:path");
		mkdirSync(dirname(cursorPath), { recursive: true });
		writeFileSync(cursorPath, "corrupt json{{{");
		expect(readCursor(cursorPath)).toEqual(DEFAULT_SYNC_CURSOR);
	});

	it("overwrites previous cursor atomically", () => {
		writeCursor({ ...DEFAULT_SYNC_CURSOR, last_synced_offset: 100 }, cursorPath);
		writeCursor({ ...DEFAULT_SYNC_CURSOR, last_synced_offset: 200 }, cursorPath);
		expect(readCursor(cursorPath).last_synced_offset).toBe(200);
	});
});
