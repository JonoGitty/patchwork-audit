import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	computeEventHash,
	computeSealPayload,
	signSeal,
	ensureKeyring,
	buildAttestationPayload,
	hashAttestationPayload,
	signAttestation,
} from "@patchwork/core";

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
		await verifyCommand.parseAsync(["node", "verify", ...args], { from: "node" });
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

// ---------------------------------------------------------------------------
// Attestation verification tests
// ---------------------------------------------------------------------------

/** Helper: create a signed attestation artifact file. */
function createTestAttestation(
	tmpDir: string,
	events: Record<string, unknown>[],
	overrides: Record<string, unknown> = {},
): { attestationPath: string; keyringDir: string } {
	const keyringDir = join(tmpDir, "keys", "seal");
	const { keyId, key } = ensureKeyring(keyringDir);

	let tipHash = "";
	for (let i = events.length - 1; i >= 0; i--) {
		if (typeof events[i].event_hash === "string") {
			tipHash = events[i].event_hash as string;
			break;
		}
	}

	// Create seal so verify passes seal checks too
	const sealedAt = new Date().toISOString();
	const sealPayload = computeSealPayload(tipHash, events.length, sealedAt);
	const sealSig = signSeal(sealPayload, key);
	const sealPath = join(tmpDir, "seals.jsonl");
	writeFileSync(sealPath, JSON.stringify({
		sealed_at: sealedAt,
		tip_hash: tipHash,
		chained_events: events.length,
		signature: sealSig,
		key_id: keyId,
	}) + "\n", "utf-8");

	const artifact: Record<string, unknown> = {
		schema_version: 1,
		generated_at: new Date().toISOString(),
		tool_version: "0.1.0",
		pass: true,
		input_paths: {
			events: join(tmpDir, "events.jsonl"),
			seals: sealPath,
			witnesses: join(tmpDir, "witnesses.jsonl"),
		},
		chain: {
			total_events: events.length,
			chained_events: events.length,
			legacy_events: 0,
			invalid_schema_events: 0,
			hash_mismatch_count: 0,
			prev_link_mismatch_count: 0,
			first_failure_index: null,
		},
		seal: { seal_checked: true, seal_present: true, seal_valid: true, seal_tip_match: true, seal_tip_hash: tipHash, seal_age_seconds: 0, seal_corrupt_lines: 0, seal_failure_reason: null },
		witness: { witness_checked: false, witness_present: false, witness_matching_tip_count: 0, witness_valid_count: 0, witness_latest_age_seconds: null, witness_corrupt_lines: 0, witness_failure_reason: null },
		attestation: { attestation_checked: false, attestation_present: false, attestation_valid: false, attestation_signed: false, attestation_signature_valid: false, attestation_hash_valid: false, attestation_age_seconds: null, attestation_failure_reason: null, attestation_matches_current_state: false, attestation_match_failure_reason: null },
		error: null,
		// Binding fields — tie attestation to the exact state at generation time
		chain_tip_hash: tipHash,
		chain_chained_events: events.length,
		seal_tip_hash: tipHash,
		witness_latest_matching_tip_hash: null,
		...overrides,
	};

	const payload = buildAttestationPayload(artifact);
	artifact.payload_hash = hashAttestationPayload(payload);
	artifact.signature = signAttestation(payload, key);
	artifact.key_id = keyId;

	const attestationPath = join(tmpDir, "attestation.json");
	writeFileSync(attestationPath, JSON.stringify(artifact, null, 2) + "\n", { mode: 0o600 });

	return { attestationPath, keyringDir };
}

