import { describe, it, expect } from "vitest";
import { CommitAttestationSchema } from "../../src/schema/commit-attestation.js";

describe("CommitAttestationSchema", () => {
	const validAttestation = {
		schema_version: 1,
		type: "commit-attestation",
		generated_at: new Date().toISOString(),
		tool_version: "0.5.0",
		// commit_sha now requires a real 40- or 64-hex git SHA; abbreviated git
		// short hashes are rejected because they can collide and because they
		// previously let attackers feed arbitrary strings into the attestation
		// filename / git-notes argv.
		commit_sha: "0123456789abcdef0123456789abcdef01234567",
		branch: "main",
		project_root: "/Users/test/project",
		session_id: "ses_test123",
		session_events_count: 10,
		session_events_since_last_commit: 5,
		chain_tip_hash: "sha256:abc123",
		chain_valid: true,
		chain_chained_events: 10,
		risk_summary: {
			critical: 0,
			high: 1,
			medium: 3,
			low: 4,
			none: 2,
			denials: 0,
		},
		policy_source: ".patchwork.yml",
		pass: true,
		failure_reasons: [],
		payload_hash: "sha256:def456",
		signature: "hmac-sha256:abc",
	};

	it("validates a complete attestation", () => {
		const result = CommitAttestationSchema.safeParse(validAttestation);
		expect(result.success).toBe(true);
	});

	it("accepts null chain_tip_hash", () => {
		const result = CommitAttestationSchema.safeParse({
			...validAttestation,
			chain_tip_hash: null,
		});
		expect(result.success).toBe(true);
	});

	it("accepts failure_reasons list", () => {
		const result = CommitAttestationSchema.safeParse({
			...validAttestation,
			pass: false,
			failure_reasons: ["chain_integrity_failure", "policy_denials_present"],
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.failure_reasons).toHaveLength(2);
		}
	});

	it("accepts unsigned signature", () => {
		const result = CommitAttestationSchema.safeParse({
			...validAttestation,
			signature: "unsigned",
		});
		expect(result.success).toBe(true);
	});

	it("accepts optional key_id", () => {
		const result = CommitAttestationSchema.safeParse({
			...validAttestation,
			key_id: "seal-2026-04-02",
		});
		expect(result.success).toBe(true);
	});

	it("rejects wrong schema_version", () => {
		const result = CommitAttestationSchema.safeParse({
			...validAttestation,
			schema_version: 2,
		});
		expect(result.success).toBe(false);
	});

	it("rejects wrong type", () => {
		const result = CommitAttestationSchema.safeParse({
			...validAttestation,
			type: "session-attestation",
		});
		expect(result.success).toBe(false);
	});

	it("rejects missing commit_sha", () => {
		const { commit_sha, ...rest } = validAttestation;
		const result = CommitAttestationSchema.safeParse(rest);
		expect(result.success).toBe(false);
	});

	it("rejects missing risk_summary", () => {
		const { risk_summary, ...rest } = validAttestation;
		const result = CommitAttestationSchema.safeParse(rest);
		expect(result.success).toBe(false);
	});

	it("rejects abbreviated commit_sha (short git SHAs)", () => {
		const result = CommitAttestationSchema.safeParse({
			...validAttestation,
			commit_sha: "abc1234",
		});
		expect(result.success).toBe(false);
	});

	it("rejects path-traversal style commit_sha", () => {
		const result = CommitAttestationSchema.safeParse({
			...validAttestation,
			commit_sha: "../../../etc/passwd",
		});
		expect(result.success).toBe(false);
	});

	it("accepts a 64-char SHA-256 commit_sha", () => {
		const result = CommitAttestationSchema.safeParse({
			...validAttestation,
			commit_sha: "0".repeat(64),
		});
		expect(result.success).toBe(true);
	});

	it("rejects branch names containing control characters", () => {
		const result = CommitAttestationSchema.safeParse({
			...validAttestation,
			branch: "main\nPatchwork-Approved: forged",
		});
		expect(result.success).toBe(false);
	});

	it("rejects empty branch", () => {
		const result = CommitAttestationSchema.safeParse({
			...validAttestation,
			branch: "",
		});
		expect(result.success).toBe(false);
	});
});
