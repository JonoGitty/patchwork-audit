import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RelayDaemon } from "../../src/relay/daemon.js";
import { requestSignature } from "../../src/relay/signing-proxy.js";

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