describe("verify --require-attestation", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-verify-attest-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("J: passes with valid signed attestation", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));
		const { attestationPath, keyringDir } = createTestAttestation(tmpDir, events);

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--require-signed-attestation",
			"--attestation-file", attestationPath,
			"--keyring-dir", keyringDir,
			"--json",
		]);
		expect(exitCode).toBeUndefined();
		const parsed = JSON.parse(output.join(""));
		expect(parsed.attestation.attestation_checked).toBe(true);
		expect(parsed.attestation.attestation_present).toBe(true);
		expect(parsed.attestation.attestation_valid).toBe(true);
		expect(parsed.attestation.attestation_signed).toBe(true);
		expect(parsed.attestation.attestation_signature_valid).toBe(true);
		expect(parsed.attestation.attestation_hash_valid).toBe(true);
		expect(parsed.attestation.attestation_failure_reason).toBeNull();
	});

	it("J2: fails when required attestation is missing", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--require-attestation",
			"--attestation-file", join(tmpDir, "nonexistent-attestation.json"),
			"--json",
		]);
		expect(exitCode).toBe(1);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.attestation.attestation_checked).toBe(true);
		expect(parsed.attestation.attestation_present).toBe(false);
		expect(parsed.attestation.attestation_failure_reason).toContain("No attestation file found");
	});

	it("J3: hash mismatch fails without --strict-attestation-file", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));
		const { attestationPath, keyringDir } = createTestAttestation(tmpDir, events);

		// Tamper the artifact — change a field without updating hash
		const artifact = JSON.parse(readFileSync(attestationPath, "utf-8"));
		artifact.pass = false;
		writeFileSync(attestationPath, JSON.stringify(artifact, null, 2) + "\n");

		// No --strict-attestation-file — tamper detection is always-on
		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--attestation-file", attestationPath,
			"--keyring-dir", keyringDir,
			"--json",
		]);
		expect(exitCode).toBe(1);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.attestation.attestation_hash_valid).toBe(false);
		expect(parsed.attestation.attestation_valid).toBe(false);
		expect(parsed.attestation.attestation_failure_reason).toContain("payload_hash mismatch");
	});

	it("J3b: --require-attestation also fails on hash mismatch", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));
		const { attestationPath, keyringDir } = createTestAttestation(tmpDir, events);

		const artifact = JSON.parse(readFileSync(attestationPath, "utf-8"));
		artifact.pass = false;
		writeFileSync(attestationPath, JSON.stringify(artifact, null, 2) + "\n");

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--require-attestation",
			"--attestation-file", attestationPath,
			"--keyring-dir", keyringDir,
			"--json",
		]);
		expect(exitCode).toBe(1);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.attestation.attestation_failure_reason).toContain("payload_hash mismatch");
	});

	it("J4: bad signature fails without --require-signed flag", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));
		const { attestationPath, keyringDir } = createTestAttestation(tmpDir, events);

		// Corrupt the signature but keep payload_hash valid
		const artifact = JSON.parse(readFileSync(attestationPath, "utf-8"));
		artifact.signature = "hmac-sha256:" + "dead".repeat(16);
		writeFileSync(attestationPath, JSON.stringify(artifact, null, 2) + "\n");

		// Only --attestation-file, no require flags — bad sig still fails
		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--attestation-file", attestationPath,
			"--keyring-dir", keyringDir,
			"--json",
		]);
		expect(exitCode).toBe(1);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.attestation.attestation_signed).toBe(true);
		expect(parsed.attestation.attestation_signature_valid).toBe(false);
		expect(parsed.attestation.attestation_failure_reason).toContain("signature is invalid");
	});

	it("J4b: --require-attestation fails on signed-but-invalid signature", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));
		const { attestationPath, keyringDir } = createTestAttestation(tmpDir, events);

		const artifact = JSON.parse(readFileSync(attestationPath, "utf-8"));
		artifact.signature = "hmac-sha256:" + "beef".repeat(16);
		writeFileSync(attestationPath, JSON.stringify(artifact, null, 2) + "\n");

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--require-attestation",
			"--attestation-file", attestationPath,
			"--keyring-dir", keyringDir,
			"--json",
		]);
		expect(exitCode).toBe(1);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.attestation.attestation_valid).toBe(false);
		expect(parsed.attestation.attestation_failure_reason).toContain("signature is invalid");
	});

	it("J5: fails when require-signed and artifact is unsigned", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		// Create unsigned attestation
		const unsignedArtifact: Record<string, unknown> = {
			schema_version: 1,
			generated_at: new Date().toISOString(),
			tool_version: "0.1.0",
			pass: true,
			signature: "unsigned",
			payload_hash: "sha256:dummy",
		};
		const payload = buildAttestationPayload(unsignedArtifact);
		unsignedArtifact.payload_hash = hashAttestationPayload(payload);
		const attestationPath = join(tmpDir, "unsigned-attestation.json");
		writeFileSync(attestationPath, JSON.stringify(unsignedArtifact, null, 2) + "\n");

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--require-signed-attestation",
			"--attestation-file", attestationPath,
			"--json",
		]);
		expect(exitCode).toBe(1);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.attestation.attestation_signed).toBe(false);
		expect(parsed.attestation.attestation_failure_reason).toContain("unsigned");
	});

	it("J6: freshness fails for max-attestation-age-seconds", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		// Create attestation from 2 hours ago
		const oldTime = new Date(Date.now() - 7200 * 1000).toISOString();
		const { attestationPath, keyringDir } = createTestAttestation(tmpDir, events, {
			generated_at: oldTime,
		});

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--max-attestation-age-seconds", "3600",
			"--attestation-file", attestationPath,
			"--keyring-dir", keyringDir,
			"--json",
		]);
		expect(exitCode).toBe(1);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.attestation.attestation_failure_reason).toContain("too old");
	});

	it("J7: freshness passes for recent attestation", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));
		const { attestationPath, keyringDir } = createTestAttestation(tmpDir, events);

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--max-attestation-age-seconds", "3600",
			"--attestation-file", attestationPath,
			"--keyring-dir", keyringDir,
			"--json",
		]);
		expect(exitCode).toBeUndefined();
		const parsed = JSON.parse(output.join(""));
		expect(parsed.attestation.attestation_failure_reason).toBeNull();
	});

	it("J8: --no-attestation-check bypasses attestation and marks unchecked", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const { output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--no-attestation-check",
			"--json",
		]);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.attestation.attestation_checked).toBe(false);
		expect(parsed.attestation.attestation_failure_reason).toBeNull();
	});

	it("J9: rejects invalid --max-attestation-age-seconds", async () => {
		const events = makeChainedEvents(2);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--max-attestation-age-seconds", "abc",
		]);
		expect(exitCode).toBe(1);
		const joined = output.join("\n");
		expect(joined).toContain("Invalid --max-attestation-age-seconds");
	});

	it("J10: JSON output always includes attestation block", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const { output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--json",
		]);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.attestation).toBeDefined();
		expect(typeof parsed.attestation.attestation_checked).toBe("boolean");
		expect(typeof parsed.attestation.attestation_present).toBe("boolean");
	});

	it("J11: text output shows attestation failure", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const { output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--require-attestation",
			"--attestation-file", join(tmpDir, "no-such.json"),
		]);
		const joined = output.join("\n");
		expect(joined).toContain("Attestation FAILED");
	});

	it("J12: --require-attestation passes with unsigned attestation", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		// Create a valid unsigned attestation (hash correct, signature = "unsigned")
		const unsignedArtifact: Record<string, unknown> = {
			schema_version: 1,
			generated_at: new Date().toISOString(),
			tool_version: "0.1.0",
			pass: true,
			signature: "unsigned",
			payload_hash: "sha256:placeholder",
		};
		const payload = buildAttestationPayload(unsignedArtifact);
		unsignedArtifact.payload_hash = hashAttestationPayload(payload);
		const attestationPath = join(tmpDir, "unsigned.json");
		writeFileSync(attestationPath, JSON.stringify(unsignedArtifact, null, 2) + "\n");

		// --require-attestation accepts unsigned (use --require-signed for that)
		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--require-attestation",
			"--attestation-file", attestationPath,
			"--json",
		]);
		expect(exitCode).toBeUndefined();
		const parsed = JSON.parse(output.join(""));
		expect(parsed.attestation.attestation_valid).toBe(true);
		expect(parsed.attestation.attestation_signed).toBe(false);
		expect(parsed.attestation.attestation_failure_reason).toBeNull();
	});

	it("J13: --strict-attestation-file fails when artifact pass=false", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));
		const { attestationPath, keyringDir } = createTestAttestation(tmpDir, events, {
			pass: false,
		});

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--strict-attestation-file",
			"--attestation-file", attestationPath,
			"--keyring-dir", keyringDir,
			"--json",
		]);
		expect(exitCode).toBe(1);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.attestation.attestation_valid).toBe(true);
		expect(parsed.attestation.attestation_hash_valid).toBe(true);
		expect(parsed.attestation.attestation_failure_reason).toContain("pass=false");
	});

	it("J14: --strict-attestation-file passes when artifact pass=true", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));
		const { attestationPath, keyringDir } = createTestAttestation(tmpDir, events);

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--strict-attestation-file",
			"--attestation-file", attestationPath,
			"--keyring-dir", keyringDir,
			"--json",
		]);
		expect(exitCode).toBeUndefined();
		const parsed = JSON.parse(output.join(""));
		expect(parsed.attestation.attestation_valid).toBe(true);
		expect(parsed.attestation.attestation_failure_reason).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Attestation current-state binding tests
