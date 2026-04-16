import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Windows does not enforce POSIX file permissions (chmod 0o600/0o700 is a no-op)
const isWindows = process.platform === "win32";

import { Readable, Writable } from "node:stream";
import { mkdtempSync, rmSync, readFileSync, existsSync, statSync, mkdirSync, chmodSync, writeFileSync, openSync, closeSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

/**
 * Helper: run `patchwork hook <event>` with controlled stdin, capturing stdout/stderr.
 *
 * Uses vi.resetModules() so each invocation gets a fresh module graph,
 * allowing env vars and mocks to take effect cleanly.
 */
async function runHook(
	event: string,
	stdinData: string,
	env: Record<string, string> = {},
): Promise<{ stdout: string; stderr: string }> {
	// Apply env overrides
	const savedEnv: Record<string, string | undefined> = {};
	for (const [k, v] of Object.entries(env)) {
		savedEnv[k] = process.env[k];
		process.env[k] = v;
	}

	// Capture stdout and stderr
	let stdoutBuf = "";
	let stderrBuf = "";
	const origStdoutWrite = process.stdout.write;
	const origStderrWrite = process.stderr.write;
	process.stdout.write = ((chunk: string | Buffer) => {
		stdoutBuf += typeof chunk === "string" ? chunk : chunk.toString();
		return true;
	}) as typeof process.stdout.write;
	process.stderr.write = ((chunk: string | Buffer) => {
		stderrBuf += typeof chunk === "string" ? chunk : chunk.toString();
		return true;
	}) as typeof process.stderr.write;

	// Replace stdin with a readable stream containing our data
	const fakeStdin = new Readable({
		read() {
			this.push(stdinData || null);
			this.push(null);
		},
	});
	const origStdin = process.stdin;
	Object.defineProperty(process, "stdin", { value: fakeStdin, writable: true, configurable: true });

	try {
		vi.resetModules();
		const { hookCommand } = await import("../../src/commands/hook.js");
		await hookCommand.parseAsync(["node", "hook", event], { from: "node" });
		// Small delay to let any async resolution finish
		await new Promise((resolve) => setTimeout(resolve, 50));
	} finally {
		process.stdout.write = origStdoutWrite;
		process.stderr.write = origStderrWrite;
		Object.defineProperty(process, "stdin", { value: origStdin, writable: true, configurable: true });
		for (const [k, v] of Object.entries(savedEnv)) {
			if (v === undefined) {
				delete process.env[k];
			} else {
				process.env[k] = v;
			}
		}
	}

	return { stdout: stdoutBuf, stderr: stderrBuf };
}

describe("hook pre-tool fail-closed mode", () => {
	it("A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted", async () => {
		const { stdout } = await runHook("pre-tool", "NOT_JSON", {
			PATCHWORK_PRETOOL_FAIL_CLOSED: "1",
		});
		const parsed = JSON.parse(stdout);
		expect(parsed.hookSpecificOutput.permissionDecision).toBe("deny");
		expect(parsed.hookSpecificOutput.permissionDecisionReason).toContain("fail-closed");
	});

	it("B: PreToolUse + fail-closed disabled + invalid JSON => no deny output", async () => {
		const { stdout } = await runHook("pre-tool", "NOT_JSON", {});
		expect(stdout).toBe("");
	});

	it("C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output", async () => {
		const { stdout } = await runHook("post-tool", "NOT_JSON", {
			PATCHWORK_PRETOOL_FAIL_CLOSED: "1",
		});
		expect(stdout).toBe("");
	});

	it("A2: PreToolUse + fail-closed + empty stdin => deny JSON emitted", async () => {
		const { stdout } = await runHook("pre-tool", "", {
			PATCHWORK_PRETOOL_FAIL_CLOSED: "1",
		});
		const parsed = JSON.parse(stdout);
		expect(parsed.hookSpecificOutput.permissionDecision).toBe("deny");
		expect(parsed.hookSpecificOutput.permissionDecisionReason).toContain("fail-closed");
	});
});

describe("hook PreToolUse latency warning", () => {
	it("D: latency warning emitted when elapsed > threshold", async () => {
		// Mock Date.now to simulate slow execution
		let callCount = 0;
		const origDateNow = Date.now;
		Date.now = () => {
			callCount++;
			// First call (start): return baseline. Second call (end): +2000ms.
			return callCount <= 1 ? 1000 : 3000;
		};
		try {
			const { stderr } = await runHook("pre-tool", "NOT_JSON", {
				PATCHWORK_PRETOOL_WARN_MS: "500",
				PATCHWORK_PRETOOL_FAIL_CLOSED: "1",
			});
			expect(stderr).toContain("PreToolUse hook took 2000ms");
			expect(stderr).toContain("threshold: 500ms");
		} finally {
			Date.now = origDateNow;
		}
	});

	it("no latency warning for non-PreToolUse events", async () => {
		const { stderr } = await runHook("post-tool", "NOT_JSON", {
			PATCHWORK_PRETOOL_WARN_MS: "0",
		});
		expect(stderr).not.toContain("PreToolUse hook took");
	});
});

describe("hook PreToolUse structured telemetry", () => {
	it("D: telemetry JSON emitted for PreToolUse with required fields", async () => {
		const { stderr } = await runHook("pre-tool", "NOT_JSON", {
			PATCHWORK_PRETOOL_TELEMETRY_JSON: "1",
			PATCHWORK_PRETOOL_FAIL_CLOSED: "1",
			PATCHWORK_PRETOOL_WARN_MS: "500",
		});
		const lines = stderr.trim().split("\n");
		const telemetry = JSON.parse(lines[lines.length - 1]);
		expect(telemetry.event).toBe("PreToolUse");
		expect(typeof telemetry.ts).toBe("string");
		expect(typeof telemetry.elapsed_ms).toBe("number");
		expect(telemetry.warn_threshold_ms).toBe(500);
		expect(typeof telemetry.warn_triggered).toBe("boolean");
		expect(telemetry.fail_closed_enabled).toBe(true);
		expect(telemetry.outcome).toBe("internal_error");
		expect(typeof telemetry.reason).toBe("string");
	});

	it("E: non-PreToolUse emits no telemetry JSON", async () => {
		const { stderr } = await runHook("post-tool", "NOT_JSON", {
			PATCHWORK_PRETOOL_TELEMETRY_JSON: "1",
		});
		// No JSON line should be present
		const lines = stderr.trim().split("\n").filter(Boolean);
		for (const line of lines) {
			let parsed: any;
			try { parsed = JSON.parse(line); } catch { continue; }
			expect(parsed.event).not.toBe("PreToolUse");
		}
	});

	it("F: fail-closed internal error reports telemetry outcome internal_error", async () => {
		const { stderr } = await runHook("pre-tool", "", {
			PATCHWORK_PRETOOL_TELEMETRY_JSON: "1",
			PATCHWORK_PRETOOL_FAIL_CLOSED: "1",
		});
		const lines = stderr.trim().split("\n").filter(Boolean);
		const telemetry = JSON.parse(lines[lines.length - 1]);
		expect(telemetry.outcome).toBe("internal_error");
		expect(telemetry.fail_closed_enabled).toBe(true);
		expect(telemetry.reason).toContain("fail-closed");
	});

	it("telemetry JSON replaces human-readable warning when enabled", async () => {
		let callCount = 0;
		const origDateNow = Date.now;
		Date.now = () => {
			callCount++;
			return callCount <= 1 ? 1000 : 3000;
		};
		try {
			const { stderr } = await runHook("pre-tool", "NOT_JSON", {
				PATCHWORK_PRETOOL_TELEMETRY_JSON: "1",
				PATCHWORK_PRETOOL_FAIL_CLOSED: "1",
				PATCHWORK_PRETOOL_WARN_MS: "500",
			});
			// Should have JSON telemetry, not human-readable warning
			expect(stderr).not.toContain("[patchwork] PreToolUse hook took");
			const lines = stderr.trim().split("\n").filter(Boolean);
			const telemetry = JSON.parse(lines[lines.length - 1]);
			expect(telemetry.warn_triggered).toBe(true);
			expect(telemetry.elapsed_ms).toBe(2000);
		} finally {
			Date.now = origDateNow;
		}
	});
});

describe("hook PreToolUse telemetry file sink", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-telemetry-sink-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("A: writes valid JSON line to file when dest=file", async () => {
		const telemetryFile = join(tmpDir, "telemetry", "pretool.jsonl");

		const { stderr } = await runHook("pre-tool", "NOT_JSON", {
			PATCHWORK_PRETOOL_TELEMETRY_JSON: "1",
			PATCHWORK_PRETOOL_FAIL_CLOSED: "1",
			PATCHWORK_PRETOOL_TELEMETRY_DEST: "file",
			PATCHWORK_PRETOOL_TELEMETRY_FILE: telemetryFile,
		});

		// stderr should NOT have JSON telemetry (dest=file only)
		const stderrLines = stderr.trim().split("\n").filter(Boolean);
		for (const line of stderrLines) {
			let parsed: any;
			try { parsed = JSON.parse(line); } catch { continue; }
			expect(parsed.event).not.toBe("PreToolUse");
		}

		// File should have exactly one valid JSON line
		expect(existsSync(telemetryFile)).toBe(true);
		const content = readFileSync(telemetryFile, "utf-8").trim();
		const record = JSON.parse(content);
		expect(record.event).toBe("PreToolUse");
		expect(typeof record.ts).toBe("string");
		expect(typeof record.elapsed_ms).toBe("number");
		expect(record.outcome).toBe("internal_error");
	});

	it("B: writes to both stderr and file when dest=both", async () => {
		const telemetryFile = join(tmpDir, "telemetry", "pretool.jsonl");

		const { stderr } = await runHook("pre-tool", "NOT_JSON", {
			PATCHWORK_PRETOOL_TELEMETRY_JSON: "1",
			PATCHWORK_PRETOOL_FAIL_CLOSED: "1",
			PATCHWORK_PRETOOL_TELEMETRY_DEST: "both",
			PATCHWORK_PRETOOL_TELEMETRY_FILE: telemetryFile,
		});

		// stderr should have JSON telemetry
		const stderrLines = stderr.trim().split("\n").filter(Boolean);
		const stderrRecord = JSON.parse(stderrLines[stderrLines.length - 1]);
		expect(stderrRecord.event).toBe("PreToolUse");

		// File should also have telemetry
		expect(existsSync(telemetryFile)).toBe(true);
		const fileRecord = JSON.parse(readFileSync(telemetryFile, "utf-8").trim());
		expect(fileRecord.event).toBe("PreToolUse");
	});

	it.skipIf(isWindows)("C: file/dir permissions are enforced (0o600/0o700)", async () => {
		const telemetryFile = join(tmpDir, "telemetry", "pretool.jsonl");

		await runHook("pre-tool", "NOT_JSON", {
			PATCHWORK_PRETOOL_TELEMETRY_JSON: "1",
			PATCHWORK_PRETOOL_FAIL_CLOSED: "1",
			PATCHWORK_PRETOOL_TELEMETRY_DEST: "file",
			PATCHWORK_PRETOOL_TELEMETRY_FILE: telemetryFile,
		});

		expect(existsSync(telemetryFile)).toBe(true);
		const fileStat = statSync(telemetryFile);
		expect(fileStat.mode & 0o777).toBe(0o600);
		const dirStat = statSync(join(tmpDir, "telemetry"));
		expect(dirStat.mode & 0o777).toBe(0o700);
	});

	it("D: file write failure does not change allow/deny output path", async () => {
		// Point to a path that cannot be written (dir is a regular file)
		mkdirSync(tmpDir, { recursive: true });
		// Create a regular file where the dir should be, making mkdir fail
		writeFileSync(join(tmpDir, "blocker"), "not-a-dir");
		const telemetryFile = join(tmpDir, "blocker", "sub", "pretool.jsonl");

		const { stdout, stderr } = await runHook("pre-tool", "NOT_JSON", {
			PATCHWORK_PRETOOL_TELEMETRY_JSON: "1",
			PATCHWORK_PRETOOL_FAIL_CLOSED: "1",
			PATCHWORK_PRETOOL_TELEMETRY_DEST: "file",
			PATCHWORK_PRETOOL_TELEMETRY_FILE: telemetryFile,
		});

		// Fail-closed deny should still be emitted on stdout
		const parsed = JSON.parse(stdout);
		expect(parsed.hookSpecificOutput.permissionDecision).toBe("deny");
		expect(parsed.hookSpecificOutput.permissionDecisionReason).toContain("fail-closed");

		// stderr should contain the warning about failed write
		expect(stderr).toContain("telemetry file write failed");
	});
});

