import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
	chmodSync,
	mkdtempSync,
	mkdirSync,
	rmSync,
	writeFileSync,
	readFileSync,
	existsSync,
	statSync,
	openSync,
	closeSync,
	unlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir, hostname } from "node:os";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
	computeEventHash,
	computeSealPayload,
	signSeal,
	verifySeal,
	ensureSealKey,
	readSealKey,
	ensureKeyring,
	loadKeyById,
	deriveSealKeyId,
	rotateKey,
} from "@patchwork/core";

const WORKER_PATH = join(
	dirname(fileURLToPath(import.meta.url)),
	"_seal-lock-worker.mjs",
);

function makeChainedEvents(count: number): Record<string, unknown>[] {
	const events: Record<string, unknown>[] = [];
	for (let i = 0; i < count; i++) {
		const e: Record<string, unknown> = {
			id: `evt_${i}`,
			session_id: "ses_test",
			timestamp: `2026-01-01T00:00:0${i}.000Z`,
			agent: "claude-code",
			action: "file_read",
			status: "completed",
			risk: { level: "low", flags: [] },
			prev_hash: i === 0 ? null : (events[i - 1].event_hash as string),
		};
		e.event_hash = computeEventHash(e);
		events.push(e);
	}
	return events;
}

function writeJsonl(filePath: string, records: Record<string, unknown>[]): void {
	writeFileSync(filePath, records.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf-8");
}

async function runSeal(args: string[]): Promise<{ exitCode: number | undefined; output: string[] }> {
	vi.resetModules();
	const { sealCommand } = await import("../../src/commands/seal.js");
	const output: string[] = [];
	const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
		output.push(args.map(String).join(" "));
	});
	const previousExitCode = process.exitCode;
	process.exitCode = undefined;
	try {
		sealCommand.parse(["node", "seal", ...args], { from: "node" });
		return { exitCode: process.exitCode, output };
	} finally {
		process.exitCode = previousExitCode;
		logSpy.mockRestore();
	}
}

async function runVerify(args: string[]): Promise<{ exitCode: number | undefined; output: string[] }> {
	vi.resetModules();
	const { verifyCommand } = await import("../../src/commands/verify.js");
	const output: string[] = [];
	const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
		output.push(args.map(String).join(" "));
	});
	const previousExitCode = process.exitCode;
	process.exitCode = undefined;
	try {
		verifyCommand.parse(["node", "verify", ...args], { from: "node" });
		return { exitCode: process.exitCode, output };
	} finally {
		process.exitCode = previousExitCode;
		logSpy.mockRestore();
	}
}

describe("seal command", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-seal-cmd-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("creates seal key with secure permissions", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		await runSeal(["--file", eventsPath, "--key-file", keyPath, "--seal-file", sealPath]);

		expect(existsSync(keyPath)).toBe(true);
		const keyStat = statSync(keyPath);
		expect(keyStat.mode & 0o777).toBe(0o600);
		const dirStat = statSync(join(tmpDir, "keys"));
		expect(dirStat.mode & 0o777).toBe(0o700);
	});

	it("generates a valid seal record", async () => {
		const events = makeChainedEvents(5);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		const { exitCode } = await runSeal(["--file", eventsPath, "--key-file", keyPath, "--seal-file", sealPath]);
		expect(exitCode).toBeUndefined();

		const sealContent = readFileSync(sealPath, "utf-8").trim();
		const seal = JSON.parse(sealContent);

		expect(seal.tip_hash).toBe(events[events.length - 1].event_hash);
		expect(seal.chained_events).toBe(5);
		expect(seal.signature).toMatch(/^hmac-sha256:[a-f0-9]{64}$/);
		expect(seal.sealed_at).toBeDefined();
	});

	it("exits non-zero when no events exist", async () => {
		const eventsPath = join(tmpDir, "nonexistent.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealPath = join(tmpDir, "seals.jsonl");

		const { exitCode } = await runSeal(["--file", eventsPath, "--key-file", keyPath, "--seal-file", sealPath]);
		expect(exitCode).toBe(1);
	});

	it("exits non-zero on invalid events without --allow-invalid", async () => {
		const eventsPath = join(tmpDir, "bad.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeFileSync(eventsPath, "NOT_VALID_JSON\n", "utf-8");

		const { exitCode } = await runSeal(["--file", eventsPath, "--key-file", keyPath, "--seal-file", sealPath]);
		expect(exitCode).toBe(1);
	});

	it("cleans up lock file after successful seal", async () => {
		const events = makeChainedEvents(2);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		await runSeal(["--file", eventsPath, "--key-file", keyPath, "--seal-file", sealPath]);

		// Lock file should be cleaned up
		expect(existsSync(sealPath + ".lock")).toBe(false);
		// Seal file should exist with content
		expect(existsSync(sealPath)).toBe(true);
	});
});

