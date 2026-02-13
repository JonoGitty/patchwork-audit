import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Build a deterministic canonical payload string from an attestation artifact
 * for HMAC signing. The signature and payload_hash fields are excluded from
 * the signed payload to avoid circular dependency.
 *
 * The canonical form uses sorted JSON keys at the top level to ensure
 * identical input always produces identical output.
 */
export function buildAttestationPayload(artifact: Record<string, unknown>): string {
	// Build ordered object excluding signature-related fields
	const keys = Object.keys(artifact)
		.filter((k) => k !== "signature" && k !== "payload_hash" && k !== "key_id")
		.sort();

	const ordered: Record<string, unknown> = {};
	for (const k of keys) {
		ordered[k] = artifact[k];
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
