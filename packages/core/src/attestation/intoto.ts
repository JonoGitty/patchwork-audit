/**
 * In-toto Statement + DSSE envelope wrapper for Patchwork commit attestations.
 *
 * Lets Patchwork emit attestations in a format the rest of the supply-chain
 * world recognises: in-toto Statement v1 inside a DSSE envelope. The envelope
 * is the unit of cryptographic verification — its PAE (pre-authentication
 * encoding) is what gets signed, not the in-toto Statement directly.
 *
 * Spec references:
 *   - in-toto Statement v1: https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md
 *   - DSSE envelope:        https://github.com/secure-systems-lab/dsse/blob/master/envelope.md
 *
 * Pure module: no fs, no exec, no network. Crypto operations are passed in as
 * functions so the same module works against the local keyring, the relay
 * signing proxy, or (later) Sigstore's Rekor.
 */
import { createHash } from "node:crypto";

import type { CommitAttestation, RiskSummary } from "../schema/commit-attestation.js";

/** in-toto Statement v1 type URI. */
export const IN_TOTO_STATEMENT_TYPE = "https://in-toto.io/Statement/v1";

/** Patchwork's predicate type — namespaced to the project so it doesn't claim a SLSA slot. */
export const PATCHWORK_PREDICATE_TYPE = "https://patchwork-audit.dev/ai-agent-session/v1";

/** DSSE payloadType for in-toto Statements. */
export const DSSE_PAYLOAD_TYPE = "application/vnd.in-toto+json";

export interface InTotoSubject {
	/** Display name — Patchwork uses `git+<branch>:<commit>`. */
	name: string;
	/** Map of digest algorithm → hex digest. Patchwork emits `gitCommit` per in-toto convention. */
	digest: Record<string, string>;
}

export interface InTotoStatement<P = unknown> {
	_type: typeof IN_TOTO_STATEMENT_TYPE;
	subject: InTotoSubject[];
	predicateType: string;
	predicate: P;
}

export interface DsseSignature {
	keyid: string;
	sig: string;
}

export interface DsseEnvelope {
	payloadType: string;
	/** base64-encoded canonical Statement JSON. */
	payload: string;
	signatures: DsseSignature[];
}

/**
 * Patchwork's in-toto predicate — the operational claims about the AI agent
 * session that produced the commit. The git binding (commit_sha, branch)
 * lives on the Statement's `subject`, not in the predicate, per in-toto
 * convention. Signing fields (signature, payload_hash, key_id) move to the
 * DSSE envelope and are absent from the predicate.
 */
export interface PatchworkAiAgentPredicate {
	schema_version: 1;
	generated_at: string;
	tool_version: string;
	project_root: string;
	session_id: string;
	session_events_count: number;
	session_events_since_last_commit: number;
	chain_tip_hash: string | null;
	chain_valid: boolean;
	chain_chained_events: number;
	risk_summary: RiskSummary;
	policy_source: string;
	pass: boolean;
	failure_reasons: string[];
}

/**
 * DSSE Pre-Authentication Encoding (PAE).
 *
 *   "DSSEv1" SP LEN(t) SP t SP LEN(m) SP m
 *
 * Where SP is a single space (0x20), LEN is the ASCII-decimal byte length,
 * t is the payloadType, and m is the raw payload bytes (NOT base64).
 *
 * This is the byte string that actually gets signed/verified — verifiers MUST
 * recompute it from the envelope's payloadType and base64-decoded payload to
 * defend against payload-substitution attacks.
 */
export function dssePAE(payloadType: string, payload: Buffer): Buffer {
	const t = Buffer.from(payloadType, "utf8");
	const m = payload;
	const prefix = `DSSEv1 ${t.length} `;
	const middle = ` ${m.length} `;
	return Buffer.concat([
		Buffer.from(prefix, "utf8"),
		t,
		Buffer.from(middle, "utf8"),
		m,
	]);
}

/**
 * Canonical JSON serialization for in-toto Statements. Recursively sorts
 * object keys so identical content always produces identical bytes —
 * required for deterministic hashing and signing.
 */
export function canonicalize(value: unknown): string {
	return JSON.stringify(deepSort(value));
}

function deepSort(value: unknown): unknown {
	if (value === null || typeof value !== "object") return value;
	if (Array.isArray(value)) return value.map(deepSort);
	const obj = value as Record<string, unknown>;
	const out: Record<string, unknown> = {};
	for (const k of Object.keys(obj).sort()) out[k] = deepSort(obj[k]);
	return out;
}