describe("seal append locking", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-seal-lock-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("reclaims stale lock from dead process", async () => {
		const events = makeChainedEvents(2);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		// Create a stale lock with a dead PID
		const lockPath = sealPath + ".lock";
		mkdirSync(join(tmpDir), { recursive: true });
		const staleMeta = JSON.stringify({
			pid: 999999999, // Almost certainly dead
			hostname: hostname(),
			created_at_ms: Date.now() - 10_000, // 10s old
		});
		writeFileSync(lockPath, staleMeta, { mode: 0o600 });

		// Seal should succeed by reclaiming the stale lock
		const { exitCode } = await runSeal([
			"--file", eventsPath,
			"--key-file", keyPath,
			"--seal-file", sealPath,
		]);
		expect(exitCode).toBeUndefined();

		// Lock should be cleaned up
		expect(existsSync(lockPath)).toBe(false);
		// Seal should be written
		expect(existsSync(sealPath)).toBe(true);
		const sealContent = readFileSync(sealPath, "utf-8").trim();
		expect(sealContent.length).toBeGreaterThan(0);
		JSON.parse(sealContent); // should not throw
	});

	it("two sequential seals both succeed without corruption", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		// First seal
		const { exitCode: exit1 } = await runSeal([
			"--file", eventsPath,
			"--key-file", keyPath,
			"--seal-file", sealPath,
		]);
		expect(exit1).toBeUndefined();

		// Second seal
		const { exitCode: exit2 } = await runSeal([
			"--file", eventsPath,
			"--key-file", keyPath,
			"--seal-file", sealPath,
		]);
		expect(exit2).toBeUndefined();

		// Both seals should be present and parseable
		const sealContent = readFileSync(sealPath, "utf-8");
		const sealLines = sealContent.split("\n").filter((l) => l.trim().length > 0);
		expect(sealLines.length).toBe(2);

		for (const line of sealLines) {
			const seal = JSON.parse(line);
			expect(seal.signature).toMatch(/^hmac-sha256:[a-f0-9]{64}$/);
		}

		// No lock file left behind
		expect(existsSync(sealPath + ".lock")).toBe(false);
	});

	it("fails cleanly when lock is held by active process and cannot be reclaimed", async () => {
		const events = makeChainedEvents(2);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		// Create a lock held by our own (alive) process with a fresh timestamp
		const lockPath = sealPath + ".lock";
		const freshMeta = JSON.stringify({
			pid: process.pid,
			hostname: hostname(),
			created_at_ms: Date.now(),
		});
		// Use O_EXCL to create atomically
		const fd = openSync(lockPath, "wx");
		writeFileSync(fd, freshMeta);
		closeSync(fd);

		// Seal should fail because lock is held by alive process with fresh timestamp
		try {
			const { exitCode, output } = await runSeal([
				"--file", eventsPath,
				"--key-file", keyPath,
				"--seal-file", sealPath,
			]);
			// If it doesn't throw, it should at least have failed somehow
			// But the seal command wraps errors in process.exitCode, not throws
			// Actually the withSealLock throws, and that's not caught by the command
			expect.fail("Should have thrown a lock contention error");
		} catch (err: unknown) {
			expect((err as Error).message).toContain("Seal lock contention");
		} finally {
			// Clean up the lock we created
			try { unlinkSync(lockPath); } catch { /* ignore */ }
		}
	});
});

