import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RelayDaemon } from "../../src/relay/daemon.js";
import { requestSignature, requestVerification } from "../../src/relay/signing-proxy.js";
import { ensureKeyring } from "../../src/hash/seal.js";

describe("Signing Proxy", () => {
	let tmpDir: string;
	let daemon: RelayDaemon;
	let socketPath: string;
	let keyringPath: string;

	beforeEach(async () => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-sign-test-"));
		socketPath = join(tmpDir, "relay.sock");
		keyringPath = join(tmpDir, "keys", "seal");

		daemon = new RelayDaemon({
			socketPath,
			logPath: join(tmpDir, "events.relay.jsonl"),
			daemonLogPath: join(tmpDir, "relay.log"),
			pidPath: join(tmpDir, "relay.pid"),
			heartbeatIntervalMs: 60_000,
			keyringPath,
		});
		await daemon.start();
	});

	afterEach(async () => {
		await daemon.stop();
		rmSync(tmpDir, { recursive: true, force: true });
	});

	// Minimal commit-attestation JSON shape that the relay now requires —
	// arbitrary text and seal-shaped payloads are refused by classifySignablePayload.
	const ATTEST_A = JSON.stringify({ type: "commit-attestation", schema_version: 1, n: 1 });
	const ATTEST_B = JSON.stringify({ type: "commit-attestation", schema_version: 1, n: 2 });

	it("signs data via relay daemon", async () => {
		const result = await requestSignature(ATTEST_A, {
			socketPath,
			localKeyringPath: join(tmpDir, "local-keys", "seal"),
		});

		expect(result.signature).toMatch(/^hmac-sha256:/);
		expect(result.key_id).toBeDefined();
		expect(result.signed_at).toBeDefined();
		expect(result.source).toBe("relay");
	});

	it("returns consistent signatures for same data", async () => {
		const r1 = await requestSignature(ATTEST_A, { socketPath });
		const r2 = await requestSignature(ATTEST_A, { socketPath });

		expect(r1.signature).toBe(r2.signature);
		expect(r1.key_id).toBe(r2.key_id);
	});

	it("falls back to local keyring when relay is unavailable", async () => {
		const localKeyring = join(tmpDir, "local-keys", "seal");
		// Local keyring fallback signs anything (no shape gate); relay refuses
		// the same payload, so we know we hit the local path.
		const result = await requestSignature("test-data", {
			socketPath: "/tmp/nonexistent-relay.sock",
			localKeyringPath: localKeyring,
		});

		expect(result.signature).toMatch(/^hmac-sha256:/);
		expect(result.source).toBe("local");
	});

	it("different data produces different signatures", async () => {
		const r1 = await requestSignature(ATTEST_A, { socketPath });
		const r2 = await requestSignature(ATTEST_B, { socketPath });

		expect(r1.signature).not.toBe(r2.signature);
	});

	it("relay refuses to sign seal-shaped payloads (sign-oracle defence)", async () => {
		// Seals are produced inside the daemon's auto-seal loop only — never on
		// behalf of clients. If the relay accepted seal-shaped bytes, any
		// authorised socket user could mint a forged seal signature over an
		// arbitrary tip-hash + event-count + timestamp.
		const localKeyring = join(tmpDir, "local-keys", "seal");
		const result = await requestSignature(
			"patchwork-seal:v1:sha256:" + "a".repeat(64) + ":10:2026-04-02T00:00:00.000Z",
			{ socketPath, localKeyringPath: localKeyring },
		);
		// With relay refusing, the proxy falls back to the local keyring.
		expect(result.source).toBe("local");
	});

	it("relay refuses to sign arbitrary text (sign-oracle defence)", async () => {
		const localKeyring = join(tmpDir, "local-keys", "seal");
		const result = await requestSignature("just some bytes", {
			socketPath, localKeyringPath: localKeyring,
		});
		expect(result.source).toBe("local");
	});

	it("relay rejects malformed JSON commit-attestations (no type/wrong schema)", async () => {
		const localKeyring = join(tmpDir, "local-keys", "seal");
		// Wrong type
		const r1 = await requestSignature(JSON.stringify({ type: "session", schema_version: 1 }), {
			socketPath, localKeyringPath: localKeyring,
		});
		expect(r1.source).toBe("local");
		// Wrong schema_version
		const r2 = await requestSignature(JSON.stringify({ type: "commit-attestation", schema_version: 99 }), {
			socketPath, localKeyringPath: localKeyring,
		});
		expect(r2.source).toBe("local");
	});

	it("requireRelay throws when relay refuses the payload (no silent downgrade)", async () => {
		const localKeyring = join(tmpDir, "local-keys", "seal");
		await expect(
			requestSignature("not a valid payload", {
				socketPath, localKeyringPath: localKeyring, requireRelay: true,
			}),
		).rejects.toThrow(/relay-required signing failed/);
	});
});

