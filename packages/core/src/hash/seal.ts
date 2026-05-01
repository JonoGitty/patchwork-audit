import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
	chmodSync,
	statSync,
} from "node:fs";
import { dirname, join } from "node:path";

/** Secure directory mode: owner-only read/write/execute */
const DIR_MODE = 0o700;
/** Secure file mode: owner-only read/write */
const KEY_MODE = 0o600;
/** 256-bit key */
const KEY_BYTES = 32;

/** A single HMAC seal record anchoring a chain tip. */
export interface SealRecord {
	sealed_at: string;
	tip_hash: string;
	chained_events: number;
	signature: string;
	/** Key ID that produced the signature. Absent for legacy single-key seals. */
	key_id?: string;
}

/** Match `sha256:<64-hex>` (rejects ambiguous payloads with embedded colons). */
const TIP_HASH_RE = /^sha256:[0-9a-f]{64}$/;
/** Match RFC 3339 / ISO 8601 timestamps as JS produces with toISOString(). */
const SEALED_AT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
/** Match a keyring key id derived by deriveSealKeyId() — first 16 hex chars. */
const KEY_ID_RE = /^[0-9a-f]{16,64}$/;

/**
 * Compute the deterministic seal payload from chain state.
 * This is the exact string that gets HMAC-signed.
 *
 * Inputs are validated so the colon-delimited format remains unambiguous —
 * a payload like `sha256:abc:7:x` cannot be passed as `tipHash` and collide
 * with `(tipHash="sha256:abc", sealedAt="x")`. Keep this contract: any change
 * to the format must bump the version tag.
 */
export function computeSealPayload(
	tipHash: string,
	chainedEvents: number,
	sealedAt: string,
): string {
	if (!TIP_HASH_RE.test(tipHash)) {
		throw new Error(`computeSealPayload: tipHash must match ${TIP_HASH_RE} (got ${JSON.stringify(tipHash)})`);
	}
	if (!Number.isInteger(chainedEvents) || chainedEvents < 0) {
		throw new Error(`computeSealPayload: chainedEvents must be a non-negative integer (got ${chainedEvents})`);
	}
	if (!SEALED_AT_RE.test(sealedAt)) {
		throw new Error(`computeSealPayload: sealedAt must be RFC 3339 (got ${JSON.stringify(sealedAt)})`);
	}
	return `patchwork-seal:v1:${tipHash}:${chainedEvents}:${sealedAt}`;
}

/**
 * Sign a seal payload with HMAC-SHA256.
 * Returns `hmac-sha256:<hex>`.
 */
export function signSeal(payload: string, key: Buffer): string {
	const hmac = createHmac("sha256", key);
	hmac.update(payload);
	return `hmac-sha256:${hmac.digest("hex")}`;
}

/**
 * Verify an HMAC-SHA256 seal signature using constant-time comparison.
 */
export function verifySeal(
	payload: string,
	signature: string,
	key: Buffer,
): boolean {
	const expected = signSeal(payload, key);
	if (expected.length !== signature.length) return false;
	return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * Ensure a seal key exists at the given path. Creates if missing.
 * Enforces dir 0700, file 0600 permissions.
 * Returns the key bytes.
 */
export function ensureSealKey(keyPath: string): Buffer {
	const dir = dirname(keyPath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true, mode: DIR_MODE });
	} else {
		reconcileMode(dir, DIR_MODE);
	}

	if (!existsSync(keyPath)) {
		const key = randomBytes(KEY_BYTES);
		writeFileSync(keyPath, key, { mode: KEY_MODE });
		return key;
	}

	reconcileMode(keyPath, KEY_MODE);
	return readFileSync(keyPath);
}

/**
 * Read an existing seal key. Throws if not found.
 * Reconciles file permissions on read.
 */
export function readSealKey(keyPath: string): Buffer {
	if (!existsSync(keyPath)) {
		throw new Error(`Seal key not found at ${keyPath}`);
	}
	reconcileMode(keyPath, KEY_MODE);
	return readFileSync(keyPath);
}

