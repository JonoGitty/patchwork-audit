import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadRelayConfig, DEFAULT_RELAY_CONFIG } from "../../src/relay/config.js";

describe("Relay Config", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-config-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("returns defaults when config file is missing", () => {
		const { config, source } = loadRelayConfig(join(tmpDir, "nonexistent.json"));
		expect(source).toBe("default");
		expect(config).toEqual(DEFAULT_RELAY_CONFIG);
	});

	it("loads a valid config file", () => {
		const configPath = join(tmpDir, "relay-config.json");
		writeFileSync(configPath, JSON.stringify({
			auto_seal: {
				enabled: true,
				interval_minutes: 30,
				min_events_between_seals: 10,
			},
			witness: {
				enabled: true,
				endpoints: [{ url: "https://example.com/witness", name: "test" }],
				quorum: 1,
			},
		}));

		const { config, source } = loadRelayConfig(configPath);
		expect(source).toBe(configPath);
		expect(config.auto_seal.interval_minutes).toBe(30);
		expect(config.auto_seal.min_events_between_seals).toBe(10);
		expect(config.witness.enabled).toBe(true);
		expect(config.witness.endpoints).toHaveLength(1);
		expect(config.witness.endpoints[0].name).toBe("test");
	});

	it("merges partial config with defaults", () => {
		const configPath = join(tmpDir, "relay-config.json");
		writeFileSync(configPath, JSON.stringify({
			auto_seal: { interval_minutes: 5 },
		}));

		const { config } = loadRelayConfig(configPath);
		expect(config.auto_seal.interval_minutes).toBe(5);
		expect(config.auto_seal.enabled).toBe(true); // default
		expect(config.auto_seal.min_events_between_seals).toBe(1); // default
		expect(config.witness.enabled).toBe(false); // default
	});

	it("clamps invalid ranges", () => {
		const configPath = join(tmpDir, "relay-config.json");
		writeFileSync(configPath, JSON.stringify({
			auto_seal: { interval_minutes: -5, min_events_between_seals: -1 },
			witness: { quorum: 0 },
		}));

		const { config } = loadRelayConfig(configPath);
		expect(config.auto_seal.interval_minutes).toBe(1);
		expect(config.auto_seal.min_events_between_seals).toBe(0);
		expect(config.witness.quorum).toBe(1);
	});

	it("returns defaults for invalid JSON", () => {
		const configPath = join(tmpDir, "relay-config.json");
		writeFileSync(configPath, "not json!!!");

		const { config, source } = loadRelayConfig(configPath);
		expect(source).toContain("parse error");
		expect(config).toEqual(DEFAULT_RELAY_CONFIG);
	});

	it("filters invalid witness endpoints", () => {
		const configPath = join(tmpDir, "relay-config.json");
		writeFileSync(configPath, JSON.stringify({
			witness: {
				enabled: true,
				endpoints: [
					{ url: "https://valid.com", name: "good" },
					{ url: 123, name: "bad-url" },
					{ name: "missing-url" },
					"not-an-object",
				],
			},
		}));

		const { config } = loadRelayConfig(configPath);
		expect(config.witness.endpoints).toHaveLength(1);
		expect(config.witness.endpoints[0].name).toBe("good");
	});
});
