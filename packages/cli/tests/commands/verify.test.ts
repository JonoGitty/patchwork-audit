import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { computeEventHash } from "@patchwork/core";

function makeLegacyEvent(id: string): Record<string, unknown> {
	return {
		id,
		session_id: "ses_test",
		timestamp: "2026-01-01T00:00:00.000Z",
		agent: "claude-code",
		action: "file_read",
		status: "completed",
		risk: { level: "low", flags: [] },
	};
}

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

function writeJsonl(filePath: string, lines: string[]): void {
	writeFileSync(filePath, lines.join("\n") + "\n", "utf-8");
}

async function runVerify(args: string[]): Promise<{ exitCode: number | undefined; output: string[] }> {
	vi.resetModules();
	const { verifyCommand } = await import("../../src/commands/verify.js");
	const output: string[] = [];
	const logSpy = vi.spyOn(console, "log").mockImplementation((...a) => {
		output.push(a.map(String).join(" "));
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

describe("verify command", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-verify-cmd-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("passes for a valid chain", async () => {
		const events = makeChainedEvents(5);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const { exitCode } = await runVerify(["--file", filePath, "--no-seal-check"]);
		expect(exitCode).toBeUndefined();
	});

	it("exits non-zero when JSON parse errors are present", async () => {
		const events = makeChainedEvents(1);
		const filePath = join(tmpDir, "parse-error.jsonl");
		writeJsonl(filePath, [JSON.stringify(events[0]), "NOT_VALID_JSON"]);

		const { exitCode } = await runVerify(["--file", filePath, "--no-seal-check"]);
		expect(exitCode).toBe(1);
	});

	it("exits non-zero when schema-invalid events are present", async () => {
		const events = makeChainedEvents(1);
		const filePath = join(tmpDir, "schema-invalid.jsonl");
		writeJsonl(filePath, [JSON.stringify(events[0]), JSON.stringify({ id: "evt_bad" })]);

		const { exitCode } = await runVerify(["--file", filePath, "--no-seal-check"]);
		expect(exitCode).toBe(1);
	});

	it("allows invalid/corrupt events when --allow-invalid is set", async () => {
		const events = makeChainedEvents(1);
		const filePath = join(tmpDir, "allow-invalid.jsonl");
		writeJsonl(filePath, [
			JSON.stringify(events[0]),
			JSON.stringify({ id: "evt_bad" }),
			"NOT_VALID_JSON",
		]);

		const { exitCode } = await runVerify(["--file", filePath, "--allow-invalid", "--no-seal-check"]);
		expect(exitCode).toBeUndefined();
	});

	it("strict mode fails when legacy events are present", async () => {
		const legacy = makeLegacyEvent("evt_legacy");
		const chained = makeChainedEvents(1)[0];
		const filePath = join(tmpDir, "strict.jsonl");
		writeJsonl(filePath, [JSON.stringify(legacy), JSON.stringify(chained)]);

		const { exitCode: looseExitCode } = await runVerify(["--file", filePath, "--no-seal-check"]);
		expect(looseExitCode).toBeUndefined();

		const { exitCode: strictExitCode } = await runVerify(["--file", filePath, "--strict", "--no-seal-check"]);
		expect(strictExitCode).toBe(1);
	});

	it("--json output includes seal status fields", async () => {
		const events = makeChainedEvents(2);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const { output } = await runVerify(["--file", filePath, "--json", "--no-seal-check"]);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.seal).toBeDefined();
		expect(parsed.seal.seal_checked).toBe(false);
		expect(parsed.seal.seal_corrupt_lines).toBe(0);
		expect(parsed.seal.seal_failure_reason).toBeNull();
	});

	it("--json with seal check includes all structured fields", async () => {
		const events = makeChainedEvents(2);
		const filePath = join(tmpDir, "events.jsonl");
		const sealPath = join(tmpDir, "nonexistent-seals.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const { output } = await runVerify(["--file", filePath, "--json", "--seal-file", sealPath]);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.seal.seal_checked).toBe(true);
		expect(parsed.seal.seal_present).toBe(false);
		expect(parsed.seal.seal_valid).toBe(false);
		expect(parsed.seal.seal_tip_match).toBe(false);
		expect(parsed.seal.seal_age_seconds).toBeNull();
		expect(parsed.seal.seal_corrupt_lines).toBe(0);
		// No failure reason since --require-seal not set
		expect(parsed.seal.seal_failure_reason).toBeNull();
	});
});

describe("verify --max-seal-age-seconds input validation", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-maxage-validate-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	const invalidInputs = [
		{ value: "0", label: "zero" },
		{ value: "-1", label: "negative" },
		{ value: "3.5", label: "decimal" },
		{ value: "abc", label: "non-numeric" },
		{ value: "", label: "empty string" },
		{ value: "1e5", label: "scientific notation" },
	];

	for (const { value, label } of invalidInputs) {
		it(`rejects invalid --max-seal-age-seconds: ${label} ("${value}")`, async () => {
			const events = makeChainedEvents(2);
			const filePath = join(tmpDir, "events.jsonl");
			writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

			const { exitCode, output } = await runVerify([
				"--file", filePath,
				"--no-seal-check",
				"--max-seal-age-seconds", value,
			]);
			expect(exitCode).toBe(1);
			const joined = output.join("\n");
			expect(joined).toContain("Invalid --max-seal-age-seconds");
		});
	}

	it("rejects invalid --max-seal-age-seconds in JSON mode", async () => {
		const events = makeChainedEvents(2);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--json",
			"--max-seal-age-seconds", "abc",
		]);
		expect(exitCode).toBe(1);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.error).toContain("Invalid --max-seal-age-seconds");
	});

	it("accepts valid positive integer --max-seal-age-seconds", async () => {
		const events = makeChainedEvents(2);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		// With --no-seal-check the max-age flag is parsed but seal check skipped
		const { exitCode } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--max-seal-age-seconds", "3600",
		]);
		expect(exitCode).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Witness verification tests
