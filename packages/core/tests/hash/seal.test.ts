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
} from "../../src/hash/seal.js";

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

	it("creates key dir with 0700 and key file with 0600", () => {
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

	it("reconciles insecure existing dir permissions", () => {
		const keyDir = join(tmpDir, "keys");
		mkdirSync(keyDir, { recursive: true, mode: 0o755 });
		const keyPath = join(keyDir, "seal.key");

		ensureSealKey(keyPath);

		const dirStat = statSync(keyDir);
		expect(dirStat.mode & 0o777).toBe(0o700);
	});

	it("reconciles insecure existing file permissions", () => {
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

	it("reconciles insecure file permissions on read", () => {
		const keyDir = join(tmpDir, "keys");
		mkdirSync(keyDir, { mode: 0o700 });
		const keyPath = join(keyDir, "seal.key");
		writeFileSync(keyPath, randomBytes(32), { mode: 0o644 });

		readSealKey(keyPath);

		const fileStat = statSync(keyPath);
		expect(fileStat.mode & 0o777).toBe(0o600);
	});
});
