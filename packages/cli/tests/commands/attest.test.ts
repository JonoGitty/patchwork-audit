import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, statSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	computeEventHash,
	computeSealPayload,
	signSeal,
	ensureKeyring,
	loadKeyById,
	readSealKey,
	buildAttestationPayload,
	verifyAttestation,
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

function writeJsonl(filePath: string, lines: string[]): void {
	writeFileSync(filePath, lines.join("\n") + "\n", "utf-8");
}

function createTestSeal(tmpDir: string, events: Record<string, unknown>[]): {
	sealPath: string;
	keyringDir: string;
} {
	const keyringDir = join(tmpDir, "keys", "seal");
	const { keyId, key } = ensureKeyring(keyringDir);

	let tipHash = "";
	for (let i = events.length - 1; i >= 0; i--) {
		if (typeof events[i].event_hash === "string") {
			tipHash = events[i].event_hash as string;
			break;
		}
	}

	const sealedAt = new Date().toISOString();
	const payload = computeSealPayload(tipHash, events.length, sealedAt);
	const signature = signSeal(payload, key);

	const seal = {
		sealed_at: sealedAt,
		tip_hash: tipHash,
		chained_events: events.length,
		signature,
		key_id: keyId,
	};

	const sealPath = join(tmpDir, "seals.jsonl");
	writeFileSync(sealPath, JSON.stringify(seal) + "\n", "utf-8");

	return { sealPath, keyringDir };
}

function makeWitnessRecord(tipHash: string): Record<string, unknown> {
	return {
		schema_version: 1,
		witnessed_at: new Date().toISOString(),
		tip_hash: tipHash,
		chained_events: 3,
		seal_signature: "hmac-sha256:fake",
		witness_url: "https://witness.example.com",
		anchor_id: "anc_test_001",
	};
}

async function runAttest(
	args: string[],
): Promise<{ exitCode: number | undefined; output: string[] }> {
	vi.resetModules();
	const { attestCommand } = await import("../../src/commands/attest.js");
	const output: string[] = [];
	const logSpy = vi.spyOn(console, "log").mockImplementation((...a) => {
		output.push(a.map(String).join(" "));
	});
	const previousExitCode = process.exitCode;
	process.exitCode = undefined;
	try {
		await attestCommand.parseAsync(["node", "attest", ...args], { from: "node" });
		return { exitCode: process.exitCode, output };
	} finally {
		process.exitCode = previousExitCode;
		logSpy.mockRestore();
	}
}

