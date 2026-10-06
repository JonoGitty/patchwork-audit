import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
	mkdtempSync,
	rmSync,
	existsSync,
	readdirSync,
	statSync,
	readFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSnapshot } from "@patchwork/core";

// F2 (R1-011): assert the durable-write path actually calls fsync.
// node:fs is spied rather than replaced, so every other fs call in
// taint-store.ts behaves normally. This lives in its own test file
// because the module mock is hoisted and would otherwise apply to the
// whole of taint-store.test.ts.
vi.mock("node:fs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs")>();
	return {
		...actual,
		default: actual,
		fsyncSync: vi.fn(actual.fsyncSync),
	};
});

const fs = await import("node:fs");
const { writeTaintSnapshot, getTaintDir } = await import(
	"../../src/claude-code/taint-store.js"
);

describe("taint-store durability (F2 / R1-011)", () => {
	let originalHome: string | undefined;
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-taint-fsync-"));
		originalHome = process.env.HOME;
		process.env.HOME = tmpDir;
		vi.mocked(fs.fsyncSync).mockClear();
	});

	afterEach(() => {
		process.env.HOME = originalHome;
		try {
			rmSync(tmpDir, { recursive: true, force: true });
		} catch {
			// best effort
		}
	});

	it("fsyncs the snapshot before it is visible at the final path", () => {
		const snap = createSnapshot("ses_fsync_1");
		writeTaintSnapshot(snap);

		// At least twice: once for the temp file, once best-effort for the
		// parent directory so the rename itself is durable.
		expect(vi.mocked(fs.fsyncSync).mock.calls.length).toBeGreaterThanOrEqual(2);
	});

	it("leaves no temp file behind after a successful write", () => {
		const snap = createSnapshot("ses_fsync_2");
		writeTaintSnapshot(snap);

		const leftovers = readdirSync(getTaintDir()).filter((f) =>
			f.endsWith(".tmp"),
		);
		expect(leftovers).toEqual([]);
	});

	it("still writes complete, parseable, owner-only content", () => {
		const snap = createSnapshot("ses_fsync_3");
		writeTaintSnapshot(snap);

		const path = join(
			getTaintDir(),
			readdirSync(getTaintDir()).find((f) => f.endsWith(".json")) as string,
		);
		expect(existsSync(path)).toBe(true);
		expect(statSync(path).mode & 0o777).toBe(0o600);

		const parsed = JSON.parse(readFileSync(path, "utf-8"));
		expect(parsed.session_id).toBe("ses_fsync_3");
	});
});