// ---------------------------------------------------------------------------

describe("verify attestation state binding", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-verify-binding-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("K1: matching binding fields => pass", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));
		const { attestationPath, keyringDir } = createTestAttestation(tmpDir, events);

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--require-signed-attestation",
			"--attestation-file", attestationPath,
			"--keyring-dir", keyringDir,
			"--json",
		]);
		expect(exitCode).toBeUndefined();
		const parsed = JSON.parse(output.join(""));
		expect(parsed.attestation.attestation_valid).toBe(true);
		expect(parsed.attestation.attestation_matches_current_state).toBe(true);
		expect(parsed.attestation.attestation_match_failure_reason).toBeNull();
		expect(parsed.attestation.attestation_failure_reason).toBeNull();
	});

	it("K2: chain tip mismatch => fail", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		// Create attestation with wrong chain_tip_hash
		const { attestationPath, keyringDir } = createTestAttestation(tmpDir, events, {
			chain_tip_hash: "sha256:wrong_tip_hash_0000000000000000000000000000000000000000000000",
		});

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--require-attestation",
			"--attestation-file", attestationPath,
			"--keyring-dir", keyringDir,
			"--json",
		]);
		expect(exitCode).toBe(1);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.attestation.attestation_valid).toBe(true);
		expect(parsed.attestation.attestation_matches_current_state).toBe(false);
		expect(parsed.attestation.attestation_match_failure_reason).toContain("chain_tip_hash");
		expect(parsed.attestation.attestation_failure_reason).toContain("does not match current state");
	});

	it("K3: chained_events mismatch => fail", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		// Create attestation with wrong chained_events count
		const { attestationPath, keyringDir } = createTestAttestation(tmpDir, events, {
			chain_chained_events: 999,
		});

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--attestation-file", attestationPath,
			"--keyring-dir", keyringDir,
			"--json",
		]);
		expect(exitCode).toBe(1);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.attestation.attestation_matches_current_state).toBe(false);
		expect(parsed.attestation.attestation_match_failure_reason).toContain("chain_chained_events");
	});

	it("K4: stale attestation after new event appended => fail", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		// Create attestation matching current 3-event chain
		const { attestationPath, keyringDir } = createTestAttestation(tmpDir, events);

		// Append a 4th event — chain state changes
		const fourthEvent: Record<string, unknown> = {
			id: "evt_3",
			session_id: "ses_test",
			timestamp: "2026-01-01T00:00:03.000Z",
			agent: "claude-code",
			action: "file_read",
			status: "completed",
			risk: { level: "low", flags: [] },
			prev_hash: events[2].event_hash as string,
		};
		fourthEvent.event_hash = computeEventHash(fourthEvent);
		writeFileSync(filePath, [...events, fourthEvent].map((e) => JSON.stringify(e)).join("\n") + "\n");

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--attestation-file", attestationPath,
			"--keyring-dir", keyringDir,
			"--json",
		]);
		expect(exitCode).toBe(1);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.attestation.attestation_matches_current_state).toBe(false);
		expect(parsed.attestation.attestation_match_failure_reason).toContain("chain_tip_hash");
		expect(parsed.attestation.attestation_match_failure_reason).toContain("chain_chained_events");
	});

	it("K5: JSON output includes new match fields", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));
		const { attestationPath, keyringDir } = createTestAttestation(tmpDir, events);

		const { output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--attestation-file", attestationPath,
			"--keyring-dir", keyringDir,
			"--json",
		]);
		const parsed = JSON.parse(output.join(""));
		expect(typeof parsed.attestation.attestation_matches_current_state).toBe("boolean");
		expect("attestation_match_failure_reason" in parsed.attestation).toBe(true);
	});

	it("K6: legacy attestation without binding fields passes (backward compat)", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		// Create attestation WITHOUT binding fields (simulates old format)
		const keyringDir = join(tmpDir, "keys", "seal");
		const { keyId, key } = ensureKeyring(keyringDir);

		const legacyArtifact: Record<string, unknown> = {
			schema_version: 1,
			generated_at: new Date().toISOString(),
			tool_version: "0.0.9",
			pass: true,
			signature: "unsigned",
			payload_hash: "sha256:placeholder",
		};
		const payload = buildAttestationPayload(legacyArtifact);
		legacyArtifact.payload_hash = hashAttestationPayload(payload);
		legacyArtifact.signature = signAttestation(payload, key);
		legacyArtifact.key_id = keyId;

		const attestationPath = join(tmpDir, "legacy-attestation.json");
		writeFileSync(attestationPath, JSON.stringify(legacyArtifact, null, 2) + "\n");

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--require-signed-attestation",
			"--attestation-file", attestationPath,
			"--keyring-dir", keyringDir,
			"--json",
		]);
		expect(exitCode).toBeUndefined();
		const parsed = JSON.parse(output.join(""));
		expect(parsed.attestation.attestation_valid).toBe(true);
		expect(parsed.attestation.attestation_matches_current_state).toBe(true);
		expect(parsed.attestation.attestation_failure_reason).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// L-series: binding enforcement + remote witness
