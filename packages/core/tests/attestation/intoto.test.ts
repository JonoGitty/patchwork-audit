import { describe, it, expect } from "vitest";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
	IN_TOTO_STATEMENT_TYPE,
	PATCHWORK_PREDICATE_TYPE,
	DSSE_PAYLOAD_TYPE,
	dssePAE,
	buildInTotoStatement,
	buildDsseEnvelope,
	verifyDsseEnvelope,
	decodeStatement,
	digestStatement,
	type DsseEnvelope,
} from "../../src/index.js";
import { canonicalize } from "../../src/attestation/intoto.js";
import type { CommitAttestation } from "../../src/schema/commit-attestation.js";

const KEY = Buffer.from("test-key-bytes-not-for-production-use", "utf8");
const KEY_ID = "test-key-1";

const sampleAttestation: CommitAttestation = {
	schema_version: 1,
	type: "commit-attestation",
	generated_at: "2026-04-28T15:00:00.000Z",
	tool_version: "0.6.9",
	commit_sha: "abc123def456abc123def456abc123def456abcd",
	branch: "main",
	project_root: "/tmp/repo",
	session_id: "01HX0000000000000000000000",
	session_events_count: 12,
	session_events_since_last_commit: 4,
	chain_tip_hash: "sha256:deadbeef",
	chain_valid: true,
	chain_chained_events: 12,
	risk_summary: {
		critical: 0,
		high: 0,
		medium: 1,
		low: 3,
		none: 8,
		denials: 0,
		denials_high_risk_since_last_commit: 0,
	},
	policy_source: "/tmp/repo/.patchwork/policy.yml",
	pass: true,
	failure_reasons: [],
	payload_hash: "sha256:cafef00d",
	signature: "hmac-sha256:00112233",
	key_id: KEY_ID,
};

const hmacSign = async (pae: Buffer) => {
	const mac = createHmac("sha256", KEY);
	mac.update(pae);
	return { keyid: KEY_ID, sigBase64: mac.digest("base64") };
};

const hmacVerify = async (keyid: string, pae: Buffer, sigBase64: string) => {
	if (keyid !== KEY_ID) return false;
	const mac = createHmac("sha256", KEY);
	mac.update(pae);
	const expected = mac.digest();
	const got = Buffer.from(sigBase64, "base64");
	if (got.length !== expected.length) return false;
	return timingSafeEqual(expected, got);
};

describe("DSSE PAE", () => {
	it("produces 'DSSEv1 LEN(t) t LEN(m) m' format", () => {
		const pae = dssePAE("application/x-test", Buffer.from("hello"));
		expect(pae.toString("utf8")).toBe("DSSEv1 18 application/x-test 5 hello");
	});

	it("uses byte length, not codepoint length, for multi-byte payloads", () => {
		const payload = Buffer.from("héllo", "utf8"); // 6 bytes (é is 2 bytes in UTF-8)
		const pae = dssePAE("application/vnd.in-toto+json", payload);
		expect(pae.toString("utf8")).toBe("DSSEv1 28 application/vnd.in-toto+json 6 héllo");
	});

	it("preserves raw bytes in payload region without re-encoding", () => {
		const payload = Buffer.from([0x00, 0xff, 0x10, 0x20]);
		const pae = dssePAE("test/raw", payload);
		const tail = pae.subarray(pae.length - 4);
		expect(tail).toEqual(payload);
	});
});

describe("canonicalize", () => {
	it("sorts keys deterministically across reorderings", () => {
		const a = { z: 1, a: 2, m: { y: 3, b: 4 } };
		const b = { m: { b: 4, y: 3 }, a: 2, z: 1 };
		expect(canonicalize(a)).toBe(canonicalize(b));
	});

	it("preserves array order", () => {
		expect(canonicalize([3, 1, 2])).toBe("[3,1,2]");
	});
});

describe("buildInTotoStatement", () => {
	it("produces a valid in-toto Statement v1", () => {
		const stmt = buildInTotoStatement(sampleAttestation);
		expect(stmt._type).toBe(IN_TOTO_STATEMENT_TYPE);
		expect(stmt.predicateType).toBe(PATCHWORK_PREDICATE_TYPE);
		expect(stmt.subject).toHaveLength(1);
		expect(stmt.subject[0].digest).toEqual({ gitCommit: sampleAttestation.commit_sha });
		expect(stmt.subject[0].name).toBe(`git+main:${sampleAttestation.commit_sha}`);
	});

	it("strips signing fields from the predicate", () => {
		const stmt = buildInTotoStatement(sampleAttestation);
		const predicate = stmt.predicate as Record<string, unknown>;
		expect(predicate.signature).toBeUndefined();
		expect(predicate.payload_hash).toBeUndefined();
		expect(predicate.key_id).toBeUndefined();
	});

	it("retains operational fields in the predicate", () => {
		const stmt = buildInTotoStatement(sampleAttestation);
		expect(stmt.predicate.session_id).toBe(sampleAttestation.session_id);
		expect(stmt.predicate.chain_valid).toBe(true);
		expect(stmt.predicate.risk_summary.medium).toBe(1);
		expect(stmt.predicate.failure_reasons).toEqual([]);
	});

	it("does not leak commit_sha or branch into the predicate (they live on the subject)", () => {
		const stmt = buildInTotoStatement(sampleAttestation);
		const predicate = stmt.predicate as Record<string, unknown>;
		expect(predicate.commit_sha).toBeUndefined();
		expect(predicate.branch).toBeUndefined();
	});
});