describe("patchwork attest", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-attest-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("A: writes signed attestation artifact on successful verification", async () => {
		const events = makeChainedEvents(5);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const { sealPath, keyringDir } = createTestSeal(tmpDir, events);
		const outPath = join(tmpDir, "attestation.json");

		const { exitCode } = await runAttest([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--keyring-dir", keyringDir,
			"--out", outPath,
		]);

		expect(exitCode).toBeUndefined();
		expect(existsSync(outPath)).toBe(true);

		const artifact = JSON.parse(readFileSync(outPath, "utf-8"));
		expect(artifact.schema_version).toBe(1);
		expect(artifact.pass).toBe(true);
		expect(typeof artifact.generated_at).toBe("string");
		expect(artifact.chain.chained_events).toBe(5);
		expect(artifact.chain.hash_mismatch_count).toBe(0);
		expect(artifact.seal.seal_checked).toBe(true);
		expect(artifact.seal.seal_valid).toBe(true);
		expect(artifact.error).toBeNull();
		expect(artifact.input_paths.events).toBe(eventsPath);

		// Signature fields present
		expect(artifact.signature).toMatch(/^hmac-sha256:[0-9a-f]{64}$/);
		expect(artifact.payload_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
		expect(typeof artifact.key_id).toBe("string");
	});

	it("A2: signature verifies with keyring key", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const { sealPath, keyringDir } = createTestSeal(tmpDir, events);
		const outPath = join(tmpDir, "attestation.json");

		await runAttest([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--keyring-dir", keyringDir,
			"--out", outPath,
		]);

		const artifact = JSON.parse(readFileSync(outPath, "utf-8"));
		const key = loadKeyById(keyringDir, artifact.key_id);
		const payload = buildAttestationPayload(artifact);
		expect(verifyAttestation(payload, artifact.signature, key)).toBe(true);
	});

	it("A3: tampered artifact fails signature verification", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const { sealPath, keyringDir } = createTestSeal(tmpDir, events);
		const outPath = join(tmpDir, "attestation.json");

		await runAttest([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--keyring-dir", keyringDir,
			"--out", outPath,
		]);

		const artifact = JSON.parse(readFileSync(outPath, "utf-8"));
		const key = loadKeyById(keyringDir, artifact.key_id);

		// Tamper with the artifact
		artifact.pass = false;
		const tamperedPayload = buildAttestationPayload(artifact);
		expect(verifyAttestation(tamperedPayload, artifact.signature, key)).toBe(false);
	});

	it("A4: legacy key-file signing when keyring unavailable", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		// Create seal with keyring but point attest at a broken keyring + real key
		const { sealPath, keyringDir } = createTestSeal(tmpDir, events);
		const { key } = ensureKeyring(keyringDir);
		// Write the key as a legacy file
		const legacyKeyPath = join(tmpDir, "legacy.key");
		writeFileSync(legacyKeyPath, key, { mode: 0o600 });
		// Place a regular file where the keyring dir would be — mkdirSync will fail
		const brokenKeyring = join(tmpDir, "broken-keyring");
		writeFileSync(brokenKeyring, "not-a-directory", { mode: 0o600 });
		const outPath = join(tmpDir, "attestation.json");

		await runAttest([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--keyring-dir", brokenKeyring,
			"--key-file", legacyKeyPath,
			"--out", outPath,
		]);

		const artifact = JSON.parse(readFileSync(outPath, "utf-8"));
		expect(artifact.signature).toMatch(/^hmac-sha256:/);
		expect(artifact.key_id).toBeUndefined();

		// Verify with legacy key
		const legacyKey = readSealKey(legacyKeyPath);
		const payload = buildAttestationPayload(artifact);
		expect(verifyAttestation(payload, artifact.signature, legacyKey)).toBe(true);
	});

	it("B: non-zero exit when --require-seal and no seal file", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const outPath = join(tmpDir, "attestation.json");

		const { exitCode } = await runAttest([
			"--file", eventsPath,
			"--seal-file", join(tmpDir, "nonexistent.jsonl"),
			"--require-seal",
			"--out", outPath,
		]);

		expect(exitCode).toBe(1);
		const artifact = JSON.parse(readFileSync(outPath, "utf-8"));
		expect(artifact.pass).toBe(false);
		expect(artifact.seal.seal_failure_reason).toContain("No seal file found");
	});

	it("C: non-zero exit when --require-witness and no witness file", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const outPath = join(tmpDir, "attestation.json");

		const { exitCode } = await runAttest([
			"--file", eventsPath,
			"--witness-file", join(tmpDir, "nonexistent.jsonl"),
			"--require-witness",
			"--out", outPath,
		]);

		expect(exitCode).toBe(1);
		const artifact = JSON.parse(readFileSync(outPath, "utf-8"));
		expect(artifact.pass).toBe(false);
		expect(artifact.witness.witness_failure_reason).toContain("No witness file found");
	});

	it("D: --json prints signed artifact JSON to stdout", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const { sealPath, keyringDir } = createTestSeal(tmpDir, events);
		const outPath = join(tmpDir, "attestation.json");

		const { exitCode, output } = await runAttest([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--keyring-dir", keyringDir,
			"--out", outPath,
			"--json",
		]);

		expect(exitCode).toBeUndefined();

		const parsed = JSON.parse(output.join(""));
		expect(parsed.schema_version).toBe(1);
		expect(parsed.pass).toBe(true);
		expect(parsed.chain.chained_events).toBe(3);
		expect(typeof parsed.generated_at).toBe("string");
		expect(parsed.signature).toMatch(/^hmac-sha256:/);
		expect(parsed.payload_hash).toMatch(/^sha256:/);
	});

	it("E: JSON artifact shape includes all expected top-level fields", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const { sealPath, keyringDir } = createTestSeal(tmpDir, events);
		const outPath = join(tmpDir, "attestation.json");

		await runAttest([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--keyring-dir", keyringDir,
			"--out", outPath,
		]);

		const artifact = JSON.parse(readFileSync(outPath, "utf-8"));
		const expectedKeys = [
			"schema_version", "generated_at", "tool_version", "pass",
			"input_paths", "chain", "seal", "witness", "error",
			"chain_tip_hash", "chain_chained_events", "seal_tip_hash",
			"witness_latest_matching_tip_hash",
			"payload_hash", "signature", "key_id",
		];
		for (const key of expectedKeys) {
			expect(artifact).toHaveProperty(key);
		}
	});

	it("E2: binding fields match chain/seal state", async () => {
		const events = makeChainedEvents(5);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const { sealPath, keyringDir } = createTestSeal(tmpDir, events);
		const outPath = join(tmpDir, "attestation.json");

		await runAttest([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--keyring-dir", keyringDir,
			"--out", outPath,
		]);

		const artifact = JSON.parse(readFileSync(outPath, "utf-8"));
		const tipHash = events[4].event_hash as string;
		expect(artifact.chain_tip_hash).toBe(tipHash);
		expect(artifact.chain_chained_events).toBe(5);
		expect(artifact.seal_tip_hash).toBe(tipHash);
		expect(artifact.witness_latest_matching_tip_hash).toBeNull();
	});

	it("E3: binding fields included in signed payload (tamper-proof)", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const { sealPath, keyringDir } = createTestSeal(tmpDir, events);
		const outPath = join(tmpDir, "attestation.json");

		await runAttest([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--keyring-dir", keyringDir,
			"--out", outPath,
		]);

		const artifact = JSON.parse(readFileSync(outPath, "utf-8"));
		const key = loadKeyById(keyringDir, artifact.key_id);

		// Tamper with a binding field
		artifact.chain_chained_events = 999;
		const tamperedPayload = buildAttestationPayload(artifact);
		expect(verifyAttestation(tamperedPayload, artifact.signature, key)).toBe(false);
	});

	it("F: secure permissions — dir 0o700, file 0o600", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const { sealPath, keyringDir } = createTestSeal(tmpDir, events);
		const attestDir = join(tmpDir, "attest-dir");
		const outPath = join(attestDir, "latest.json");

		await runAttest([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--keyring-dir", keyringDir,
			"--out", outPath,
		]);

		expect(existsSync(outPath)).toBe(true);
		const fileStat = statSync(outPath);
		expect(fileStat.mode & 0o777).toBe(0o600);
		const dirStat = statSync(attestDir);
		expect(dirStat.mode & 0o777).toBe(0o700);
	});

	it("F2: reconciles insecure existing dir/file permissions", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const { sealPath, keyringDir } = createTestSeal(tmpDir, events);
		const attestDir = join(tmpDir, "attest-insecure");
		mkdirSync(attestDir, { recursive: true, mode: 0o755 });
		const outPath = join(attestDir, "latest.json");
		writeFileSync(outPath, "{}", { mode: 0o644 });

		await runAttest([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--keyring-dir", keyringDir,
			"--out", outPath,
		]);

		const fileStat = statSync(outPath);
		expect(fileStat.mode & 0o777).toBe(0o600);
		const dirStat = statSync(attestDir);
		expect(dirStat.mode & 0o777).toBe(0o700);
	});

	it("G: records chain integrity failure in artifact", async () => {
		const events = makeChainedEvents(3);
		events[1].event_hash = "sha256:tampered";
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const outPath = join(tmpDir, "attestation.json");

		const { exitCode } = await runAttest([
			"--file", eventsPath,
			"--out", outPath,
		]);

		expect(exitCode).toBe(1);
		const artifact = JSON.parse(readFileSync(outPath, "utf-8"));
		expect(artifact.pass).toBe(false);
		expect(artifact.chain.hash_mismatch_count).toBeGreaterThan(0);
	});

	it("H: records error when events file missing", async () => {
		const outPath = join(tmpDir, "attestation.json");

		const { exitCode } = await runAttest([
			"--file", join(tmpDir, "nonexistent.jsonl"),
			"--out", outPath,
		]);

		expect(exitCode).toBe(1);
		const artifact = JSON.parse(readFileSync(outPath, "utf-8"));
		expect(artifact.pass).toBe(false);
		expect(artifact.error).toContain("No audit log found");
	});

	it("I: --max-seal-age-seconds and --max-witness-age-seconds propagate to artifact", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const { sealPath, keyringDir } = createTestSeal(tmpDir, events);
		const tipHash = events[2].event_hash as string;
		const witnessPath = join(tmpDir, "witnesses.jsonl");
		writeFileSync(witnessPath, JSON.stringify(makeWitnessRecord(tipHash)) + "\n", "utf-8");
		const outPath = join(tmpDir, "attestation.json");

		const { exitCode } = await runAttest([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--keyring-dir", keyringDir,
			"--witness-file", witnessPath,
			"--max-seal-age-seconds", "999999",
			"--max-witness-age-seconds", "999999",
			"--out", outPath,
		]);

		expect(exitCode).toBeUndefined();
		const artifact = JSON.parse(readFileSync(outPath, "utf-8"));
		expect(artifact.pass).toBe(true);
		expect(artifact.seal.seal_checked).toBe(true);
		expect(artifact.seal.seal_valid).toBe(true);
		expect(artifact.witness.witness_checked).toBe(true);
		expect(artifact.witness.witness_matching_tip_count).toBe(1);
	});

	it("J: text output includes artifact path, status, and signed indicator", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const { sealPath, keyringDir } = createTestSeal(tmpDir, events);
		const outPath = join(tmpDir, "attestation.json");

		const { exitCode, output } = await runAttest([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--keyring-dir", keyringDir,
			"--out", outPath,
		]);

		expect(exitCode).toBeUndefined();
		const joined = output.join("\n");
		expect(joined).toContain("Attestation");
		expect(joined).toContain(outPath);
		expect(joined).toContain("Chain events");
		expect(joined).toContain("Signed");
		expect(joined).toContain("yes");
	});
});

