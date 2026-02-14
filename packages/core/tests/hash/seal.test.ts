import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
	mkdtempSync,
	rmSync,
	existsSync,
	readFileSync,
	statSync,
	writeFileSync,
	mkdirSync,
	chmodSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import {
	computeSealPayload,
	signSeal,
	verifySeal,
	ensureSealKey,
	readSealKey,
	deriveSealKeyId,
	ensureKeyring,
	loadKeyById,
	rotateKey,
} from "../../src/hash/seal.js";

// Windows does not enforce POSIX file permissions (chmod 0o600/0o700 is a no-op)
const isWindows = process.platform === "win32";

describe("computeSealPayload", () => {
	it("returns a deterministic versioned string", () => {
		const payload = computeSealPayload("sha256:abc", 42, "2026-01-01T00:00:00.000Z");
		expect(payload).toBe("patchwork-seal:v1:sha256:abc:42:2026-01-01T00:00:00.000Z");
	});

	it("is deterministic across calls", () => {
		const a = computeSealPayload("sha256:tip", 10, "2026-06-01T12:00:00.000Z");
		const b = computeSealPayload("sha256:tip", 10, "2026-06-01T12:00:00.000Z");
		expect(a).toBe(b);
	});

	it("changes when any input changes", () => {
		const base = computeSealPayload("sha256:tip", 10, "2026-01-01T00:00:00.000Z");
		expect(computeSealPayload("sha256:other", 10, "2026-01-01T00:00:00.000Z")).not.toBe(base);
		expect(computeSealPayload("sha256:tip", 11, "2026-01-01T00:00:00.000Z")).not.toBe(base);
		expect(computeSealPayload("sha256:tip", 10, "2026-01-01T00:00:01.000Z")).not.toBe(base);
	});
});

describe("signSeal / verifySeal", () => {
	const key = randomBytes(32);
	const payload = "patchwork-seal:v1:sha256:abc:5:2026-01-01T00:00:00.000Z";

	it("produces hmac-sha256-prefixed signature", () => {
		const sig = signSeal(payload, key);
		expect(sig).toMatch(/^hmac-sha256:[a-f0-9]{64}$/);
	});

	it("is deterministic for the same key and payload", () => {
		const sig1 = signSeal(payload, key);
		const sig2 = signSeal(payload, key);
		expect(sig1).toBe(sig2);
	});

	it("verifies a correct signature", () => {
		const sig = signSeal(payload, key);
		expect(verifySeal(payload, sig, key)).toBe(true);
	});

	it("rejects wrong key", () => {
		const sig = signSeal(payload, key);
		const wrongKey = randomBytes(32);
		expect(verifySeal(payload, sig, wrongKey)).toBe(false);
	});

	it("rejects tampered payload", () => {
		const sig = signSeal(payload, key);
		expect(verifySeal(payload + "x", sig, key)).toBe(false);
	});

	it("rejects tampered signature", () => {
		const sig = signSeal(payload, key);
		const tampered = sig.slice(0, -2) + "ff";
		expect(verifySeal(payload, tampered, key)).toBe(false);
	});

	it("rejects completely different signature format", () => {
		expect(verifySeal(payload, "bad-signature", key)).toBe(false);
	});
});

