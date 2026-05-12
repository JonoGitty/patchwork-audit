import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
	mkdtempSync,
	rmSync,
	existsSync,
	readdirSync,
	statSync,
	writeFileSync,
	mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	createSnapshot,
	registerTaint,
} from "@patchwork/core";
import {
	getTaintDir,
	getTaintSnapshotPath,
	loadOrInitSnapshot,
	readTaintSnapshot,
	writeTaintSnapshot,
} from "../../src/claude-code/taint-store.js";

describe("taint-store", () => {
	let originalHome: string | undefined;
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-taint-test-"));
		originalHome = process.env.HOME;
		process.env.HOME = tmpDir;
	});

	afterEach(() => {
		process.env.HOME = originalHome;
		try {
			rmSync(tmpDir, { recursive: true, force: true });
		} catch {
			// best effort
		}
	});

	it("derives the taint dir under $HOME/.patchwork/taint", () => {
		expect(getTaintDir()).toBe(join(tmpDir, ".patchwork", "taint"));
	});

	it("sanitizes session_id into a safe filename", () => {
		// Path traversal must collapse: `..` would otherwise escape the dir
		const evil = "../etc/passwd";
		const p = getTaintSnapshotPath(evil);
		expect(p.startsWith(getTaintDir())).toBe(true);
		expect(p.endsWith(".json")).toBe(true);
		// No raw slashes from the session id should appear after the dir
		const tail = p.slice(getTaintDir().length + 1);
		expect(tail.includes("/")).toBe(false);
	});

	it("roundtrips a snapshot through write+read", () => {
		const snap = registerTaint(
			createSnapshot("ses_roundtrip"),
			"prompt",
			{ ts: 12345, ref: "/docs/README.md", content_hash: "sha256:abc" },
		);
		writeTaintSnapshot(snap);
		const back = readTaintSnapshot("ses_roundtrip");
		expect(back).not.toBeNull();
		expect(back!.session_id).toBe("ses_roundtrip");
		expect(back!.by_kind.prompt).toHaveLength(1);
		expect(back!.by_kind.prompt[0].ref).toBe("/docs/README.md");
	});

	it("writes the snapshot file with mode 0600 and dir 0700", () => {
		const snap = createSnapshot("ses_modecheck");
		writeTaintSnapshot(snap);

		const filePath = getTaintSnapshotPath("ses_modecheck");
		const dirPath = getTaintDir();

		expect(existsSync(filePath)).toBe(true);
		const fileMode = statSync(filePath).mode & 0o777;
		expect(fileMode).toBe(0o600);

		const dirMode = statSync(dirPath).mode & 0o777;
		expect(dirMode).toBe(0o700);
	});

	it("write is atomic — no leftover .tmp on success", () => {
		const snap = createSnapshot("ses_atomic");
		writeTaintSnapshot(snap);
		const files = readdirSync(getTaintDir());
		expect(files.some((f) => f.endsWith(".tmp"))).toBe(false);
		expect(files.some((f) => f === "ses_atomic.json")).toBe(true);
	});

	it("readTaintSnapshot returns null for a missing file", () => {
		expect(readTaintSnapshot("ses_missing")).toBeNull();
	});

	it("readTaintSnapshot returns null for corrupt JSON (sink fail-closed bait)", () => {
		const dir = getTaintDir();
		mkdirSync(dir, { recursive: true, mode: 0o700 });
		const p = getTaintSnapshotPath("ses_corrupt");
		writeFileSync(p, "{not valid json", { mode: 0o600 });

		// commit 8 must treat this null as all-kinds-active and force approval
		expect(readTaintSnapshot("ses_corrupt")).toBeNull();
	});

	it("readTaintSnapshot returns null for schema-invalid content", () => {
		const dir = getTaintDir();
		mkdirSync(dir, { recursive: true, mode: 0o700 });
		const p = getTaintSnapshotPath("ses_badshape");
		writeFileSync(
			p,
			JSON.stringify({ session_id: 123, by_kind: "not-an-object" }),
			{ mode: 0o600 },
		);

		expect(readTaintSnapshot("ses_badshape")).toBeNull();
	});

	it("loadOrInitSnapshot falls back to a fresh snapshot when missing", () => {
		const snap = loadOrInitSnapshot("ses_fresh");
		expect(snap.session_id).toBe("ses_fresh");
		expect(snap.by_kind.prompt).toEqual([]);
		expect(snap.by_kind.secret).toEqual([]);
		expect(snap.generated_files).toEqual({});
	});

	it("loadOrInitSnapshot returns the persisted snapshot when present", () => {
		const seeded = registerTaint(
			createSnapshot("ses_seeded"),
			"network_content",
			{ ts: 1, ref: "https://example.test", content_hash: "sha256:x" },
		);
		writeTaintSnapshot(seeded);

		const back = loadOrInitSnapshot("ses_seeded");
		expect(back.by_kind.network_content).toHaveLength(1);
		expect(back.by_kind.network_content[0].ref).toBe("https://example.test");
	});

	it("loadOrInitSnapshot recovers from a corrupt file by re-initializing", () => {
		const dir = getTaintDir();
		mkdirSync(dir, { recursive: true, mode: 0o700 });
		const p = getTaintSnapshotPath("ses_recover");
		writeFileSync(p, "JUNK", { mode: 0o600 });

		// loadOrInit is the writer-side path; corrupt → empty snapshot so
		// the next write produces a clean file (commit 8 still fails closed
		// because it reads via readTaintSnapshot, not loadOrInit).
		const snap = loadOrInitSnapshot("ses_recover");
		expect(snap.session_id).toBe("ses_recover");
		expect(snap.by_kind.prompt).toEqual([]);
	});

	it("repeated writes overwrite cleanly", () => {
		writeTaintSnapshot(createSnapshot("ses_overwrite"));
		const second = registerTaint(
			createSnapshot("ses_overwrite"),
			"mcp",
			{ ts: 99, ref: "mcp__foo__bar", content_hash: "sha256:y" },
		);
		writeTaintSnapshot(second);

		const back = readTaintSnapshot("ses_overwrite");
		expect(back!.by_kind.mcp).toHaveLength(1);
		expect(back!.by_kind.prompt).toEqual([]);
	});
});