// ---------------------------------------------------------------------------

describe("verify --require-attestation-binding", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-verify-binding-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("L1: fails when legacy attestation has no binding fields", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const keyringDir = join(tmpDir, "keys", "seal");
		const { keyId, key } = ensureKeyring(keyringDir);

		// Build legacy attestation WITHOUT binding fields
		const legacyArtifact: Record<string, unknown> = {
			schema_version: 1,
			generated_at: new Date().toISOString(),
			tool_version: "0.1.0",
			pass: true,
		};
		const payload = buildAttestationPayload(legacyArtifact);
		legacyArtifact.payload_hash = hashAttestationPayload(payload);
		legacyArtifact.signature = signAttestation(payload, key);
		legacyArtifact.key_id = keyId;

		const attestationPath = join(tmpDir, "attestation.json");
		writeFileSync(attestationPath, JSON.stringify(legacyArtifact, null, 2) + "\n");

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--require-attestation-binding",
			"--attestation-file", attestationPath,
			"--keyring-dir", keyringDir,
			"--json",
		]);
		expect(exitCode).toBe(1);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.attestation.attestation_failure_reason).toContain("missing binding fields");
		expect(parsed.attestation.attestation_matches_current_state).toBe(false);
	});

	it("L2: passes when binding fields present and match", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));
		const { attestationPath, keyringDir } = createTestAttestation(tmpDir, events);

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--seal-file", join(tmpDir, "seals.jsonl"),
			"--require-attestation-binding",
			"--require-signed-attestation",
			"--attestation-file", attestationPath,
			"--keyring-dir", keyringDir,
			"--json",
		]);
		expect(exitCode).toBeUndefined();
		const parsed = JSON.parse(output.join(""));
		expect(parsed.attestation.attestation_valid).toBe(true);
		expect(parsed.attestation.attestation_matches_current_state).toBe(true);
	});

	it("L3: --strict-attestation-file implies binding required (legacy attestation fails)", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const keyringDir = join(tmpDir, "keys", "seal");
		const { keyId, key } = ensureKeyring(keyringDir);

		// Legacy attestation with pass=true but no binding fields
		const legacyArtifact: Record<string, unknown> = {
			schema_version: 1,
			generated_at: new Date().toISOString(),
			tool_version: "0.1.0",
			pass: true,
		};
		const payload = buildAttestationPayload(legacyArtifact);
		legacyArtifact.payload_hash = hashAttestationPayload(payload);
		legacyArtifact.signature = signAttestation(payload, key);
		legacyArtifact.key_id = keyId;

		const attestationPath = join(tmpDir, "attestation.json");
		writeFileSync(attestationPath, JSON.stringify(legacyArtifact, null, 2) + "\n");

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--strict-attestation-file",
			"--attestation-file", attestationPath,
			"--keyring-dir", keyringDir,
			"--json",
		]);
		expect(exitCode).toBe(1);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.attestation.attestation_failure_reason).toContain("missing binding fields");
	});
});