describe("verify with seal", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-verify-seal-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("passes when seal is valid and tip matches", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		await runSeal(["--file", eventsPath, "--key-file", keyPath, "--seal-file", sealPath]);

		const { exitCode } = await runVerify([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--key-file", keyPath,
		]);
		expect(exitCode).toBeUndefined();
	});

	it("fails when seal signature is tampered", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		await runSeal(["--file", eventsPath, "--key-file", keyPath, "--seal-file", sealPath]);
		const sealContent = readFileSync(sealPath, "utf-8").trim();
		const seal = JSON.parse(sealContent);
		seal.signature = "hmac-sha256:" + "ff".repeat(32);
		writeFileSync(sealPath, JSON.stringify(seal) + "\n", "utf-8");

		const { exitCode } = await runVerify([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--key-file", keyPath,
		]);
		expect(exitCode).toBe(1);
	});

	it("fails when events tip no longer matches sealed tip", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		await runSeal(["--file", eventsPath, "--key-file", keyPath, "--seal-file", sealPath]);

		const e4: Record<string, unknown> = {
			id: "evt_3",
			session_id: "ses_test",
			timestamp: "2026-01-01T00:00:03.000Z",
			agent: "claude-code",
			action: "file_write",
			status: "completed",
			risk: { level: "medium", flags: [] },
			prev_hash: events[2].event_hash,
		};
		e4.event_hash = computeEventHash(e4);
		writeJsonl(eventsPath, [...events, e4]);

		const { exitCode } = await runVerify([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--key-file", keyPath,
		]);
		expect(exitCode).toBe(1);
	});

	it("warns but does not fail when no seal file exists (default)", async () => {
		const events = makeChainedEvents(2);
		const eventsPath = join(tmpDir, "events.jsonl");
		const sealPath = join(tmpDir, "nonexistent-seals.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		writeJsonl(eventsPath, events);

		const { exitCode, output } = await runVerify([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--key-file", keyPath,
		]);
		expect(exitCode).toBeUndefined();
		const joined = output.join("\n");
		expect(joined).toContain("Seal");
	});

	it("skips seal check when --no-seal-check is set", async () => {
		const events = makeChainedEvents(2);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events);

		const { exitCode } = await runVerify([
			"--file", eventsPath,
			"--no-seal-check",
		]);
		expect(exitCode).toBeUndefined();
	});
});

describe("verify --require-seal", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-require-seal-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("missing seal passes by default but fails with --require-seal", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		const sealPath = join(tmpDir, "nonexistent-seals.jsonl");
		writeJsonl(eventsPath, events);

		// Default: passes (missing seal is just a warning)
		const { exitCode: defaultExit } = await runVerify([
			"--file", eventsPath,
			"--seal-file", sealPath,
		]);
		expect(defaultExit).toBeUndefined();

		// --require-seal: fails
		const { exitCode: requireExit } = await runVerify([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--require-seal",
		]);
		expect(requireExit).toBe(1);
	});

	it("fresh valid seal passes with --require-seal + --max-seal-age-seconds", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		// Create a fresh seal
		await runSeal(["--file", eventsPath, "--key-file", keyPath, "--seal-file", sealPath]);

		// Verify with both --require-seal and generous max age
		const { exitCode } = await runVerify([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--key-file", keyPath,
			"--require-seal",
			"--max-seal-age-seconds", "3600",
		]);
		expect(exitCode).toBeUndefined();
	});

	it("--no-seal-check bypasses --require-seal and --max-seal-age-seconds", async () => {
		const events = makeChainedEvents(2);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events);

		// All seal-related flags set, but --no-seal-check should skip everything
		const { exitCode } = await runVerify([
			"--file", eventsPath,
			"--no-seal-check",
			"--require-seal",
			"--max-seal-age-seconds", "1",
		]);
		expect(exitCode).toBeUndefined();
	});
});

describe("verify --max-seal-age-seconds", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-seal-age-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("stale seal fails with --max-seal-age-seconds", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		// Create a seal with a past sealed_at timestamp (2 hours ago)
		const key = ensureSealKey(keyPath);
		const tipHash = events[events.length - 1].event_hash as string;
		const staleTime = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
		const payload = computeSealPayload(tipHash, 3, staleTime);
		const signature = signSeal(payload, key);
		const seal = {
			sealed_at: staleTime,
			tip_hash: tipHash,
			chained_events: 3,
			signature,
		};
		writeFileSync(sealPath, JSON.stringify(seal) + "\n", "utf-8");

		// Verify with a 1-hour max age — should fail (seal is 2h old)
		const { exitCode } = await runVerify([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--key-file", keyPath,
			"--max-seal-age-seconds", "3600",
		]);
		expect(exitCode).toBe(1);
	});

	it("missing seal fails with --max-seal-age-seconds alone (cannot satisfy freshness)", async () => {
		const events = makeChainedEvents(2);
		const eventsPath = join(tmpDir, "events.jsonl");
		const sealPath = join(tmpDir, "nonexistent-seals.jsonl");
		writeJsonl(eventsPath, events);

		const { exitCode } = await runVerify([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--max-seal-age-seconds", "3600",
		]);
		expect(exitCode).toBe(1);
	});

	it("JSON output includes seal_age_seconds and seal_corrupt_lines for valid seals", async () => {
		const events = makeChainedEvents(2);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		await runSeal(["--file", eventsPath, "--key-file", keyPath, "--seal-file", sealPath]);

		const { output } = await runVerify([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--key-file", keyPath,
			"--json",
		]);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.seal.seal_checked).toBe(true);
		expect(parsed.seal.seal_present).toBe(true);
		expect(parsed.seal.seal_valid).toBe(true);
		expect(parsed.seal.seal_tip_match).toBe(true);
		expect(typeof parsed.seal.seal_age_seconds).toBe("number");
		expect(parsed.seal.seal_age_seconds).toBeGreaterThanOrEqual(0);
		expect(parsed.seal.seal_corrupt_lines).toBe(0);
		expect(parsed.seal.seal_failure_reason).toBeNull();
	});
});

