import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
	mkdtempSync,
	rmSync,
	writeFileSync,
	readFileSync,
	existsSync,
	statSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	computeEventHash,
	computeSealPayload,
	signSeal,
	ensureSealKey,
} from "@patchwork/core";

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

	it("JSON output includes seal_age_seconds for valid seals", async () => {
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
		expect(parsed.seal.seal_failure_reason).toBeNull();
	});
});