describe("verify --require-remote-witness-proof", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-verify-remote-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	function writeWitnessFile(witnessPath: string, tipHash: string): void {
		const record = {
			schema_version: 1,
			witnessed_at: new Date().toISOString(),
			tip_hash: tipHash,
			chained_events: 3,
			seal_signature: "hmac-sha256:fakesig",
			witness_url: "https://witness.example.com",
			anchor_id: "anchor_abc",
		};
		writeFileSync(witnessPath, JSON.stringify(record) + "\n", "utf-8");
	}

	it("L4: passes when remote witness proof quorum met", async () => {
		vi.resetModules();

		// Mock fetchJson before importing
		vi.doMock("../../src/http-client.js", () => ({
			fetchJson: vi.fn().mockResolvedValue({
				status: 200,
				body: { anchor_id: "anchor_abc", tip_hash: "test" },
			}),
		}));

		const { verifyCommand } = await import("../../src/commands/verify.js");

		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const tipHash = events[events.length - 1].event_hash as string;
		const witnessPath = join(tmpDir, "witnesses.jsonl");
		writeWitnessFile(witnessPath, tipHash);

		const output: string[] = [];
		const logSpy = vi.spyOn(console, "log").mockImplementation((...a) => {
			output.push(a.map(String).join(" "));
		});
		const prev = process.exitCode;
		process.exitCode = undefined;
		try {
			await verifyCommand.parseAsync([
				"node", "verify",
				"--file", filePath,
				"--no-seal-check",
				"--witness-file", witnessPath,
				"--require-remote-witness-proof",
				"--json",
			], { from: "node" });
			const exitCode = process.exitCode;
			expect(exitCode).toBeUndefined();
			const parsed = JSON.parse(output.join(""));
			expect(parsed.remote_witness.remote_witness_checked).toBe(true);
			expect(parsed.remote_witness.remote_witness_quorum_met).toBe(true);
		} finally {
			process.exitCode = prev;
			logSpy.mockRestore();
		}
	});

	it("L5: fails when remote witness proof returns 404", async () => {
		vi.resetModules();

		vi.doMock("../../src/http-client.js", () => ({
			fetchJson: vi.fn().mockResolvedValue({
				status: 404,
				body: { error: "not found" },
			}),
		}));

		const { verifyCommand } = await import("../../src/commands/verify.js");

		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const tipHash = events[events.length - 1].event_hash as string;
		const witnessPath = join(tmpDir, "witnesses.jsonl");
		writeWitnessFile(witnessPath, tipHash);

		const output: string[] = [];
		const logSpy = vi.spyOn(console, "log").mockImplementation((...a) => {
			output.push(a.map(String).join(" "));
		});
		const prev = process.exitCode;
		process.exitCode = undefined;
		try {
			await verifyCommand.parseAsync([
				"node", "verify",
				"--file", filePath,
				"--no-seal-check",
				"--witness-file", witnessPath,
				"--require-remote-witness-proof",
				"--json",
			], { from: "node" });
			expect(process.exitCode).toBe(1);
			const parsed = JSON.parse(output.join(""));
			expect(parsed.remote_witness.remote_witness_quorum_met).toBe(false);
			expect(parsed.remote_witness.remote_witness_failure_reason).toContain("quorum not met");
		} finally {
			process.exitCode = prev;
			logSpy.mockRestore();
		}
	});

	it("L6: --no-remote-witness-check skips remote checks", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const { output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--no-remote-witness-check",
			"--json",
		]);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.remote_witness.remote_witness_checked).toBe(false);
	});

	it("L7: remote witness quorum=2 with one failure returns overall fail", async () => {
		vi.resetModules();

		const mockFetchJson = vi.fn()
			.mockResolvedValueOnce({ status: 200, body: { anchor_id: "a1" } })
			.mockResolvedValueOnce({ status: 500, body: { error: "server error" } });

		vi.doMock("../../src/http-client.js", () => ({
			fetchJson: mockFetchJson,
		}));

		const { verifyCommand } = await import("../../src/commands/verify.js");

		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const tipHash = events[events.length - 1].event_hash as string;
		const witnessPath = join(tmpDir, "witnesses.jsonl");
		// Write 2 witness records
		const records = [
			{ schema_version: 1, witnessed_at: new Date().toISOString(), tip_hash: tipHash, chained_events: 3, seal_signature: "hmac-sha256:s1", witness_url: "https://w1.example.com", anchor_id: "a1" },
			{ schema_version: 1, witnessed_at: new Date().toISOString(), tip_hash: tipHash, chained_events: 3, seal_signature: "hmac-sha256:s2", witness_url: "https://w2.example.com", anchor_id: "a2" },
		];
		writeFileSync(witnessPath, records.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf-8");

		const output: string[] = [];
		const logSpy = vi.spyOn(console, "log").mockImplementation((...a) => {
			output.push(a.map(String).join(" "));
		});
		const prev = process.exitCode;
		process.exitCode = undefined;
		try {
			await verifyCommand.parseAsync([
				"node", "verify",
				"--file", filePath,
				"--no-seal-check",
				"--witness-file", witnessPath,
				"--require-remote-witness-proof",
				"--remote-witness-quorum", "2",
				"--json",
			], { from: "node" });
			expect(process.exitCode).toBe(1);
			const parsed = JSON.parse(output.join(""));
			expect(parsed.remote_witness.remote_witness_verified_count).toBe(1);
			expect(parsed.remote_witness.remote_witness_quorum_met).toBe(false);
		} finally {
			process.exitCode = prev;
			logSpy.mockRestore();
		}
	});

	it("L8: JSON output includes remote_witness section", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const { output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--json",
		]);
		const parsed = JSON.parse(output.join(""));
		expect("remote_witness" in parsed).toBe(true);
		expect(parsed.remote_witness.remote_witness_checked).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// N-series: policy profile + config tests
// ---------------------------------------------------------------------------

describe("verify --profile", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-verify-profile-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("N1: --profile strict enforces require-seal (exits 1 when no seal)", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--profile", "strict",
			"--no-witness-check",
			"--no-remote-witness-check",
			"--no-attestation-check",
			"--seal-file", join(tmpDir, "nonexistent.jsonl"),
			"--json",
		]);
		expect(exitCode).toBe(1);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.seal.seal_failure_reason).toContain("No seal file found");
	});

	it("N2: --no-seal-check overrides profile strict", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const { exitCode, output } = await runVerify([
			"--file", filePath,
			"--profile", "strict",
			"--no-seal-check",
			"--no-witness-check",
			"--no-remote-witness-check",
			"--no-attestation-check",
			"--json",
		]);
		expect(exitCode).toBeUndefined();
		const parsed = JSON.parse(output.join(""));
		expect(parsed.seal.seal_checked).toBe(false);
	});

	it("N3: JSON output includes resolved_policy block", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const { output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
			"--json",
		]);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.resolved_policy).toBeDefined();
		expect(parsed.resolved_policy.profile).toBe("baseline");
		expect(parsed.resolved_policy.config_source).toBeDefined();
		expect(parsed.resolved_policy.effective).toBeDefined();
		expect(typeof parsed.resolved_policy.effective.requireSeal).toBe("boolean");
	});

	it("N3b: JSON resolved_policy reflects strict profile", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const { output } = await runVerify([
			"--file", filePath,
			"--profile", "strict",
			"--no-seal-check",
			"--no-witness-check",
			"--no-remote-witness-check",
			"--no-attestation-check",
			"--json",
		]);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.resolved_policy.profile).toBe("strict");
		// --no-seal-check overrides the profile, so effective requireSeal is false
		expect(parsed.resolved_policy.effective.requireSeal).toBe(false);
	});

	it("N4: text output includes Policy line", async () => {
		const events = makeChainedEvents(3);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const { output } = await runVerify([
			"--file", filePath,
			"--no-seal-check",
		]);
		const joined = output.join("\n");
		expect(joined).toContain("Policy:");
		expect(joined).toContain("baseline");
	});
});