// ---------------------------------------------------------------------------
// Keyring — versioned key management with key IDs
// ---------------------------------------------------------------------------

/**
 * Derive a stable short identifier from a key's content.
 * Returns the first 16 hex characters of SHA-256(key).
 */
export function deriveSealKeyId(key: Buffer): string {
	return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

/**
 * Ensure a keyring exists at keyringDir with an active key.
 * Creates the directory, generates a key, and writes the ACTIVE pointer
 * if none exists. Returns the active key ID and key bytes.
 * Enforces dir 0700, file 0600 permissions.
 */
export function ensureKeyring(keyringDir: string): { keyId: string; key: Buffer } {
	if (!existsSync(keyringDir)) {
		mkdirSync(keyringDir, { recursive: true, mode: DIR_MODE });
	} else {
		reconcileMode(keyringDir, DIR_MODE);
	}

	const activePath = join(keyringDir, "ACTIVE");
	if (existsSync(activePath)) {
		reconcileMode(activePath, KEY_MODE);
		const keyId = readFileSync(activePath, "utf-8").trim();
		// Reject anything that doesn't look like one of our derived hex IDs
		// before joining it into a path — defence in depth in case the keyring
		// directory permissions are loosened or the file is restored from a
		// hostile backup.
		if (!KEY_ID_RE.test(keyId)) {
			throw new Error(`Active key id in ${activePath} is malformed: ${JSON.stringify(keyId)}`);
		}
		const keyPath = join(keyringDir, `${keyId}.key`);
		if (!existsSync(keyPath)) {
			throw new Error(`Active key ${keyId} not found in keyring at ${keyPath}`);
		}
		reconcileMode(keyPath, KEY_MODE);
		return { keyId, key: readFileSync(keyPath) };
	}

	return generateAndActivateKey(keyringDir);
}

/**
 * Load a key by its ID from the keyring directory.
 * Throws if the key file does not exist.
 * Reconciles file permissions on read.
 *
 * The keyId is validated as hex before being joined into the path so a
 * malicious seal/attestation cannot escape the keyring with a value like
 * `../../tmp/known` and force verification against an attacker-controlled
 * key.
 */
export function loadKeyById(keyringDir: string, keyId: string): Buffer {
	if (!KEY_ID_RE.test(keyId)) {
		throw new Error(`loadKeyById: keyId must match ${KEY_ID_RE} (got ${JSON.stringify(keyId)})`);
	}
	const keyPath = join(keyringDir, `${keyId}.key`);
	if (!existsSync(keyPath)) {
		throw new Error(`Key ${keyId} not found in keyring at ${keyPath}`);
	}
	reconcileMode(keyPath, KEY_MODE);
	return readFileSync(keyPath);
}

/**
 * Generate a new seal key in the keyring and set it as active.
 * The previous active key remains in the keyring for verification
 * of older seals. Returns the new key ID and key bytes.
 */
export function rotateKey(keyringDir: string): { keyId: string; key: Buffer } {
	if (!existsSync(keyringDir)) {
		mkdirSync(keyringDir, { recursive: true, mode: DIR_MODE });
	} else {
		reconcileMode(keyringDir, DIR_MODE);
	}
	return generateAndActivateKey(keyringDir);
}

/** Generate a random key, write it to the keyring, and update the ACTIVE pointer. */
function generateAndActivateKey(keyringDir: string): { keyId: string; key: Buffer } {
	const key = randomBytes(KEY_BYTES);
	const keyId = deriveSealKeyId(key);
	const keyPath = join(keyringDir, `${keyId}.key`);
	writeFileSync(keyPath, key, { mode: KEY_MODE });
	const activePath = join(keyringDir, "ACTIVE");
	writeFileSync(activePath, keyId + "\n", { mode: KEY_MODE });
	return { keyId, key };
}

/** Chmod path to target mode if current mode doesn't match. */
function reconcileMode(path: string, targetMode: number): void {
	try {
		const stat = statSync(path);
		if ((stat.mode & 0o777) !== targetMode) {
			chmodSync(path, targetMode);
		}
	} catch {
		// Path disappeared between check and chmod — safe to ignore
	}
}
