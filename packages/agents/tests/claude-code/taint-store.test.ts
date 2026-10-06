import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
	mkdtempSync,
	rmSync,
	existsSync,
	readdirSync,
	statSync,
	readFileSync,
	symlinkSync,
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
		// sha256(ses_atomic).json — file exists at the derived path
		expect(files.some((f) => f.endsWith(".json"))).toBe(true);
		// And it's exactly the path our function derives
		const expectedName =
			getTaintSnapshotPath("ses_atomic").split("/").pop() as string;
		expect(files).toContain(expectedName);
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

	// -----------------------------------------------------------------------
	// R1 regression tests
	// -----------------------------------------------------------------------

	it("R1-007: distinct session ids hash to distinct paths (no collision)", () => {
		// Old sanitizer mapped 'a/b' and 'a_b' to the same path.
		const p1 = getTaintSnapshotPath("a/b");
		const p2 = getTaintSnapshotPath("a_b");
		expect(p1).not.toBe(p2);
	});

	it("R1-007: session_id mismatch in file body causes readTaintSnapshot to return null", () => {
		// Write a snapshot whose internal session_id is 'forged' at the path
		// for 'ses_real'. The integrity check in readTaintSnapshot must reject.
		const realPath = getTaintSnapshotPath("ses_real");
		const dir = getTaintDir();
		mkdirSync(dir, { recursive: true, mode: 0o700 });
		const bogus = createSnapshot("ses_forged"); // wrong id
		writeFileSync(realPath, JSON.stringify(bogus, null, 2), {
			mode: 0o600,
		});
		// Reader asks for ses_real but file says ses_forged → null
		expect(readTaintSnapshot("ses_real")).toBeNull();
	});

	it("R1-002: pending marker present alongside snapshot collapses read to null", () => {
		// Set up a valid snapshot
		writeTaintSnapshot(createSnapshot("ses_pending"));
		expect(readTaintSnapshot("ses_pending")).not.toBeNull();

		// Now mark it pending — simulating a writer crashed mid-write
		const pendingPath = getTaintSnapshotPath("ses_pending").replace(
			/\.json$/,
			".pending",
		);
		writeFileSync(pendingPath, "", { mode: 0o600 });

		// Reader fails closed
		expect(readTaintSnapshot("ses_pending")).toBeNull();

		// Clear the marker — reader trusts the file again
		rmSync(pendingPath);
		expect(readTaintSnapshot("ses_pending")).not.toBeNull();
	});

	// F3: refuse to follow symlinks on taint-store paths. Mirrors the
	// installer.ts defence for `.claude/` and settings.json. The point of
	// each test is that VALID content behind a symlink is still refused:
	// the question is not "is this snapshot well-formed" but "is this the
	// file we wrote".
	describe("F3 / R1-xxx: symlink refusal on taint paths", () => {
		const sessionId = "ses_f3_symlink";

		it("read returns null when the snapshot path is a symlink", () => {
			const taintDir = getTaintDir();
			mkdirSync(taintDir, { recursive: true, mode: 0o700 });

			// A perfectly valid snapshot, parked somewhere the agent chose.
			const decoy = join(tmpDir, "decoy-snapshot.json");
			const valid = createSnapshot(sessionId);
			writeFileSync(decoy, JSON.stringify(valid, null, 2) + "\n", {
				mode: 0o600,
			});

			symlinkSync(decoy, getTaintSnapshotPath(sessionId));

			// Fails closed despite the target parsing cleanly.
			expect(readTaintSnapshot(sessionId)).toBeNull();
		});

		it("read returns null when the taint directory is a symlink", () => {
			const decoyDir = join(tmpDir, "decoy-taint-dir");
			mkdirSync(decoyDir, { recursive: true, mode: 0o700 });
			mkdirSync(join(tmpDir, ".patchwork"), { recursive: true, mode: 0o700 });

			const valid = createSnapshot(sessionId);
			writeFileSync(
				join(decoyDir, getTaintSnapshotPath(sessionId).split("/").pop() as string),
				JSON.stringify(valid, null, 2) + "\n",
				{ mode: 0o600 },
			);

			symlinkSync(decoyDir, getTaintDir());

			expect(readTaintSnapshot(sessionId)).toBeNull();
		});

		it("write throws when the snapshot path is a symlink", () => {
			const taintDir = getTaintDir();
			mkdirSync(taintDir, { recursive: true, mode: 0o700 });

			const decoy = join(tmpDir, "write-decoy.json");
			writeFileSync(decoy, "{}\n", { mode: 0o600 });
			symlinkSync(decoy, getTaintSnapshotPath(sessionId));

			expect(() => writeTaintSnapshot(createSnapshot(sessionId))).toThrow(
				/symlink/i,
			);
			// The decoy must be untouched — the refusal happens before any write.
			expect(readdirSync(tmpDir)).toContain("write-decoy.json");
			expect(JSON.parse(readFileSync(decoy, "utf-8"))).toEqual({});
		});

		it("write throws when the taint directory is a symlink", () => {
			const decoyDir = join(tmpDir, "write-decoy-dir");
			mkdirSync(decoyDir, { recursive: true, mode: 0o700 });
			mkdirSync(join(tmpDir, ".patchwork"), { recursive: true, mode: 0o700 });
			symlinkSync(decoyDir, getTaintDir());

			expect(() => writeTaintSnapshot(createSnapshot(sessionId))).toThrow(
				/symlink/i,
			);
			// Nothing was written through the redirected directory.
			expect(readdirSync(decoyDir)).toEqual([]);
		});

		it("a normal (non-symlink) snapshot still round-trips", () => {
			const snap = createSnapshot(sessionId);
			writeTaintSnapshot(snap);
			const read = readTaintSnapshot(sessionId);
			expect(read).not.toBeNull();
			expect(read?.session_id).toBe(sessionId);
		});
	});

});
