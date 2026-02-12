import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Readable, Writable } from "node:stream";
import { mkdtempSync, rmSync, readFileSync, existsSync, statSync, mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

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
		expect(parsed.allow).toBe(false);
		expect(parsed.reason).toContain("fail-closed");
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
		expect(parsed.allow).toBe(false);
		expect(parsed.reason).toContain("fail-closed");
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

	it("C: file/dir permissions are enforced (0o600/0o700)", async () => {
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
		const blockingFile = join(tmpDir, "blocker");
		mkdirSync(tmpDir, { recursive: true });
		// Create a regular file where the dir should be, making mkdir fail
		const { writeFileSync } = await import("node:fs");
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
		expect(parsed.allow).toBe(false);
		expect(parsed.reason).toContain("fail-closed");

		// stderr should contain the warning about failed write
		expect(stderr).toContain("telemetry file write failed");
	});
});