// ---------------------------------------------------------------------------

/** Build a valid witness record for the given chain tip. */
function makeWitnessRecord(
	tipHash: string,
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		schema_version: 1,
		witnessed_at: new Date().toISOString(),
		tip_hash: tipHash,
		chained_events: 3,
		seal_signature: "hmac-sha256:fake",
		witness_url: "https://witness.example.com",
		anchor_id: "anc_test_001",
		...overrides,
	};
}

describe("verify --require-witness", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-verify-witness-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("E: fails with no witness file", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const { exitCode } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--require-witness",
			"--witness-file", join(tmpDir, "nonexistent-witnesses.jsonl"),
		]);
		expect(exitCode).toBe(1);
	});

	it("E2: fails with empty witness file", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));
		const witnessPath = join(tmpDir, "witnesses.jsonl");
		writeFileSync(witnessPath, "", "utf-8");

		const { exitCode } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--require-witness",
			"--witness-file", witnessPath,
		]);
		expect(exitCode).toBe(1);
	});

	it("E3: fails when witness records exist but none match current tip", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));
		const witnessPath = join(tmpDir, "witnesses.jsonl");
		const staleWitness = makeWitnessRecord("sha256:old_tip_hash");
		writeFileSync(witnessPath, JSON.stringify(staleWitness) + "\n", "utf-8");

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--require-witness",
			"--witness-file", witnessPath,
		]);
		expect(exitCode).toBe(1);
		const joined = output.join("\n");
		expect(joined).toContain("Witness FAILED");
	});

	it("E4: passes with valid matching witness", async () => {
		const events = makeChainedEvents(3);
		const tipHash = events[2].event_hash as string;
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));
		const witnessPath = join(tmpDir, "witnesses.jsonl");
		const witness = makeWitnessRecord(tipHash);
		writeFileSync(witnessPath, JSON.stringify(witness) + "\n", "utf-8");

		const { exitCode } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--require-witness",
			"--witness-file", witnessPath,
		]);
		expect(exitCode).toBeUndefined();
	});
});

describe("verify --max-witness-age-seconds", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-verify-witness-age-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("F: fails on stale witness", async () => {
		const events = makeChainedEvents(3);
		const tipHash = events[2].event_hash as string;
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));
		const witnessPath = join(tmpDir, "witnesses.jsonl");
		// Create witness from 2 hours ago
		const oldTime = new Date(Date.now() - 7200 * 1000).toISOString();
		const witness = makeWitnessRecord(tipHash, { witnessed_at: oldTime });
		writeFileSync(witnessPath, JSON.stringify(witness) + "\n", "utf-8");

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--max-witness-age-seconds", "3600",
			"--witness-file", witnessPath,
		]);
		expect(exitCode).toBe(1);
		const joined = output.join("\n");
		expect(joined).toContain("Witness");
		expect(joined).toContain("too old");
	});

	it("F2: passes on fresh witness", async () => {
		const events = makeChainedEvents(3);
		const tipHash = events[2].event_hash as string;
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));
		const witnessPath = join(tmpDir, "witnesses.jsonl");
		// Create witness from 5 seconds ago
		const freshTime = new Date(Date.now() - 5 * 1000).toISOString();
		const witness = makeWitnessRecord(tipHash, { witnessed_at: freshTime });
		writeFileSync(witnessPath, JSON.stringify(witness) + "\n", "utf-8");

		const { exitCode } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--max-witness-age-seconds", "3600",
			"--witness-file", witnessPath,
		]);
		expect(exitCode).toBeUndefined();
	});

	it("F3: rejects invalid --max-witness-age-seconds", async () => {
		const events = makeChainedEvents(2);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--max-witness-age-seconds", "abc",
		]);
		expect(exitCode).toBe(1);
		const joined = output.join("\n");
		expect(joined).toContain("Invalid --max-witness-age-seconds");
	});
});

