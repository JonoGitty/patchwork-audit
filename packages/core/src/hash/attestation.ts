import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const EXCLUDED_FIELDS = new Set(["signature", "payload_hash", "key_id", "signature_source"]);

/**
 * Recursively sort object keys for deterministic JSON serialization.
 * Arrays are preserved in order; nested objects get sorted keys.
 */
function deepSortKeys(value: unknown): unknown {
	if (value === null || typeof value !== "object") return value;
	if (Array.isArray(value)) return value.map(deepSortKeys);

	const obj = value as Record<string, unknown>;
	const sorted: Record<string, unknown> = {};
	for (const k of Object.keys(obj).sort()) {
		sorted[k] = deepSortKeys(obj[k]);
	}
	return sorted;
}

/**
 * Build a deterministic canonical payload string from an attestation artifact
 * for HMAC signing. The signature, payload_hash, and key_id fields are
 * excluded from the signed payload to avoid circular dependency.
 *
 * The canonical form uses recursively sorted JSON keys at all levels to ensure
 * identical input always produces identical output regardless of key order.
 */
export function buildAttestationPayload(artifact: Record<string, unknown>): string {
	// Build ordered object excluding signature-related fields
	const keys = Object.keys(artifact)
		.filter((k) => !EXCLUDED_FIELDS.has(k))
		.sort();

	const ordered: Record<string, unknown> = {};
	for (const k of keys) {
		ordered[k] = deepSortKeys(artifact[k]);
	}
	return JSON.stringify(ordered);
}

/**
 * Compute the SHA-256 hash of an attestation payload.
 * Returns `sha256:<hex>`.
 */
export function hashAttestationPayload(payload: string): string {
	return `sha256:${createHash("sha256").update(payload).digest("hex")}`;
}

/**
 * Sign an attestation payload with HMAC-SHA256.
 * Returns `hmac-sha256:<hex>`.
 */
export function signAttestation(payload: string, key: Buffer): string {
	const hmac = createHmac("sha256", key);
	hmac.update(payload);
	return `hmac-sha256:${hmac.digest("hex")}`;
}

/**
 * Verify an HMAC-SHA256 attestation signature using constant-time comparison.
 */
export function verifyAttestation(
	payload: string,
	signature: string,
	key: Buffer,
): boolean {
	const expected = signAttestation(payload, key);
	if (expected.length !== signature.length) return false;
	return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * Full-attestation verifier — verifies BOTH the signature AND that the stored
 * `payload_hash` matches the canonical payload. Use this in preference to
 * raw `verifyAttestation()` when the artifact stores a `payload_hash` field.
 *
 * Without this check, an attacker can mutate `payload_hash` (which is excluded
 * from the signed payload by design — see EXCLUDED_FIELDS) without
 * invalidating the signature. Downstream systems that key on or display
 * `payload_hash` would then trust an attacker-chosen value while the
 * signature still verifies.
 *
 * The artifact MUST carry a string `payload_hash`. A missing or non-string
 * value is treated as a verification failure, not a "skip the check" — the
 * earlier conditional silently degraded to plain `verifyAttestation()` when
 * an attacker simply deleted the field.
 *
 * Returns false if `payload_hash` is missing/wrong type, mismatches, or the
 * signature doesn't verify. Returns true only if all three check out.
 */
export function verifyAttestationArtifact(
	artifact: Record<string, unknown>,
	signature: string,
	key: Buffer,
): boolean {
	const storedHash = artifact.payload_hash;
	if (typeof storedHash !== "string") return false;
	const payload = buildAttestationPayload(artifact);
	const expectedHash = hashAttestationPayload(payload);
	if (storedHash !== expectedHash) return false;
	return verifyAttestation(payload, signature, key);
}