describe("ensureSealKey", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-seal-key-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it.skipIf(isWindows)("creates key dir with 0700 and key file with 0600", () => {
		const keyPath = join(tmpDir, "keys", "seal.key");
		ensureSealKey(keyPath);

		const dirStat = statSync(join(tmpDir, "keys"));
		expect(dirStat.mode & 0o777).toBe(0o700);

		const fileStat = statSync(keyPath);
		expect(fileStat.mode & 0o777).toBe(0o600);
	});

	it("creates a 32-byte key", () => {
		const keyPath = join(tmpDir, "keys", "seal.key");
		const key = ensureSealKey(keyPath);
		expect(key.length).toBe(32);
	});

	it("returns the same key on repeated calls", () => {
		const keyPath = join(tmpDir, "keys", "seal.key");
		const key1 = ensureSealKey(keyPath);
		const key2 = ensureSealKey(keyPath);
		expect(key1.equals(key2)).toBe(true);
	});

	it.skipIf(isWindows)("reconciles insecure existing dir permissions", () => {
		const keyDir = join(tmpDir, "keys");
		mkdirSync(keyDir, { recursive: true, mode: 0o755 });
		const keyPath = join(keyDir, "seal.key");

		ensureSealKey(keyPath);

		const dirStat = statSync(keyDir);
		expect(dirStat.mode & 0o777).toBe(0o700);
	});

	it.skipIf(isWindows)("reconciles insecure existing file permissions", () => {
		const keyDir = join(tmpDir, "keys");
		mkdirSync(keyDir, { recursive: true, mode: 0o700 });
		const keyPath = join(keyDir, "seal.key");
		writeFileSync(keyPath, randomBytes(32), { mode: 0o644 });

		ensureSealKey(keyPath);

		const fileStat = statSync(keyPath);
		expect(fileStat.mode & 0o777).toBe(0o600);
	});
});

describe("readSealKey", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-read-key-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("reads an existing key", () => {
		const keyDir = join(tmpDir, "keys");
		mkdirSync(keyDir, { mode: 0o700 });
		const keyPath = join(keyDir, "seal.key");
		const keyData = randomBytes(32);
		writeFileSync(keyPath, keyData, { mode: 0o600 });

		const read = readSealKey(keyPath);
		expect(read.equals(keyData)).toBe(true);
	});

	it("throws when key does not exist", () => {
		const keyPath = join(tmpDir, "nonexistent", "seal.key");
		expect(() => readSealKey(keyPath)).toThrow("Seal key not found");
	});

	it.skipIf(isWindows)("reconciles insecure file permissions on read", () => {
		const keyDir = join(tmpDir, "keys");
		mkdirSync(keyDir, { mode: 0o700 });
		const keyPath = join(keyDir, "seal.key");
		writeFileSync(keyPath, randomBytes(32), { mode: 0o644 });

		readSealKey(keyPath);

		const fileStat = statSync(keyPath);
		expect(fileStat.mode & 0o777).toBe(0o600);
	});
});

describe("deriveSealKeyId", () => {
	it("returns a 16-char hex string", () => {
		const key = randomBytes(32);
		const id = deriveSealKeyId(key);
		expect(id).toMatch(/^[a-f0-9]{16}$/);
	});

	it("is deterministic for the same key", () => {
		const key = randomBytes(32);
		expect(deriveSealKeyId(key)).toBe(deriveSealKeyId(key));
	});

	it("differs for different keys", () => {
		const a = deriveSealKeyId(randomBytes(32));
		const b = deriveSealKeyId(randomBytes(32));
		expect(a).not.toBe(b);
	});
});

describe("ensureKeyring", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-keyring-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it.skipIf(isWindows)("creates keyring dir with 0700, key file with 0600, and ACTIVE pointer", () => {
		const keyringDir = join(tmpDir, "seal");
		const { keyId, key } = ensureKeyring(keyringDir);

		expect(statSync(keyringDir).mode & 0o777).toBe(0o700);
		expect(statSync(join(keyringDir, `${keyId}.key`)).mode & 0o777).toBe(0o600);
		expect(statSync(join(keyringDir, "ACTIVE")).mode & 0o777).toBe(0o600);
		expect(key.length).toBe(32);
		expect(keyId).toMatch(/^[a-f0-9]{16}$/);
	});

	it("returns the same key on repeated calls", () => {
		const keyringDir = join(tmpDir, "seal");
		const first = ensureKeyring(keyringDir);
		const second = ensureKeyring(keyringDir);

		expect(second.keyId).toBe(first.keyId);
		expect(second.key.equals(first.key)).toBe(true);
	});

	it("ACTIVE pointer contains the key ID", () => {
		const keyringDir = join(tmpDir, "seal");
		const { keyId } = ensureKeyring(keyringDir);

		const active = readFileSync(join(keyringDir, "ACTIVE"), "utf-8").trim();
		expect(active).toBe(keyId);
	});

	it("key ID matches deriveSealKeyId of the generated key", () => {
		const keyringDir = join(tmpDir, "seal");
		const { keyId, key } = ensureKeyring(keyringDir);
		expect(keyId).toBe(deriveSealKeyId(key));
	});

	it("throws when ACTIVE points to a missing key file", () => {
		const keyringDir = join(tmpDir, "seal");
		mkdirSync(keyringDir, { recursive: true, mode: 0o700 });
		writeFileSync(join(keyringDir, "ACTIVE"), "nonexistent_id\n", { mode: 0o600 });

		expect(() => ensureKeyring(keyringDir)).toThrow("not found in keyring");
	});

	it.skipIf(isWindows)("reconciles insecure keyring dir permissions", () => {
		const keyringDir = join(tmpDir, "seal");
		mkdirSync(keyringDir, { recursive: true, mode: 0o755 });

		ensureKeyring(keyringDir);

		expect(statSync(keyringDir).mode & 0o777).toBe(0o700);
	});
});