/**
 * Build an in-toto Statement v1 from a Patchwork commit attestation. The
 * commit binding (sha, branch) becomes the Statement's subject; everything
 * else (minus signing fields) becomes the predicate.
 */
export function buildInTotoStatement(
	attestation: CommitAttestation,
): InTotoStatement<PatchworkAiAgentPredicate> {
	const predicate: PatchworkAiAgentPredicate = {
		schema_version: 1,
		generated_at: attestation.generated_at,
		tool_version: attestation.tool_version,
		project_root: attestation.project_root,
		session_id: attestation.session_id,
		session_events_count: attestation.session_events_count,
		session_events_since_last_commit: attestation.session_events_since_last_commit,
		chain_tip_hash: attestation.chain_tip_hash,
		chain_valid: attestation.chain_valid,
		chain_chained_events: attestation.chain_chained_events,
		risk_summary: attestation.risk_summary,
		policy_source: attestation.policy_source,
		pass: attestation.pass,
		failure_reasons: attestation.failure_reasons,
	};

	return {
		_type: IN_TOTO_STATEMENT_TYPE,
		subject: [{
			name: `git+${attestation.branch}:${attestation.commit_sha}`,
			digest: { gitCommit: attestation.commit_sha },
		}],
		predicateType: PATCHWORK_PREDICATE_TYPE,
		predicate,
	};
}

/**
 * Sign-fn signature for the DSSE envelope build path. Takes the PAE bytes,
 * returns a base64 signature + the keyid that produced it. Lets callers wire
 * in HMAC, the relay signing proxy, ed25519, etc. without this module
 * depending on any one of them.
 */
export type DsseSignFn = (pae: Buffer) => Promise<{ keyid: string; sigBase64: string }>;

/** Verify-fn signature for the DSSE envelope verification path. */
export type DsseVerifyFn = (
	keyid: string,
	pae: Buffer,
	sigBase64: string,
) => Promise<boolean>;

/**
 * Build a DSSE envelope around an in-toto Statement, signing the PAE. The
 * statement is canonicalized to bytes, base64-encoded for the envelope's
 * payload field, and the PAE of (payloadType, raw bytes) is what gets signed.
 */
export async function buildDsseEnvelope(
	statement: InTotoStatement,
	signFn: DsseSignFn,
): Promise<DsseEnvelope> {
	const payloadBytes = Buffer.from(canonicalize(statement), "utf8");
	const pae = dssePAE(DSSE_PAYLOAD_TYPE, payloadBytes);
	const { keyid, sigBase64 } = await signFn(pae);
	return {
		payloadType: DSSE_PAYLOAD_TYPE,
		payload: payloadBytes.toString("base64"),
		signatures: [{ keyid, sig: sigBase64 }],
	};
}

/**
 * Verify a DSSE envelope's signature(s). Returns true if AT LEAST ONE
 * signature verifies — DSSE envelopes can carry multiple signatures (e.g.
 * threshold signing) and any one valid signature is sufficient unless the
 * caller wires stricter policy on top.
 */
export async function verifyDsseEnvelope(
	envelope: DsseEnvelope,
	verifyFn: DsseVerifyFn,
): Promise<boolean> {
	if (!envelope.signatures || envelope.signatures.length === 0) return false;
	const payloadBytes = Buffer.from(envelope.payload, "base64");
	const pae = dssePAE(envelope.payloadType, payloadBytes);
	for (const sig of envelope.signatures) {
		try {
			if (await verifyFn(sig.keyid, pae, sig.sig)) return true;
		} catch {
			// continue — try the next signature
		}
	}
	return false;
}

/**
 * Decode the in-toto Statement out of a DSSE envelope. Throws if the payload
 * is not the expected payloadType (defends against typed-payload confusion).
 */
export function decodeStatement<P = unknown>(envelope: DsseEnvelope): InTotoStatement<P> {
	if (envelope.payloadType !== DSSE_PAYLOAD_TYPE) {
		throw new Error(
			`unexpected DSSE payloadType: ${envelope.payloadType} (expected ${DSSE_PAYLOAD_TYPE})`,
		);
	}
	const json = Buffer.from(envelope.payload, "base64").toString("utf8");
	return JSON.parse(json) as InTotoStatement<P>;
}

/**
 * Compute the SHA-256 digest of a DSSE envelope's payload (in-toto Statement
 * bytes). Useful as a stable identifier for the attestation across systems —
 * Rekor uses the same digest as the Merkle leaf hash for in-toto entries.
 */
export function digestStatement(envelope: DsseEnvelope): string {
	const payloadBytes = Buffer.from(envelope.payload, "base64");
	return `sha256:${createHash("sha256").update(payloadBytes).digest("hex")}`;
}