describe("requestVerification", () => {
	let tmpDir: string;
	let daemon: RelayDaemon;
	let socketPath: string;
	let keyringPath: string;
	let localKeyringPath: string;

	beforeEach(async () => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-verify-test-"));
		socketPath = join(tmpDir, "relay.sock");
		keyringPath = join(tmpDir, "root-keys", "seal");
		localKeyringPath = join(tmpDir, "local-keys", "seal");

		daemon = new RelayDaemon({
			socketPath,
			logPath: join(tmpDir, "events.relay.jsonl"),
			daemonLogPath: join(tmpDir, "relay.log"),
			pidPath: join(tmpDir, "relay.pid"),
			heartbeatIntervalMs: 60_000,
			keyringPath,
		});
		await daemon.start();
	});

	afterEach(async () => {
		await daemon.stop();
		rmSync(tmpDir, { recursive: true, force: true });
	});

	const ATTEST = JSON.stringify({ type: "commit-attestation", schema_version: 1, tag: "v" });
	const ATTEST_OTHER = JSON.stringify({ type: "commit-attestation", schema_version: 1, tag: "w" });

	it("verifies a relay-signed signature via the daemon", async () => {
		const signed = await requestSignature(ATTEST, { socketPath, localKeyringPath });
		expect(signed.source).toBe("relay");

		const result = await requestVerification(ATTEST, signed.signature, signed.key_id, {
			socketPath,
			localKeyringPath,
		});

		expect(result.verified).toBe(true);
		expect(result.source).toBe("relay");
	});

	it("verifies a locally-signed signature via the local keyring", async () => {
		// Sign locally (force relay unavailable by pointing at a nonexistent socket)
		const signed = await requestSignature(ATTEST_OTHER, {
			socketPath: "/tmp/nonexistent-sign-sock-xyz.sock",
			localKeyringPath,
		});
		expect(signed.source).toBe("local");

		const result = await requestVerification(ATTEST_OTHER, signed.signature, signed.key_id, {
			socketPath,
			localKeyringPath,
		});

		expect(result.verified).toBe(true);
		expect(result.source).toBe("local");
	});

	it("returns signature_mismatch when data has been tampered", async () => {
		const signed = await requestSignature(ATTEST, { socketPath, localKeyringPath });

		const result = await requestVerification("tampered-data", signed.signature, signed.key_id, {
			socketPath,
			localKeyringPath,
		});

		expect(result.verified).toBe(false);
		expect(result.reason).toBe("signature_mismatch");
	});

	it("returns unknown_key when relay has no such key", async () => {
		const result = await requestVerification(
			"some-data",
			"hmac-sha256:deadbeef",
			"f5808a8952596785", // nonexistent key id
			{ socketPath, localKeyringPath },
		);

		expect(result.verified).toBe(false);
		expect(result.reason).toBe("unknown_key");
		expect(result.source).toBe("relay");
	});

	it("returns no_key_available when neither relay nor local has the key", async () => {
		const result = await requestVerification(
			"some-data",
			"hmac-sha256:deadbeef",
			"f5808a8952596785",
			{
				socketPath: "/tmp/nonexistent-verify-sock.sock",
				localKeyringPath,
			},
		);

		expect(result.verified).toBe(false);
		expect(result.reason).toBe("no_key_available");
	});

	it("falls through to relay when local keyring lacks the key", async () => {
		// Create a local keyring with a different key so loadKeyById fails for the relay's key
		ensureKeyring(localKeyringPath);

		const data = JSON.stringify({ type: "commit-attestation", schema_version: 1, fall: "through" });
		const signed = await requestSignature(data, { socketPath, localKeyringPath });
		expect(signed.source).toBe("relay");

		const result = await requestVerification(data, signed.signature, signed.key_id, {
			socketPath,
			localKeyringPath,
		});

		expect(result.verified).toBe(true);
		expect(result.source).toBe("relay");
	});
});