describe("attest tool_version", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-attest-ver-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("K: tool_version matches package.json version", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const { sealPath, keyringDir } = createTestSeal(tmpDir, events);
		const outPath = join(tmpDir, "attestation.json");

		await runAttest([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--keyring-dir", keyringDir,
			"--out", outPath,
		]);

		const artifact = JSON.parse(readFileSync(outPath, "utf-8"));

		// Read the actual package.json version
		vi.resetModules();
		const { TOOL_VERSION } = await import("../../src/version.js");
		expect(artifact.tool_version).toBe(TOOL_VERSION);
		expect(artifact.tool_version).toMatch(/^\d+\.\d+\.\d+/);
	});
});

describe("attest history mode", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-attest-hist-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("L: --history writes timestamped artifact and latest", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const { sealPath, keyringDir } = createTestSeal(tmpDir, events);
		const attestDir = join(tmpDir, "attestations");
		const outPath = join(attestDir, "latest.json");

		await runAttest([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--keyring-dir", keyringDir,
			"--out", outPath,
			"--history",
		]);

		expect(existsSync(outPath)).toBe(true);

		// History file should exist
		const files = readdirSync(attestDir);
		const historyFiles = files.filter((f) => f.startsWith("attestation-") && f.endsWith(".json"));
		expect(historyFiles.length).toBe(1);

		// Both files should have same content
		const latest = readFileSync(outPath, "utf-8");
		const history = readFileSync(join(attestDir, historyFiles[0]), "utf-8");
		expect(latest).toBe(history);

		// History file should have secure permissions
		const historyStat = statSync(join(attestDir, historyFiles[0]));
		expect(historyStat.mode & 0o777).toBe(0o600);
	});

	it("M: --max-history-files prunes oldest files", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const { sealPath, keyringDir } = createTestSeal(tmpDir, events);
		const attestDir = join(tmpDir, "attestations");
		mkdirSync(attestDir, { recursive: true, mode: 0o700 });
		const outPath = join(attestDir, "latest.json");

		// Pre-create some history files
		writeFileSync(join(attestDir, "attestation-2026-01-01T00-00-00-000Z.json"), "{}", { mode: 0o600 });
		writeFileSync(join(attestDir, "attestation-2026-01-02T00-00-00-000Z.json"), "{}", { mode: 0o600 });
		writeFileSync(join(attestDir, "attestation-2026-01-03T00-00-00-000Z.json"), "{}", { mode: 0o600 });

		await runAttest([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--keyring-dir", keyringDir,
			"--out", outPath,
			"--history",
			"--max-history-files", "2",
		]);

		const files = readdirSync(attestDir);
		const historyFiles = files.filter((f) => f.startsWith("attestation-") && f.endsWith(".json"));
		// Should keep only 2 most recent (including the one just written)
		expect(historyFiles.length).toBe(2);

		// Oldest file should be pruned
		expect(historyFiles).not.toContain("attestation-2026-01-01T00-00-00-000Z.json");
		expect(historyFiles).not.toContain("attestation-2026-01-02T00-00-00-000Z.json");
	});

	it("N: --max-history-files=1 keeps only the latest history file", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const { sealPath, keyringDir } = createTestSeal(tmpDir, events);
		const attestDir = join(tmpDir, "attestations");
		mkdirSync(attestDir, { recursive: true, mode: 0o700 });
		const outPath = join(attestDir, "latest.json");

		// Pre-create history files
		writeFileSync(join(attestDir, "attestation-2026-01-01T00-00-00-000Z.json"), "{}", { mode: 0o600 });
		writeFileSync(join(attestDir, "attestation-2026-01-02T00-00-00-000Z.json"), "{}", { mode: 0o600 });

		await runAttest([
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--keyring-dir", keyringDir,
			"--out", outPath,
			"--history",
			"--max-history-files", "1",
		]);

		const files = readdirSync(attestDir);
		const historyFiles = files.filter((f) => f.startsWith("attestation-") && f.endsWith(".json"));
		expect(historyFiles.length).toBe(1);
	});
});