describe("seal file permission hardening", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-seal-perms-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("creates seal file with 0600 and parent dir with 0700", async () => {
		const events = makeChainedEvents(2);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		// Seal file in a new subdirectory that doesn't exist yet
		const sealDir = join(tmpDir, "seals");
		const sealPath = join(sealDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		const { exitCode } = await runSeal([
			"--file", eventsPath,
			"--key-file", keyPath,
			"--seal-file", sealPath,
		]);
		expect(exitCode).toBeUndefined();
		expect(existsSync(sealPath)).toBe(true);

		const fileStat = statSync(sealPath);
		expect(fileStat.mode & 0o777).toBe(0o600);

		const dirStat = statSync(sealDir);
		expect(dirStat.mode & 0o777).toBe(0o700);
	});

	it("reconciles insecure existing seal file permissions", async () => {
		const events = makeChainedEvents(2);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		// Pre-create seal file with insecure permissions
		writeFileSync(sealPath, "", { mode: 0o644 });
		expect(statSync(sealPath).mode & 0o777).toBe(0o644);

		await runSeal([
			"--file", eventsPath,
			"--key-file", keyPath,
			"--seal-file", sealPath,
		]);

		const fileStat = statSync(sealPath);
		expect(fileStat.mode & 0o777).toBe(0o600);
	});

	it("reconciles insecure existing parent directory permissions", async () => {
		const events = makeChainedEvents(2);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealDir = join(tmpDir, "seals");
		const sealPath = join(sealDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		// Pre-create directory with insecure permissions
		mkdirSync(sealDir, { mode: 0o755 });

		await runSeal([
			"--file", eventsPath,
			"--key-file", keyPath,
			"--seal-file", sealPath,
		]);

		const dirStat = statSync(sealDir);
		expect(dirStat.mode & 0o777).toBe(0o700);
	});

	it("verify reconciles insecure seal file permissions on read", async () => {
		const events = makeChainedEvents(2);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		// Create a valid seal
		await runSeal([
			"--file", eventsPath,
			"--key-file", keyPath,
			"--seal-file", sealPath,
		]);

		// Loosen permissions manually
		chmodSync(sealPath, 0o644);
		expect(statSync(sealPath).mode & 0o777).toBe(0o644);

		// Verify should reconcile permissions
		await runVerify([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--key-file", keyPath,
		]);

		const fileStat = statSync(sealPath);
		expect(fileStat.mode & 0o777).toBe(0o600);
	});
});

describe("verify with corrupt seal file", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-seal-corrupt-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("tolerates corrupt trailing seal line when valid prior seal exists", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		// Create a valid seal
		await runSeal(["--file", eventsPath, "--key-file", keyPath, "--seal-file", sealPath]);

		// Append corrupt trailing line (simulates truncated/partial write)
		const existing = readFileSync(sealPath, "utf-8");
		writeFileSync(sealPath, existing + '{"truncated": true\n', "utf-8");

		// Should pass — scan backward finds the valid seal
		const { exitCode } = await runVerify([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--key-file", keyPath,
		]);
		expect(exitCode).toBeUndefined();
	});

	it("fails with --strict-seal-file when corrupt lines exist", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		// Create a valid seal
		await runSeal(["--file", eventsPath, "--key-file", keyPath, "--seal-file", sealPath]);

		// Append corrupt trailing line
		const existing = readFileSync(sealPath, "utf-8");
		writeFileSync(sealPath, existing + "CORRUPT_LINE\n", "utf-8");

		// Should fail with --strict-seal-file
		const { exitCode, output } = await runVerify([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--key-file", keyPath,
			"--strict-seal-file",
		]);
		expect(exitCode).toBe(1);
		const joined = output.join("\n");
		expect(joined).toContain("corrupt seal line");
	});

	it("JSON output includes seal_corrupt_lines count", async () => {
		const events = makeChainedEvents(2);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		// Create a valid seal
		await runSeal(["--file", eventsPath, "--key-file", keyPath, "--seal-file", sealPath]);

		// Append two corrupt trailing lines
		const existing = readFileSync(sealPath, "utf-8");
		writeFileSync(sealPath, existing + "BAD_LINE_1\nBAD_LINE_2\n", "utf-8");

		// Default (no --strict-seal-file) — should pass
		const { exitCode, output } = await runVerify([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--key-file", keyPath,
			"--json",
		]);
		expect(exitCode).toBeUndefined();
		const parsed = JSON.parse(output.join(""));
		expect(parsed.seal.seal_checked).toBe(true);
		expect(parsed.seal.seal_valid).toBe(true);
		expect(parsed.seal.seal_corrupt_lines).toBe(2);
		expect(parsed.seal.seal_failure_reason).toBeNull();
	});

	it("handles seal file with only corrupt lines", async () => {
		const events = makeChainedEvents(2);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);
		ensureSealKey(keyPath);

		// Write only corrupt lines
		writeFileSync(sealPath, "NOT_JSON\nALSO_BAD\n", "utf-8");

		const { exitCode, output } = await runVerify([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--key-file", keyPath,
			"--json",
		]);
		expect(exitCode).toBe(1);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.seal.seal_corrupt_lines).toBe(2);
		expect(parsed.seal.seal_failure_reason).toContain("No valid seal record");
	});

	it("tolerates corrupt line between two valid seals and uses latest valid", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		// Create first valid seal
		await runSeal(["--file", eventsPath, "--key-file", keyPath, "--seal-file", sealPath]);

		// Insert a corrupt line then another valid seal
		const existing = readFileSync(sealPath, "utf-8");
		writeFileSync(sealPath, existing + "CORRUPT_MIDDLE\n", "utf-8");

		// Create second valid seal (appends another line)
		await runSeal(["--file", eventsPath, "--key-file", keyPath, "--seal-file", sealPath]);

		// The corrupt line is not at the tail, so seal_corrupt_lines should be 0
		// (backward scan finds valid latest seal immediately)
		const { exitCode, output } = await runVerify([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--key-file", keyPath,
			"--json",
		]);
		expect(exitCode).toBeUndefined();
		const parsed = JSON.parse(output.join(""));
		expect(parsed.seal.seal_valid).toBe(true);
		expect(parsed.seal.seal_corrupt_lines).toBe(0);
	});
});

