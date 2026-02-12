import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
	chmodSync,
	statSync,
} from "node:fs";
import { dirname } from "node:path";

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