describe("hook PreToolUse telemetry file rotation", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-telemetry-rotate-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("A: rotation triggers when max bytes exceeded", async () => {
		const telemetryDir = join(tmpDir, "telemetry");
		mkdirSync(telemetryDir, { recursive: true, mode: 0o700 });
		const telemetryFile = join(telemetryDir, "pretool.jsonl");

		// Seed the file with enough data to exceed a small max
		const seedLine = JSON.stringify({ event: "PreToolUse", ts: "old", seeded: true }) + "\n";
		writeFileSync(telemetryFile, seedLine, { mode: 0o600 });
		const seedSize = Buffer.byteLength(seedLine);

		// Set max-bytes to seed size so next append triggers rotation
		await runHook("pre-tool", "NOT_JSON", {
			PATCHWORK_PRETOOL_TELEMETRY_JSON: "1",
			PATCHWORK_PRETOOL_FAIL_CLOSED: "1",
			PATCHWORK_PRETOOL_TELEMETRY_DEST: "file",
			PATCHWORK_PRETOOL_TELEMETRY_FILE: telemetryFile,
			PATCHWORK_PRETOOL_TELEMETRY_MAX_BYTES: String(seedSize),
			PATCHWORK_PRETOOL_TELEMETRY_MAX_FILES: "3",
		});

		// Active file should contain only the new line
		expect(existsSync(telemetryFile)).toBe(true);
		const activeContent = readFileSync(telemetryFile, "utf-8").trim();
		const activeRecord = JSON.parse(activeContent);
		expect(activeRecord.seeded).toBeUndefined(); // new record, not seeded
		expect(activeRecord.event).toBe("PreToolUse");

		// Old data should be in pretool.1.jsonl
		const rotated1 = join(telemetryDir, "pretool.1.jsonl");
		expect(existsSync(rotated1)).toBe(true);
		const rotatedContent = readFileSync(rotated1, "utf-8").trim();
		const rotatedRecord = JSON.parse(rotatedContent);
		expect(rotatedRecord.seeded).toBe(true);
	});

	it("B: rotation keeps only configured max files", async () => {
		const telemetryDir = join(tmpDir, "telemetry");
		mkdirSync(telemetryDir, { recursive: true, mode: 0o700 });
		const telemetryFile = join(telemetryDir, "pretool.jsonl");

		// Pre-populate 3 rotated files to simulate prior rotations
		for (let i = 1; i <= 3; i++) {
			writeFileSync(
				join(telemetryDir, `pretool.${i}.jsonl`),
				JSON.stringify({ old: i }) + "\n",
				{ mode: 0o600 },
			);
		}
		// Seed active file so it exceeds max-bytes
		const seedLine = JSON.stringify({ event: "PreToolUse", ts: "seed" }) + "\n";
		writeFileSync(telemetryFile, seedLine, { mode: 0o600 });

		await runHook("pre-tool", "NOT_JSON", {
			PATCHWORK_PRETOOL_TELEMETRY_JSON: "1",
			PATCHWORK_PRETOOL_FAIL_CLOSED: "1",
			PATCHWORK_PRETOOL_TELEMETRY_DEST: "file",
			PATCHWORK_PRETOOL_TELEMETRY_FILE: telemetryFile,
			PATCHWORK_PRETOOL_TELEMETRY_MAX_BYTES: "1", // force rotation
			PATCHWORK_PRETOOL_TELEMETRY_MAX_FILES: "2",
		});

		// Should have active + .1 + .2 only (max_files=2)
		expect(existsSync(telemetryFile)).toBe(true);
		expect(existsSync(join(telemetryDir, "pretool.1.jsonl"))).toBe(true);
		expect(existsSync(join(telemetryDir, "pretool.2.jsonl"))).toBe(true);
		// .3 should have been deleted
		expect(existsSync(join(telemetryDir, "pretool.3.jsonl"))).toBe(false);
	});

	it("C: no rotation when disabled (max-bytes=0 or absent)", async () => {
		const telemetryDir = join(tmpDir, "telemetry");
		mkdirSync(telemetryDir, { recursive: true, mode: 0o700 });
		const telemetryFile = join(telemetryDir, "pretool.jsonl");

		// Seed with data
		const seedLine = JSON.stringify({ event: "PreToolUse", ts: "seed" }) + "\n";
		writeFileSync(telemetryFile, seedLine, { mode: 0o600 });

		// Run without max-bytes (disabled by default)
		await runHook("pre-tool", "NOT_JSON", {
			PATCHWORK_PRETOOL_TELEMETRY_JSON: "1",
			PATCHWORK_PRETOOL_FAIL_CLOSED: "1",
			PATCHWORK_PRETOOL_TELEMETRY_DEST: "file",
			PATCHWORK_PRETOOL_TELEMETRY_FILE: telemetryFile,
		});

		// No rotated files should exist
		expect(existsSync(join(telemetryDir, "pretool.1.jsonl"))).toBe(false);

		// Active file should have both lines (seed + new)
		const lines = readFileSync(telemetryFile, "utf-8").trim().split("\n");
		expect(lines).toHaveLength(2);
		expect(JSON.parse(lines[0]).ts).toBe("seed");
		expect(JSON.parse(lines[1]).event).toBe("PreToolUse");
	});

	it.skipIf(isWindows)("D: rotated files keep secure perms (0o600)", async () => {
		const telemetryDir = join(tmpDir, "telemetry");
		mkdirSync(telemetryDir, { recursive: true, mode: 0o700 });
		const telemetryFile = join(telemetryDir, "pretool.jsonl");

		// Seed file
		writeFileSync(telemetryFile, JSON.stringify({ seed: true }) + "\n", { mode: 0o600 });

		await runHook("pre-tool", "NOT_JSON", {
			PATCHWORK_PRETOOL_TELEMETRY_JSON: "1",
			PATCHWORK_PRETOOL_FAIL_CLOSED: "1",
			PATCHWORK_PRETOOL_TELEMETRY_DEST: "file",
			PATCHWORK_PRETOOL_TELEMETRY_FILE: telemetryFile,
			PATCHWORK_PRETOOL_TELEMETRY_MAX_BYTES: "1",
			PATCHWORK_PRETOOL_TELEMETRY_MAX_FILES: "3",
		});

		const rotated1 = join(telemetryDir, "pretool.1.jsonl");
		expect(existsSync(rotated1)).toBe(true);
		expect(statSync(rotated1).mode & 0o777).toBe(0o600);
		expect(statSync(telemetryFile).mode & 0o777).toBe(0o600);
		expect(statSync(telemetryDir).mode & 0o777).toBe(0o700);
	});

	it("E: rotation failure does not alter fail-closed deny output", async () => {
		const telemetryDir = join(tmpDir, "telemetry");
		mkdirSync(telemetryDir, { recursive: true, mode: 0o700 });
		const telemetryFile = join(telemetryDir, "pretool.jsonl");

		// Seed file
		writeFileSync(telemetryFile, JSON.stringify({ seed: true }) + "\n", { mode: 0o600 });

		// Make the rotated destination a directory so renameSync fails
		const rotated1Dir = join(telemetryDir, "pretool.1.jsonl");
		mkdirSync(rotated1Dir);

		const { stdout } = await runHook("pre-tool", "NOT_JSON", {
			PATCHWORK_PRETOOL_TELEMETRY_JSON: "1",
			PATCHWORK_PRETOOL_FAIL_CLOSED: "1",
			PATCHWORK_PRETOOL_TELEMETRY_DEST: "file",
			PATCHWORK_PRETOOL_TELEMETRY_FILE: telemetryFile,
			PATCHWORK_PRETOOL_TELEMETRY_MAX_BYTES: "1",
			PATCHWORK_PRETOOL_TELEMETRY_MAX_FILES: "3",
		});

		// Fail-closed deny should still work
		const parsed = JSON.parse(stdout);
		expect(parsed.hookSpecificOutput.permissionDecision).toBe("deny");
		expect(parsed.hookSpecificOutput.permissionDecisionReason).toContain("fail-closed");
	});
});