describe("attest --profile", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-attest-profile-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("N5: --profile strict enables require-seal and require-witness in attest", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const outPath = join(tmpDir, "attestation.json");

		const { exitCode } = await runAttest([
			"--file", eventsPath,
			"--seal-file", join(tmpDir, "nonexistent.jsonl"),
			"--witness-file", join(tmpDir, "nonexistent-w.jsonl"),
			"--profile", "strict",
			"--out", outPath,
		]);

		expect(exitCode).toBe(1);
		const artifact = JSON.parse(readFileSync(outPath, "utf-8"));
		expect(artifact.pass).toBe(false);
		// Should fail due to seal or witness requirement from profile
		const hasSealFail = artifact.seal?.seal_failure_reason !== null;
		const hasWitnessFail = artifact.witness?.witness_failure_reason !== null;
		expect(hasSealFail || hasWitnessFail).toBe(true);
	});

	it("N5b: --profile baseline does not enforce seal/witness requirements", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const outPath = join(tmpDir, "attestation.json");

		const { exitCode } = await runAttest([
			"--file", eventsPath,
			"--profile", "baseline",
			"--out", outPath,
		]);

		expect(exitCode).toBeUndefined();
		const artifact = JSON.parse(readFileSync(outPath, "utf-8"));
		expect(artifact.pass).toBe(true);
	});
});