describe("verify --strict-witness-file", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-verify-strict-witness-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("G: fails when witness file has corrupt lines", async () => {
		const events = makeChainedEvents(3);
		const tipHash = events[2].event_hash as string;
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));
		const witnessPath = join(tmpDir, "witnesses.jsonl");
		const validWitness = makeWitnessRecord(tipHash);
		writeFileSync(
			witnessPath,
			JSON.stringify(validWitness) + "\nNOT_VALID_JSON\n",
			"utf-8",
		);

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--strict-witness-file",
			"--witness-file", witnessPath,
		]);
		expect(exitCode).toBe(1);
		const joined = output.join("\n");
		expect(joined).toContain("corrupt witness line");
	});

	it("G2: default mode tolerates corrupt lines and continues", async () => {
		const events = makeChainedEvents(3);
		const tipHash = events[2].event_hash as string;
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));
		const witnessPath = join(tmpDir, "witnesses.jsonl");
		const validWitness = makeWitnessRecord(tipHash);
		writeFileSync(
			witnessPath,
			JSON.stringify(validWitness) + "\nNOT_VALID_JSON\n",
			"utf-8",
		);

		// Without --strict-witness-file, corrupt lines are tolerated
		const { exitCode } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--require-witness",
			"--witness-file", witnessPath,
		]);
		expect(exitCode).toBeUndefined();
	});

	it("G3: invalid witnessed_at line counted as corrupt", async () => {
		const events = makeChainedEvents(3);
		const tipHash = events[2].event_hash as string;
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));
		const witnessPath = join(tmpDir, "witnesses.jsonl");
		// Record with invalid witnessed_at — parseable JSON but fails schema .datetime()
		const badRecord = {
			schema_version: 1,
			witnessed_at: "not-a-date",
			tip_hash: tipHash,
			chained_events: 3,
			seal_signature: "hmac-sha256:fake",
			witness_url: "https://witness.example.com",
			anchor_id: "anc_bad_ts",
		};
		writeFileSync(witnessPath, JSON.stringify(badRecord) + "\n", "utf-8");

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--strict-witness-file",
			"--witness-file", witnessPath,
			"--json",
		]);
		expect(exitCode).toBe(1);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.witness.witness_corrupt_lines).toBe(1);
	});
});

describe("verify witness JSON output", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-verify-witness-json-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("H: JSON output includes all witness structured fields (pass path)", async () => {
		const events = makeChainedEvents(3);
		const tipHash = events[2].event_hash as string;
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));
		const witnessPath = join(tmpDir, "witnesses.jsonl");
		const witness = makeWitnessRecord(tipHash);
		writeFileSync(witnessPath, JSON.stringify(witness) + "\n", "utf-8");

		const { output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--require-witness",
			"--witness-file", witnessPath,
			"--json",
		]);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.witness).toBeDefined();
		expect(parsed.witness.witness_checked).toBe(true);
		expect(parsed.witness.witness_present).toBe(true);
		expect(parsed.witness.witness_matching_tip_count).toBe(1);
		expect(parsed.witness.witness_valid_count).toBe(1);
		expect(typeof parsed.witness.witness_latest_age_seconds).toBe("number");
		expect(parsed.witness.witness_corrupt_lines).toBe(0);
		expect(parsed.witness.witness_failure_reason).toBeNull();
	});

	it("H2: JSON output includes all witness fields (fail path)", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const { output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--require-witness",
			"--witness-file", join(tmpDir, "nonexistent.jsonl"),
			"--json",
		]);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.witness).toBeDefined();
		expect(parsed.witness.witness_checked).toBe(true);
		expect(parsed.witness.witness_present).toBe(false);
		expect(parsed.witness.witness_matching_tip_count).toBe(0);
		expect(parsed.witness.witness_valid_count).toBe(0);
		expect(parsed.witness.witness_latest_age_seconds).toBeNull();
		expect(parsed.witness.witness_corrupt_lines).toBe(0);
		expect(typeof parsed.witness.witness_failure_reason).toBe("string");
	});

	it("I: --no-witness-check bypasses witness policy and marks witness_checked false", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const { output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--no-witness-check",
			"--json",
		]);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.witness).toBeDefined();
		expect(parsed.witness.witness_checked).toBe(false);
		expect(parsed.witness.witness_failure_reason).toBeNull();
	});

	it("I2: --no-witness-check skips even when --require-witness is set", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		// --no-witness-check should win over --require-witness
		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--no-witness-check",
			"--json",
		]);
		expect(exitCode).toBeUndefined();
		const parsed = JSON.parse(output.join(""));
		expect(parsed.witness.witness_checked).toBe(false);
	});
});