describe("hook PreToolUse telemetry concurrency hardening", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-telemetry-concurrency-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("A: concurrent writes produce valid JSONL (no corruption)", async () => {
		const telemetryDir = join(tmpDir, "telemetry");
		mkdirSync(telemetryDir, { recursive: true, mode: 0o700 });
		const telemetryFile = join(telemetryDir, "pretool.jsonl");

		// Run 5 hook invocations sequentially (same process; concurrency tested
		// by verifying the lock file is created and removed cleanly each time)
		const writes: Promise<{ stdout: string; stderr: string }>[] = [];
		for (let i = 0; i < 5; i++) {
			writes.push(
				runHook("pre-tool", "NOT_JSON", {
					PATCHWORK_PRETOOL_TELEMETRY_JSON: "1",
					PATCHWORK_PRETOOL_FAIL_CLOSED: "1",
					PATCHWORK_PRETOOL_TELEMETRY_DEST: "file",
					PATCHWORK_PRETOOL_TELEMETRY_FILE: telemetryFile,
					PATCHWORK_PRETOOL_TELEMETRY_MAX_BYTES: "100000",
					PATCHWORK_PRETOOL_TELEMETRY_MAX_FILES: "3",
				}),
			);
		}
		await Promise.all(writes);

		// All 5 lines should be valid JSON, no corruption
		expect(existsSync(telemetryFile)).toBe(true);
		const lines = readFileSync(telemetryFile, "utf-8").trim().split("\n");
		expect(lines.length).toBe(5);
		for (const line of lines) {
			const record = JSON.parse(line); // throws if corrupt
			expect(record.event).toBe("PreToolUse");
		}

		// Lock file should be cleaned up
		expect(existsSync(telemetryFile + ".lock")).toBe(false);
	});

	it("B: gap-robust cleanup removes orphaned high-index files", async () => {
		const telemetryDir = join(tmpDir, "telemetry");
		mkdirSync(telemetryDir, { recursive: true, mode: 0o700 });
		const telemetryFile = join(telemetryDir, "pretool.jsonl");

		// Create a gap scenario: .1 exists, .2 missing, .3 and .5 exist
		writeFileSync(join(telemetryDir, "pretool.1.jsonl"), "{\"idx\":1}\n", { mode: 0o600 });
		// .2 intentionally missing
		writeFileSync(join(telemetryDir, "pretool.3.jsonl"), "{\"idx\":3}\n", { mode: 0o600 });
		writeFileSync(join(telemetryDir, "pretool.5.jsonl"), "{\"idx\":5}\n", { mode: 0o600 });
		// Seed active file
		writeFileSync(telemetryFile, "{\"active\":true}\n", { mode: 0o600 });

		// Trigger rotation with max_files=2
		await runHook("pre-tool", "NOT_JSON", {
			PATCHWORK_PRETOOL_TELEMETRY_JSON: "1",
			PATCHWORK_PRETOOL_FAIL_CLOSED: "1",
			PATCHWORK_PRETOOL_TELEMETRY_DEST: "file",
			PATCHWORK_PRETOOL_TELEMETRY_FILE: telemetryFile,
			PATCHWORK_PRETOOL_TELEMETRY_MAX_BYTES: "1", // force rotation
			PATCHWORK_PRETOOL_TELEMETRY_MAX_FILES: "2",
		});

		// .3 and .5 should be gone (index >= maxFiles=2, cleaned up despite gaps)
		expect(existsSync(join(telemetryDir, "pretool.3.jsonl"))).toBe(false);
		expect(existsSync(join(telemetryDir, "pretool.5.jsonl"))).toBe(false);

		// .1 was shifted to .2, active was shifted to .1
		// Active file has the new telemetry line
		expect(existsSync(telemetryFile)).toBe(true);
		expect(existsSync(join(telemetryDir, "pretool.1.jsonl"))).toBe(true);
		expect(existsSync(join(telemetryDir, "pretool.2.jsonl"))).toBe(true);
	});

	it("C: lock contention failure preserves fail-closed deny and logs warning", async () => {
		const telemetryDir = join(tmpDir, "telemetry");
		mkdirSync(telemetryDir, { recursive: true, mode: 0o700 });
		const telemetryFile = join(telemetryDir, "pretool.jsonl");

		// Seed file to trigger rotation path
		writeFileSync(telemetryFile, "{\"seed\":true}\n", { mode: 0o600 });

		// Hold the lock file to simulate contention (fresh mtime so not stale)
		const lockPath = telemetryFile + ".lock";
		const fd = openSync(lockPath, "wx", 0o600);
		writeFileSync(fd, String(process.pid));
		closeSync(fd);

		const { stdout, stderr } = await runHook("pre-tool", "NOT_JSON", {
			PATCHWORK_PRETOOL_TELEMETRY_JSON: "1",
			PATCHWORK_PRETOOL_FAIL_CLOSED: "1",
			PATCHWORK_PRETOOL_TELEMETRY_DEST: "file",
			PATCHWORK_PRETOOL_TELEMETRY_FILE: telemetryFile,
			PATCHWORK_PRETOOL_TELEMETRY_MAX_BYTES: "1", // force rotation path
			PATCHWORK_PRETOOL_TELEMETRY_MAX_FILES: "3",
		});

		// Fail-closed deny must still be emitted
		const parsed = JSON.parse(stdout);
		expect(parsed.hookSpecificOutput.permissionDecision).toBe("deny");
		expect(parsed.hookSpecificOutput.permissionDecisionReason).toContain("fail-closed");

		// Stderr should contain the lock contention warning
		expect(stderr).toContain("telemetry lock contention");
	});
});