describe("multi-process seal contention", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-seal-multiproc-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	function spawnWorker(
		args: Record<string, string>,
	): Promise<{ exitCode: number; stdout: string; stderr: string }> {
		return new Promise((resolve) => {
			const childArgs = [WORKER_PATH];
			for (const [key, value] of Object.entries(args)) {
				childArgs.push(`--${key}`, value);
			}
			const child = spawn(process.execPath, childArgs);
			let stdout = "";
			let stderr = "";
			child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
			child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
			child.on("close", (code) => {
				resolve({ exitCode: code ?? 1, stdout, stderr });
			});
		});
	}

	const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

	it("two seal writers race without corruption", { timeout: 15000 }, async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);
		ensureSealKey(keyPath);
		writeFileSync(sealPath, "", { mode: 0o600 });

		// Spawn two workers simultaneously
		const [a, b] = await Promise.all([
			spawnWorker({
				"seal-path": sealPath,
				"events-path": eventsPath,
				"key-path": keyPath,
			}),
			spawnWorker({
				"seal-path": sealPath,
				"events-path": eventsPath,
				"key-path": keyPath,
			}),
		]);

		// Both should succeed
		expect(a.exitCode, `Worker A stderr: ${a.stderr}`).toBe(0);
		expect(b.exitCode, `Worker B stderr: ${b.stderr}`).toBe(0);

		// Seal file should have exactly 2 valid lines
		const sealContent = readFileSync(sealPath, "utf-8");
		const sealLines = sealContent.split("\n").filter((l) => l.trim().length > 0);
		expect(sealLines.length).toBe(2);

		// Cryptographically verify each seal record against the shared key
		const key = readSealKey(keyPath);
		for (const line of sealLines) {
			const seal = JSON.parse(line);
			expect(seal.tip_hash).toBe(events[events.length - 1].event_hash);
			expect(typeof seal.chained_events).toBe("number");
			expect(typeof seal.sealed_at).toBe("string");

			const payload = computeSealPayload(seal.tip_hash, seal.chained_events, seal.sealed_at);
			expect(verifySeal(payload, seal.signature, key)).toBe(true);
		}

		// No lock file leaked
		expect(existsSync(sealPath + ".lock")).toBe(false);

		// Verify accepts the seals (end-to-end)
		const { exitCode: verifyExit } = await runVerify([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--key-file", keyPath,
		]);
		expect(verifyExit).toBeUndefined();
	});

	it("second writer fails cleanly when first holds lock", { timeout: 15000 }, async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);
		ensureSealKey(keyPath);
		writeFileSync(sealPath, "", { mode: 0o600 });

		// Worker A: holds lock for 2s inside critical section
		const workerA = spawnWorker({
			"seal-path": sealPath,
			"events-path": eventsPath,
			"key-path": keyPath,
			"hold-ms": "2000",
		});

		// Poll until Worker A has acquired the lock (deterministic sync point)
		const lockPath = sealPath + ".lock";
		const deadline = Date.now() + 5000;
		while (!existsSync(lockPath)) {
			if (Date.now() > deadline) throw new Error("Worker A did not acquire lock in time");
			await sleep(50);
		}

		// Worker B: short retry budget (~300ms), will time out
		const workerB = await spawnWorker({
			"seal-path": sealPath,
			"events-path": eventsPath,
			"key-path": keyPath,
			"max-retries": "5",
		});

		// Worker B should have failed with contention error
		expect(workerB.exitCode).toBe(1);
		expect(workerB.stderr).toContain("contention");

		// Wait for Worker A to complete
		const resultA = await workerA;
		expect(resultA.exitCode).toBe(0);

		// Only Worker A's seal should be in the file
		const sealContent = readFileSync(sealPath, "utf-8");
		const sealLines = sealContent.split("\n").filter((l) => l.trim().length > 0);
		expect(sealLines.length).toBe(1);

		const seal = JSON.parse(sealLines[0]);
		expect(seal.signature).toMatch(/^hmac-sha256:[a-f0-9]{64}$/);

		// No lock file leaked
		expect(existsSync(sealPath + ".lock")).toBe(false);
	});
});

