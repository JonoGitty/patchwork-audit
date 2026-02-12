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

/**
 * Compute the deterministic seal payload from chain state.
 * This is the exact string that gets HMAC-signed.
 */
export function computeSealPayload(
	tipHash: string,
	chainedEvents: number,
	sealedAt: string,
): string {
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
 */
export function loadKeyById(keyringDir: string, keyId: string): Buffer {
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