describe("loadKeyById", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-loadkey-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("loads a key by its ID", () => {
		const keyringDir = join(tmpDir, "seal");
		const { keyId, key } = ensureKeyring(keyringDir);

		const loaded = loadKeyById(keyringDir, keyId);
		expect(loaded.equals(key)).toBe(true);
	});

	it("throws when key ID does not exist", () => {
		const keyringDir = join(tmpDir, "seal");
		mkdirSync(keyringDir, { recursive: true, mode: 0o700 });

		expect(() => loadKeyById(keyringDir, "nonexistent123")).toThrow("not found in keyring");
	});

	it.skipIf(isWindows)("reconciles insecure key file permissions", () => {
		const keyringDir = join(tmpDir, "seal");
		const { keyId } = ensureKeyring(keyringDir);

		chmodSync(join(keyringDir, `${keyId}.key`), 0o644);
		loadKeyById(keyringDir, keyId);

		expect(statSync(join(keyringDir, `${keyId}.key`)).mode & 0o777).toBe(0o600);
	});
});

describe("rotateKey", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-rotate-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("generates a new key different from the original", () => {
		const keyringDir = join(tmpDir, "seal");
		const original = ensureKeyring(keyringDir);
		const rotated = rotateKey(keyringDir);

		expect(rotated.keyId).not.toBe(original.keyId);
		expect(rotated.key.equals(original.key)).toBe(false);
	});

	it("updates ACTIVE pointer to new key", () => {
		const keyringDir = join(tmpDir, "seal");
		ensureKeyring(keyringDir);
		const { keyId } = rotateKey(keyringDir);

		const active = readFileSync(join(keyringDir, "ACTIVE"), "utf-8").trim();
		expect(active).toBe(keyId);
	});

	it("preserves the old key file for verification of older seals", () => {
		const keyringDir = join(tmpDir, "seal");
		const original = ensureKeyring(keyringDir);
		rotateKey(keyringDir);

		// Old key still exists and is loadable
		const oldKey = loadKeyById(keyringDir, original.keyId);
		expect(oldKey.equals(original.key)).toBe(true);
	});

	it("ensureKeyring returns the rotated key after rotation", () => {
		const keyringDir = join(tmpDir, "seal");
		ensureKeyring(keyringDir);
		const rotated = rotateKey(keyringDir);

		const current = ensureKeyring(keyringDir);
		expect(current.keyId).toBe(rotated.keyId);
		expect(current.key.equals(rotated.key)).toBe(true);
	});

	it.skipIf(isWindows)("creates keyring dir if it does not exist", () => {
		const keyringDir = join(tmpDir, "new-seal");
		const { keyId } = rotateKey(keyringDir);

		expect(existsSync(join(keyringDir, `${keyId}.key`))).toBe(true);
		expect(statSync(keyringDir).mode & 0o777).toBe(0o700);
	});
});
