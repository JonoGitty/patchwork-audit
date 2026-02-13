import { describe, it, expect } from "vitest";
import {
	buildAttestationPayload,
	hashAttestationPayload,
	signAttestation,
	verifyAttestation,
} from "../../src/hash/attestation.js";
import { randomBytes } from "node:crypto";

const TEST_KEY = randomBytes(32);

function makeSampleArtifact(): Record<string, unknown> {
	return {
		schema_version: 1,
		generated_at: "2026-01-15T12:00:00.000Z",
		tool_version: "0.1.0",
		pass: true,
		input_paths: {
			events: "/tmp/events.jsonl",
			seals: "/tmp/seals.jsonl",
			witnesses: "/tmp/witnesses.jsonl",
		},
		chain: {
			total_events: 5,
			chained_events: 5,
			legacy_events: 0,
			invalid_schema_events: 0,
			hash_mismatch_count: 0,
			prev_link_mismatch_count: 0,
			first_failure_index: null,
		},
		seal: {
			seal_checked: true,
			seal_present: true,
			seal_valid: true,
			seal_tip_match: true,
			seal_age_seconds: 10,
			seal_corrupt_lines: 0,
			seal_failure_reason: null,
		},
		witness: {
			witness_checked: false,
			witness_present: false,
			witness_matching_tip_count: 0,
			witness_valid_count: 0,
			witness_latest_age_seconds: null,
			witness_corrupt_lines: 0,
			witness_failure_reason: null,
		},
		error: null,
	};
}

describe("buildAttestationPayload", () => {
	it("produces deterministic output for identical input", () => {
		const artifact = makeSampleArtifact();
		const a = buildAttestationPayload(artifact);
		const b = buildAttestationPayload(artifact);
		expect(a).toBe(b);
	});

	it("excludes signature and payload_hash from payload", () => {
		const artifact = makeSampleArtifact();
		artifact.signature = "hmac-sha256:abc";
		artifact.payload_hash = "sha256:def";
		artifact.key_id = "key123";

		const payload = buildAttestationPayload(artifact);
		const parsed = JSON.parse(payload);
		expect(parsed.signature).toBeUndefined();
		expect(parsed.payload_hash).toBeUndefined();
		expect(parsed.key_id).toBeUndefined();
	});

	it("uses sorted keys for determinism", () => {
		const a: Record<string, unknown> = { z_field: 1, a_field: 2 };
		const b: Record<string, unknown> = { a_field: 2, z_field: 1 };
		expect(buildAttestationPayload(a)).toBe(buildAttestationPayload(b));
	});
});

describe("hashAttestationPayload", () => {
	it("returns sha256-prefixed hash", () => {
		const hash = hashAttestationPayload("test-payload");
		expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
	});

	it("is deterministic", () => {
		const a = hashAttestationPayload("same-input");
		const b = hashAttestationPayload("same-input");
		expect(a).toBe(b);
	});

	it("differs for different inputs", () => {
		const a = hashAttestationPayload("input-a");
		const b = hashAttestationPayload("input-b");
		expect(a).not.toBe(b);
	});
});

describe("signAttestation + verifyAttestation", () => {
	it("round-trip: sign then verify succeeds", () => {
		const payload = buildAttestationPayload(makeSampleArtifact());
		const sig = signAttestation(payload, TEST_KEY);
		expect(sig).toMatch(/^hmac-sha256:[0-9a-f]{64}$/);
		expect(verifyAttestation(payload, sig, TEST_KEY)).toBe(true);
	});

	it("verification fails with wrong key", () => {
		const payload = buildAttestationPayload(makeSampleArtifact());
		const sig = signAttestation(payload, TEST_KEY);
		const wrongKey = randomBytes(32);
		expect(verifyAttestation(payload, sig, wrongKey)).toBe(false);
	});

	it("verification fails with tampered payload", () => {
		const payload = buildAttestationPayload(makeSampleArtifact());
		const sig = signAttestation(payload, TEST_KEY);
		const tampered = payload.replace("true", "false");
		expect(verifyAttestation(tampered, sig, TEST_KEY)).toBe(false);
	});

	it("verification fails with tampered signature", () => {
		const payload = buildAttestationPayload(makeSampleArtifact());
		const sig = signAttestation(payload, TEST_KEY);
		const tampered = sig.slice(0, -4) + "dead";
		expect(verifyAttestation(payload, tampered, TEST_KEY)).toBe(false);
	});

	it("same input always produces same signature (deterministic)", () => {
		const payload = buildAttestationPayload(makeSampleArtifact());
		const a = signAttestation(payload, TEST_KEY);
		const b = signAttestation(payload, TEST_KEY);
		expect(a).toBe(b);
	});
});