describe("hook PreToolUse telemetry append atomicity", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-telemetry-atomicity-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("A: concurrent non-rotation writes produce valid JSONL under default lock mode", async () => {
		const telemetryDir = join(tmpDir, "telemetry");
		mkdirSync(telemetryDir, { recursive: true, mode: 0o700 });
		const telemetryFile = join(telemetryDir, "pretool.jsonl");

		// Run 5 concurrent hook invocations without rotation (no max-bytes)
		// Default lock mode is "always", so all writes are lock-protected
		const writes: Promise<{ stdout: string; stderr: string }>[] = [];
		for (let i = 0; i < 5; i++) {
			writes.push(
				runHook("pre-tool", "NOT_JSON", {
					PATCHWORK_PRETOOL_TELEMETRY_JSON: "1",
					PATCHWORK_PRETOOL_FAIL_CLOSED: "1",
					PATCHWORK_PRETOOL_TELEMETRY_DEST: "file",
					PATCHWORK_PRETOOL_TELEMETRY_FILE: telemetryFile,
					// No MAX_BYTES — non-rotation path, but still locked
				}),
			);
		}
		await Promise.all(writes);

		// All 5 lines should be valid JSON
		expect(existsSync(telemetryFile)).toBe(true);
		const lines = readFileSync(telemetryFile, "utf-8").trim().split("\n");
		expect(lines.length).toBe(5);
		for (const line of lines) {
			const record = JSON.parse(line);
			expect(record.event).toBe("PreToolUse");
		}

		// Lock file should be cleaned up
		expect(existsSync(telemetryFile + ".lock")).toBe(false);
	});

	it("B: rotate-only mode skips lock for non-rotation writes", async () => {
		const telemetryDir = join(tmpDir, "telemetry");
		mkdirSync(telemetryDir, { recursive: true, mode: 0o700 });
		const telemetryFile = join(telemetryDir, "pretool.jsonl");

		// Hold the lock to prove non-rotation path doesn't need it in rotate-only mode
		const lockPath = telemetryFile + ".lock";
		const fd = openSync(lockPath, "wx", 0o600);
		writeFileSync(fd, String(process.pid));
		closeSync(fd);

		const { stderr } = await runHook("pre-tool", "NOT_JSON", {
			PATCHWORK_PRETOOL_TELEMETRY_JSON: "1",
			PATCHWORK_PRETOOL_FAIL_CLOSED: "1",
			PATCHWORK_PRETOOL_TELEMETRY_DEST: "file",
			PATCHWORK_PRETOOL_TELEMETRY_FILE: telemetryFile,
			PATCHWORK_PRETOOL_TELEMETRY_LOCK_MODE: "rotate-only",
			// No MAX_BYTES — non-rotation path
		});

		// File should have been written (lock bypassed for non-rotation)
		expect(existsSync(telemetryFile)).toBe(true);
		const content = readFileSync(telemetryFile, "utf-8").trim();
		const record = JSON.parse(content);
		expect(record.event).toBe("PreToolUse");

		// No contention warning (lock was not attempted)
		expect(stderr).not.toContain("telemetry lock contention");
	});

	it("C: lock contention on non-rotation path preserves fail-closed deny (always mode)", async () => {
		const telemetryDir = join(tmpDir, "telemetry");
		mkdirSync(telemetryDir, { recursive: true, mode: 0o700 });
		const telemetryFile = join(telemetryDir, "pretool.jsonl");

		// Hold the lock to simulate contention
		const lockPath = telemetryFile + ".lock";
		const fd = openSync(lockPath, "wx", 0o600);
		writeFileSync(fd, String(process.pid));
		closeSync(fd);

		const { stdout, stderr } = await runHook("pre-tool", "NOT_JSON", {
			PATCHWORK_PRETOOL_TELEMETRY_JSON: "1",
			PATCHWORK_PRETOOL_FAIL_CLOSED: "1",
			PATCHWORK_PRETOOL_TELEMETRY_DEST: "file",
			PATCHWORK_PRETOOL_TELEMETRY_FILE: telemetryFile,
			// Default lock mode (always) — non-rotation path will try lock
		});

		// Fail-closed deny must still be emitted
		const parsed = JSON.parse(stdout);
		expect(parsed.hookSpecificOutput.permissionDecision).toBe("deny");
		expect(parsed.hookSpecificOutput.permissionDecisionReason).toContain("fail-closed");

		// Stderr should show lock contention warning
		expect(stderr).toContain("telemetry lock contention");
	});
});