describe("seal with keyring", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-seal-keyring-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("seal without --key-file uses keyring and includes key_id", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyringDir = join(tmpDir, "keyring");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		const { exitCode } = await runSeal([
			"--file", eventsPath,
			"--keyring-dir", keyringDir,
			"--seal-file", sealPath,
		]);
		expect(exitCode).toBeUndefined();

		const sealContent = readFileSync(sealPath, "utf-8").trim();
		const seal = JSON.parse(sealContent);
		expect(seal.key_id).toMatch(/^[a-f0-9]{16}$/);
		expect(seal.signature).toMatch(/^hmac-sha256:[a-f0-9]{64}$/);

		// Keyring should have the key file
		expect(existsSync(join(keyringDir, `${seal.key_id}.key`))).toBe(true);
		expect(existsSync(join(keyringDir, "ACTIVE"))).toBe(true);
	});

	it("seal with --key-file uses legacy mode without key_id", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		const { exitCode } = await runSeal([
			"--file", eventsPath,
			"--key-file", keyPath,
			"--seal-file", sealPath,
		]);
		expect(exitCode).toBeUndefined();

		const sealContent = readFileSync(sealPath, "utf-8").trim();
		const seal = JSON.parse(sealContent);
		expect(seal.key_id).toBeUndefined();
		expect(seal.signature).toMatch(/^hmac-sha256:[a-f0-9]{64}$/);
	});

	it("verify resolves key_id from keyring", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyringDir = join(tmpDir, "keyring");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		// Seal with keyring
		await runSeal([
			"--file", eventsPath,
			"--keyring-dir", keyringDir,
			"--seal-file", sealPath,
		]);

		// Verify using keyring
		const { exitCode } = await runVerify([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--keyring-dir", keyringDir,
		]);
		expect(exitCode).toBeUndefined();
	});

	it("verify with rotated key still verifies old seals via keyring", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyringDir = join(tmpDir, "keyring");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		// Seal with original key
		await runSeal([
			"--file", eventsPath,
			"--keyring-dir", keyringDir,
			"--seal-file", sealPath,
		]);

		// Rotate key
		rotateKey(keyringDir);

		// Verify — should still work because old key is in keyring
		const { exitCode } = await runVerify([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--keyring-dir", keyringDir,
		]);
		expect(exitCode).toBeUndefined();
	});

	it("seal after rotation uses the new key", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyringDir = join(tmpDir, "keyring");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		// First seal
		await runSeal([
			"--file", eventsPath,
			"--keyring-dir", keyringDir,
			"--seal-file", sealPath,
		]);

		const firstSeal = JSON.parse(readFileSync(sealPath, "utf-8").trim().split("\n")[0]);
		const originalKeyId = firstSeal.key_id;

		// Rotate
		const { keyId: newKeyId } = rotateKey(keyringDir);
		expect(newKeyId).not.toBe(originalKeyId);

		// Second seal — should use new key
		await runSeal([
			"--file", eventsPath,
			"--keyring-dir", keyringDir,
			"--seal-file", sealPath,
		]);

		const sealLines = readFileSync(sealPath, "utf-8").trim().split("\n");
		const secondSeal = JSON.parse(sealLines[sealLines.length - 1]);
		expect(secondSeal.key_id).toBe(newKeyId);

		// Both seals should verify
		const { exitCode } = await runVerify([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--keyring-dir", keyringDir,
		]);
		expect(exitCode).toBeUndefined();
	});

	it("verify legacy seal (no key_id) falls back to --key-file", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		const keyPath = join(tmpDir, "keys", "seal.key");
		const sealPath = join(tmpDir, "seals.jsonl");
		writeJsonl(eventsPath, events);

		// Seal in legacy mode
		await runSeal([
			"--file", eventsPath,
			"--key-file", keyPath,
			"--seal-file", sealPath,
		]);

		// Verify with key-file (legacy)
		const { exitCode } = await runVerify([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--key-file", keyPath,
		]);
		expect(exitCode).toBeUndefined();
	});
});

