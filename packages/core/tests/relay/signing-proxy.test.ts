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

	it("signs data via relay daemon", async () => {
		const result = await requestSignature("patchwork-seal:v1:sha256:test:10:2026-04-02", {
			socketPath,
			localKeyringPath: join(tmpDir, "local-keys", "seal"),
		});

		expect(result.signature).toMatch(/^hmac-sha256:/);
		expect(result.key_id).toBeDefined();
		expect(result.signed_at).toBeDefined();
		expect(result.source).toBe("relay");
	});

	it("returns consistent signatures for same data", async () => {
		const data = "patchwork-seal:v1:sha256:abc:5:2026-04-02";
		const r1 = await requestSignature(data, { socketPath });
		const r2 = await requestSignature(data, { socketPath });

		expect(r1.signature).toBe(r2.signature);
		expect(r1.key_id).toBe(r2.key_id);
	});

	it("falls back to local keyring when relay is unavailable", async () => {
		const localKeyring = join(tmpDir, "local-keys", "seal");
		const result = await requestSignature("test-data", {
			socketPath: "/tmp/nonexistent-relay.sock",
			localKeyringPath: localKeyring,
		});

		expect(result.signature).toMatch(/^hmac-sha256:/);
		expect(result.source).toBe("local");
	});

	it("different data produces different signatures", async () => {
		const r1 = await requestSignature("data-one", { socketPath });
		const r2 = await requestSignature("data-two", { socketPath });

		expect(r1.signature).not.toBe(r2.signature);
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

	it("verifies a relay-signed signature via the daemon", async () => {
		const data = "patchwork-seal:v1:sha256:abc:5:2026-04-02";
		const signed = await requestSignature(data, { socketPath, localKeyringPath });
		expect(signed.source).toBe("relay");

		const result = await requestVerification(data, signed.signature, signed.key_id, {
			socketPath,
			localKeyringPath,
		});

		expect(result.verified).toBe(true);
		expect(result.source).toBe("relay");
	});

	it("verifies a locally-signed signature via the local keyring", async () => {
		// Sign locally (force relay unavailable by pointing at a nonexistent socket)
		const data = "patchwork-seal:v1:sha256:xyz:7:2026-04-02";
		const signed = await requestSignature(data, {
			socketPath: "/tmp/nonexistent-sign-sock-xyz.sock",
			localKeyringPath,
		});
		expect(signed.source).toBe("local");

		const result = await requestVerification(data, signed.signature, signed.key_id, {
			socketPath,
			localKeyringPath,
		});

		expect(result.verified).toBe(true);
		expect(result.source).toBe("local");
	});

	it("returns signature_mismatch when data has been tampered", async () => {
		const data = "patchwork-seal:v1:sha256:abc:5:2026-04-02";
		const signed = await requestSignature(data, { socketPath, localKeyringPath });

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

		const data = "patchwork-seal:v1:sha256:def:9:2026-04-02";
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