// ---------------------------------------------------------------------------
// P-series: config validation enforcement in verify
// ---------------------------------------------------------------------------

describe("verify config validation", () => {
	let tmpDir: string;
	let cwdSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-verify-cfgval-"));
	});

	afterEach(() => {
		cwdSpy?.mockRestore();
		rmSync(tmpDir, { recursive: true, force: true });
	});

	function writeConfig(content: string): void {
		const configDir = join(tmpDir, ".patchwork");
		mkdirSync(configDir, { recursive: true });
		writeFileSync(join(configDir, "config.yml"), content);
	}

	async function runVerifyWithCwd(args: string[]): Promise<{ exitCode: number | undefined; output: string[]; stderr: string[] }> {
		cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
		vi.resetModules();
		const { verifyCommand } = await import("../../src/commands/verify.js");
		const output: string[] = [];
		const stderr: string[] = [];
		const logSpy = vi.spyOn(console, "log").mockImplementation((...a) => {
			output.push(a.map(String).join(" "));
		});
		const errSpy = vi.spyOn(console, "error").mockImplementation((...a) => {
			stderr.push(a.map(String).join(" "));
		});
		const prev = process.exitCode;
		process.exitCode = undefined;
		try {
			await verifyCommand.parseAsync(["node", "verify", ...args], { from: "node" });
			return { exitCode: process.exitCode, output, stderr };
		} finally {
			process.exitCode = prev;
			logSpy.mockRestore();
			errSpy.mockRestore();
		}
	}

	it("P1: strict profile + unknown key => exit 1 with error message", async () => {
		writeConfig("verify:\n  unknown_key: true\n");
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));

		const { exitCode, output } = await runVerifyWithCwd([
			"--file", eventsPath,
			"--profile", "strict",
		]);
		expect(exitCode).toBe(1);
		const joined = output.join("\n");
		expect(joined).toContain("Config validation failed");
		expect(joined).toContain("unknown_key");
	});

	it("P2: strict profile + wrong type => exit 1", async () => {
		writeConfig("verify:\n  max_seal_age_seconds: not_a_number\n");
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));

		const { exitCode, output } = await runVerifyWithCwd([
			"--file", eventsPath,
			"--profile", "strict",
		]);
		expect(exitCode).toBe(1);
		const joined = output.join("\n");
		expect(joined).toContain("Config validation failed");
	});

	it("P3: baseline + unknown key => warns to stderr, continues verification", async () => {
		writeConfig("verify:\n  profile: baseline\n  unknown_key: true\n");
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));

		const { exitCode, stderr } = await runVerifyWithCwd([
			"--file", eventsPath,
			"--no-seal-check",
		]);
		// Verification should still succeed (baseline continues)
		expect(exitCode).toBeUndefined();
		// Warning should appear on stderr
		const stderrJoined = stderr.join("\n");
		expect(stderrJoined).toContain("Config warning");
		expect(stderrJoined).toContain("unknown_key");
	});

	it("P4: JSON output includes config_validation in resolved_policy", async () => {
		writeConfig("verify:\n  unknown_key: true\n");
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));

		const { exitCode, output } = await runVerifyWithCwd([
			"--file", eventsPath,
			"--profile", "strict",
			"--json",
		]);
		expect(exitCode).toBe(1);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.config_validation).toBeDefined();
		expect(parsed.config_validation.status).toBe("invalid");
		expect(parsed.config_validation.errors.length).toBeGreaterThan(0);
	});

	it("P5: nested unknown key detected in strict profile", async () => {
		writeConfig("verify:\n  max_seal_age_seconds: 3600\n  typo_key: 42\n");
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));

		const { exitCode, output } = await runVerifyWithCwd([
			"--file", eventsPath,
			"--profile", "strict",
		]);
		expect(exitCode).toBe(1);
		const joined = output.join("\n");
		expect(joined).toContain("typo_key");
	});
});