describe("attest --max-history-files validation", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-attest-hist-val-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	const invalidInputs = [
		{ value: "0", label: "zero" },
		{ value: "-1", label: "negative" },
		{ value: "3.5", label: "decimal" },
		{ value: "abc", label: "non-numeric" },
	];

	for (const { value, label } of invalidInputs) {
		it(`O: rejects invalid --max-history-files: ${label} ("${value}")`, async () => {
			const events = makeChainedEvents(3);
			const eventsPath = join(tmpDir, "events.jsonl");
			writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
			const outPath = join(tmpDir, "attestation.json");

			const { exitCode, output } = await runAttest([
				"--file", eventsPath,
				"--out", outPath,
				"--history",
				"--max-history-files", value,
			]);
			expect(exitCode).toBe(1);
			const joined = output.join("\n");
			expect(joined).toContain("Invalid --max-history-files");
			// Attestation file should NOT have been written
			expect(existsSync(outPath)).toBe(false);
		});
	}

	it("O2: rejects invalid --max-history-files in JSON mode", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const outPath = join(tmpDir, "attestation.json");

		const { exitCode, output } = await runAttest([
			"--file", eventsPath,
			"--out", outPath,
			"--history",
			"--max-history-files", "0",
			"--json",
		]);
		expect(exitCode).toBe(1);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.error).toContain("Invalid --max-history-files");
	});
});

