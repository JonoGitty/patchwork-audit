/**
 * Patchwork Team Mode — Cryptographic utilities.
 *
 * Envelope signing, API key generation, batch hashing, machine identity.
 * Follows the HMAC pattern from @patchwork/core's seal.ts.
 */

import { createHmac, createHash, randomBytes } from "node:crypto";
import { canonicalize } from "@patchwork/core";
import { API_KEY_PREFIX } from "./constants.js";
import type { SyncEnvelope } from "./protocol.js";

// ---------------------------------------------------------------------------
// Envelope signing
// ---------------------------------------------------------------------------

/**
 * Sign a sync envelope with the machine's API key.
 * Sets signature and signed_at fields on the envelope (mutates and returns).
 */
export function signEnvelope(envelope: SyncEnvelope, apiKey: string): SyncEnvelope {
	const signed = { ...envelope, signature: "", signed_at: new Date().toISOString() };
	const payload = canonicalize(stripSignatureFields(signed));
	signed.signature = `hmac-sha256:${createHmac("sha256", apiKey).update(payload).digest("hex")}`;
	return signed;
}

/**
 * Verify an envelope's HMAC signature.
 */
export function verifyEnvelope(envelope: SyncEnvelope, apiKey: string): boolean {
	const sig = envelope.signature;
	if (!sig || !sig.startsWith("hmac-sha256:")) return false;

	const expected = canonicalize(stripSignatureFields(envelope));
	const computed = `hmac-sha256:${createHmac("sha256", apiKey).update(expected).digest("hex")}`;
	return sig === computed;
}

/** Strip signature field for signing/verification (keep signed_at). */
function stripSignatureFields(envelope: SyncEnvelope): Record<string, unknown> {
	const { signature: _, ...rest } = envelope;
	return rest as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Batch hashing
// ---------------------------------------------------------------------------

/**
 * Compute SHA-256 hash of a batch of events.
 * Uses canonical JSON for determinism.
 */
export function computeBatchHash(events: Record<string, unknown>[]): string {
	const payload = canonicalize(events);
	return `sha256:${createHash("sha256").update(payload).digest("hex")}`;
}

// ---------------------------------------------------------------------------
// API key management
// ---------------------------------------------------------------------------

/**
 * Generate a new API key with the pw_ prefix.
 * 256-bit random, base64url encoded.
 */
export function generateApiKey(): string {
	return `${API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
}

/**
 * Hash an API key for storage (never store plaintext).
 */
export function hashApiKey(key: string): string {
	return `sha256:${createHash("sha256").update(key).digest("hex")}`;
}

// ---------------------------------------------------------------------------
// Machine identity
// ---------------------------------------------------------------------------

/**
 * Derive a stable machine ID from hardware ID and team ID.
 * Prevents cross-team tracking of the same hardware.
 */
export function deriveMachineId(hardwareId: string, teamId: string): string {
	return createHash("sha256").update(`${hardwareId}:${teamId}`).digest("hex");
}