// ---------------------------------------------------------------------------
// Q-series: --show-effective-policy tests
// ---------------------------------------------------------------------------

describe("verify --show-effective-policy", () => {
	let tmpDir: string;
	let cwdSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-verify-policy-"));
	});

	afterEach(() => {
		cwdSpy?.mockRestore();
		rmSync(tmpDir, { recursive: true, force: true });
	});

	function writeConfig(content: string): void {
		const configDir = join(tmpDir, ".patchwork");
		mkdirSync(configDir, { recursive: true });
		writeFileSync(join(configDir, "config.yml"), content);
	}

	async function runVerifyWithCwd(args: string[]): Promise<{ exitCode: number | undefined; output: string[] }> {
		cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
		vi.resetModules();
		const { verifyCommand } = await import("../../src/commands/verify.js");
		const output: string[] = [];
		const logSpy = vi.spyOn(console, "log").mockImplementation((...a) => {
			output.push(a.map(String).join(" "));
		});
		const prev = process.exitCode;
		process.exitCode = undefined;
		try {
			await verifyCommand.parseAsync(["node", "verify", ...args], { from: "node" });
			return { exitCode: process.exitCode, output };
		} finally {
			process.exitCode = prev;
			logSpy.mockRestore();
		}
	}

	it("Q1: text output shows all fields", async () => {
		const { exitCode, output } = await runVerifyWithCwd([
			"--show-effective-policy",
		]);
		expect(exitCode).toBeUndefined();
		const joined = output.join("\n");
		expect(joined).toContain("Effective Policy");
		expect(joined).toContain("Profile:");
		expect(joined).toContain("Config source:");
		expect(joined).toContain("Config validation:");
		expect(joined).toContain("requireSeal:");
		expect(joined).toContain("requireWitness:");
		expect(joined).toContain("requireRemoteWitnessProof:");
		expect(joined).toContain("requireSignedAttestation:");
	});

	it("Q2: JSON output has resolved_policy with correct structure", async () => {
		const { exitCode, output } = await runVerifyWithCwd([
			"--show-effective-policy", "--json",
		]);
		expect(exitCode).toBeUndefined();
		const parsed = JSON.parse(output.join(""));
		expect(parsed.resolved_policy).toBeDefined();
		expect(parsed.resolved_policy.profile).toBe("baseline");
		expect(parsed.resolved_policy.config_source).toBeDefined();
		expect(parsed.resolved_policy.effective).toBeDefined();
		expect(parsed.resolved_policy.config_validation).toBeDefined();
		expect(parsed.resolved_policy.config_validation.status).toBe("valid");
	});

	it("Q3: exits without running verification (no events file needed)", async () => {
		// No events file exists — should still succeed because it exits before verification
		const { exitCode, output } = await runVerifyWithCwd([
			"--show-effective-policy",
			"--file", join(tmpDir, "nonexistent.jsonl"),
		]);
		expect(exitCode).toBeUndefined();
		const joined = output.join("\n");
		expect(joined).toContain("Effective Policy");
	});

	it("Q4: shows config source path", async () => {
		writeConfig("verify:\n  profile: strict\n");
		const { output } = await runVerifyWithCwd([
			"--show-effective-policy",
		]);
		const joined = output.join("\n");
		expect(joined).toContain(join(tmpDir, ".patchwork", "config.yml"));
	});

	it("Q5: shows validation errors in text when config is invalid", async () => {
		writeConfig("verify:\n  unknown_key: true\n");
		const { exitCode, output } = await runVerifyWithCwd([
			"--show-effective-policy",
		]);
		// --show-effective-policy always exits 0 (diagnostic, not enforcement)
		expect(exitCode).toBeUndefined();
		const joined = output.join("\n");
		expect(joined).toContain("invalid");
		expect(joined).toContain("unknown_key");
	});

	it("Q6: JSON includes validation errors when config is invalid", async () => {
		writeConfig("verify:\n  unknown_key: true\n");
		const { exitCode, output } = await runVerifyWithCwd([
			"--show-effective-policy", "--json",
		]);
		expect(exitCode).toBeUndefined();
		const parsed = JSON.parse(output.join(""));
		expect(parsed.resolved_policy.config_validation.status).toBe("invalid");
		expect(parsed.resolved_policy.config_validation.errors.length).toBeGreaterThan(0);
		const paths = parsed.resolved_policy.config_validation.errors.map((e: { path: string }) => e.path);
		expect(paths).toContain("verify.unknown_key");
	});
});