describe("seal rotate-key subcommand", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-seal-rotate-cmd-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	async function runSealRotate(args: string[]): Promise<{ exitCode: number | undefined; output: string[] }> {
		vi.resetModules();
		const { sealCommand } = await import("../../src/commands/seal.js");
		const output: string[] = [];
		const logSpy = vi.spyOn(console, "log").mockImplementation((...a) => {
			output.push(a.map(String).join(" "));
		});
		const previousExitCode = process.exitCode;
		process.exitCode = undefined;
		try {
			sealCommand.parse(["node", "seal", "rotate-key", ...args], { from: "node" });
			return { exitCode: process.exitCode, output };
		} finally {
			process.exitCode = previousExitCode;
			logSpy.mockRestore();
		}
	}

	it("creates a new key in the keyring", async () => {
		const keyringDir = join(tmpDir, "keyring");

		const { exitCode, output } = await runSealRotate(["--keyring-dir", keyringDir]);
		expect(exitCode).toBeUndefined();

		const joined = output.join("\n");
		expect(joined).toContain("Key rotated");

		// Keyring should exist with ACTIVE pointer
		expect(existsSync(join(keyringDir, "ACTIVE"))).toBe(true);
	});

	it("rotates to a different key", async () => {
		const keyringDir = join(tmpDir, "keyring");
		const original = ensureKeyring(keyringDir);

		await runSealRotate(["--keyring-dir", keyringDir]);

		const active = readFileSync(join(keyringDir, "ACTIVE"), "utf-8").trim();
		expect(active).not.toBe(original.keyId);
		// Old key still present
		expect(existsSync(join(keyringDir, `${original.keyId}.key`))).toBe(true);
	});

	it("JSON output includes key_id", async () => {
		const keyringDir = join(tmpDir, "keyring");

		const { output } = await runSealRotate(["--keyring-dir", keyringDir, "--json"]);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.key_id).toMatch(/^[a-f0-9]{16}$/);
		expect(parsed.keyring_dir).toBe(keyringDir);
	});
});