// ---------------------------------------------------------------------------
// P-series: config validation enforcement in attest
// ---------------------------------------------------------------------------

describe("attest config validation", () => {
	let tmpDir: string;
	let cwdSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-attest-cfgval-"));
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

	async function runAttestWithCwd(args: string[]): Promise<{ exitCode: number | undefined; output: string[] }> {
		cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
		vi.resetModules();
		const { attestCommand } = await import("../../src/commands/attest.js");
		const output: string[] = [];
		const logSpy = vi.spyOn(console, "log").mockImplementation((...a) => {
			output.push(a.map(String).join(" "));
		});
		vi.spyOn(console, "error").mockImplementation(() => {});
		const prev = process.exitCode;
		process.exitCode = undefined;
		try {
			await attestCommand.parseAsync(["node", "attest", ...args], { from: "node" });
			return { exitCode: process.exitCode, output };
		} finally {
			process.exitCode = prev;
			logSpy.mockRestore();
			vi.restoreAllMocks();
		}
	}

	it("P6: strict profile + invalid config => exit 1 in attest", async () => {
		writeConfig("verify:\n  unknown_key: true\n");
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const outPath = join(tmpDir, "attestation.json");

		const { exitCode, output } = await runAttestWithCwd([
			"--file", eventsPath,
			"--profile", "strict",
			"--out", outPath,
		]);
		expect(exitCode).toBe(1);
		const joined = output.join("\n");
		expect(joined).toContain("Config validation failed");
		// Attestation file should NOT have been written
		expect(existsSync(outPath)).toBe(false);
	});

	it("P7: --show-effective-policy works in attest", async () => {
		writeConfig("verify:\n  profile: strict\n  max_seal_age_seconds: 7200\n");

		const { exitCode, output } = await runAttestWithCwd([
			"--show-effective-policy", "--json",
		]);
		expect(exitCode).toBeUndefined();
		const parsed = JSON.parse(output.join(""));
		expect(parsed.resolved_policy).toBeDefined();
		expect(parsed.resolved_policy.profile).toBe("strict");
		expect(parsed.resolved_policy.effective.maxSealAgeSeconds).toBe("7200");
		expect(parsed.resolved_policy.config_validation.status).toBe("valid");
	});
});