describe("buildDsseEnvelope + verifyDsseEnvelope", () => {
	it("round-trips a signed envelope back to verified true", async () => {
		const stmt = buildInTotoStatement(sampleAttestation);
		const env = await buildDsseEnvelope(stmt, hmacSign);
		expect(env.payloadType).toBe(DSSE_PAYLOAD_TYPE);
		expect(env.signatures).toHaveLength(1);
		expect(env.signatures[0].keyid).toBe(KEY_ID);
		const ok = await verifyDsseEnvelope(env, hmacVerify);
		expect(ok).toBe(true);
	});

	it("rejects a tampered payload", async () => {
		const stmt = buildInTotoStatement(sampleAttestation);
		const env = await buildDsseEnvelope(stmt, hmacSign);
		const decoded = JSON.parse(Buffer.from(env.payload, "base64").toString("utf8"));
		decoded.predicate.pass = false;
		const tampered: DsseEnvelope = {
			...env,
			payload: Buffer.from(JSON.stringify(decoded), "utf8").toString("base64"),
		};
		const ok = await verifyDsseEnvelope(tampered, hmacVerify);
		expect(ok).toBe(false);
	});

	it("rejects a tampered payloadType", async () => {
		const stmt = buildInTotoStatement(sampleAttestation);
		const env = await buildDsseEnvelope(stmt, hmacSign);
		const tampered: DsseEnvelope = { ...env, payloadType: "application/x-evil" };
		const ok = await verifyDsseEnvelope(tampered, hmacVerify);
		expect(ok).toBe(false);
	});

	it("returns false when no signatures are present", async () => {
		const stmt = buildInTotoStatement(sampleAttestation);
		const env = await buildDsseEnvelope(stmt, hmacSign);
		const stripped: DsseEnvelope = { ...env, signatures: [] };
		const ok = await verifyDsseEnvelope(stripped, hmacVerify);
		expect(ok).toBe(false);
	});

	it("accepts at least one valid signature among many", async () => {
		const stmt = buildInTotoStatement(sampleAttestation);
		const env = await buildDsseEnvelope(stmt, hmacSign);
		const withBogus: DsseEnvelope = {
			...env,
			signatures: [
				{ keyid: "wrong", sig: Buffer.from("garbage").toString("base64") },
				...env.signatures,
			],
		};
		const ok = await verifyDsseEnvelope(withBogus, hmacVerify);
		expect(ok).toBe(true);
	});
});

describe("decodeStatement", () => {
	it("decodes the Statement out of a valid envelope", async () => {
		const stmt = buildInTotoStatement(sampleAttestation);
		const env = await buildDsseEnvelope(stmt, hmacSign);
		const decoded = decodeStatement(env);
		expect(decoded._type).toBe(IN_TOTO_STATEMENT_TYPE);
		expect(decoded.predicateType).toBe(PATCHWORK_PREDICATE_TYPE);
	});

	it("throws on unexpected payloadType (defends against typed-payload confusion)", () => {
		const env: DsseEnvelope = {
			payloadType: "application/x-other",
			payload: Buffer.from("{}", "utf8").toString("base64"),
			signatures: [],
		};
		expect(() => decodeStatement(env)).toThrow(/payloadType/);
	});
});

describe("digestStatement", () => {
	it("returns sha256:<hex> of the raw payload bytes", async () => {
		const stmt = buildInTotoStatement(sampleAttestation);
		const env = await buildDsseEnvelope(stmt, hmacSign);
		const digest = digestStatement(env);
		expect(digest).toMatch(/^sha256:[0-9a-f]{64}$/);
	});

	it("is stable across rebuilds of the same statement", async () => {
		const stmt = buildInTotoStatement(sampleAttestation);
		const env1 = await buildDsseEnvelope(stmt, hmacSign);
		const env2 = await buildDsseEnvelope(stmt, hmacSign);
		expect(digestStatement(env1)).toBe(digestStatement(env2));
	});
});
