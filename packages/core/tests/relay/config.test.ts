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

	describe("socket_group", () => {
		it("is undefined when not set in config", () => {
			const configPath = join(tmpDir, "no-group.json");
			writeFileSync(
				configPath,
				JSON.stringify({
					auto_seal: { enabled: true, interval_minutes: 15, min_events_between_seals: 1 },
					witness: { enabled: false, endpoints: [], quorum: 1 },
				}),
			);
			const { config } = loadRelayConfig(configPath);
			expect(config.socket_group).toBeUndefined();
		});

		it("is loaded when set to a valid POSIX group name", () => {
			const configPath = join(tmpDir, "group.json");
			writeFileSync(
				configPath,
				JSON.stringify({
					auto_seal: { enabled: true, interval_minutes: 15, min_events_between_seals: 1 },
					witness: { enabled: false, endpoints: [], quorum: 1 },
					socket_group: "staff",
				}),
			);
			const { config } = loadRelayConfig(configPath);
			expect(config.socket_group).toBe("staff");
		});

		it("accepts hyphens, underscores, and digits", () => {
			for (const name of ["staff", "_root", "users", "patchwork-users", "g123"]) {
				const configPath = join(tmpDir, `g-${name}.json`);
				writeFileSync(
					configPath,
					JSON.stringify({
						auto_seal: { enabled: true, interval_minutes: 15, min_events_between_seals: 1 },
						witness: { enabled: false, endpoints: [], quorum: 1 },
						socket_group: name,
					}),
				);
				const { config } = loadRelayConfig(configPath);
				expect(config.socket_group).toBe(name);
			}
		});

		it("rejects shell metacharacters (command injection guard)", () => {
			// Even though the daemon uses spawnSync with array argv (no shell),
			// the regex is a belt-and-braces filter so a hostile config can't
			// land bytes that look like a command.
			for (const evil of [
				"; rm -rf /",
				"$(whoami)",
				"`id`",
				"staff; chmod 777 /etc",
				"../../etc/passwd",
				"staff space",
			]) {
				const configPath = join(tmpDir, "evil.json");
				writeFileSync(
					configPath,
					JSON.stringify({
						auto_seal: { enabled: true, interval_minutes: 15, min_events_between_seals: 1 },
						witness: { enabled: false, endpoints: [], quorum: 1 },
						socket_group: evil,
					}),
				);
				const { config } = loadRelayConfig(configPath);
				expect(config.socket_group).toBeUndefined();
			}
		});

		it("rejects groups that don't start with a letter or underscore", () => {
			const configPath = join(tmpDir, "leading.json");
			writeFileSync(
				configPath,
				JSON.stringify({
					auto_seal: { enabled: true, interval_minutes: 15, min_events_between_seals: 1 },
					witness: { enabled: false, endpoints: [], quorum: 1 },
					socket_group: "1bad",
				}),
			);
			const { config } = loadRelayConfig(configPath);
			expect(config.socket_group).toBeUndefined();
		});

		it("rejects non-string values", () => {
			const configPath = join(tmpDir, "non-string.json");
			writeFileSync(
				configPath,
				JSON.stringify({
					auto_seal: { enabled: true, interval_minutes: 15, min_events_between_seals: 1 },
					witness: { enabled: false, endpoints: [], quorum: 1 },
					socket_group: 12345,
				}),
			);
			const { config } = loadRelayConfig(configPath);
			expect(config.socket_group).toBeUndefined();
		});

		it("rejects names longer than 32 chars", () => {
			const configPath = join(tmpDir, "long.json");
			writeFileSync(
				configPath,
				JSON.stringify({
					auto_seal: { enabled: true, interval_minutes: 15, min_events_between_seals: 1 },
					witness: { enabled: false, endpoints: [], quorum: 1 },
					socket_group: "a".repeat(33),
				}),
			);
			const { config } = loadRelayConfig(configPath);
			expect(config.socket_group).toBeUndefined();
		});
	});
});
