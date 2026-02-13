import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, resolveVerifyDefaults, type PatchworkConfig } from "../src/config.js";

describe("loadConfig", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-config-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("M1: returns empty config when no config files exist", () => {
		const result = loadConfig(tmpDir);
		expect(result.config).toEqual({});
		expect(result.source).toBe("none");
	});

	it("M2: loads project-level .patchwork/config.yml", () => {
		const configDir = join(tmpDir, ".patchwork");
		mkdirSync(configDir, { recursive: true });
		writeFileSync(
			join(configDir, "config.yml"),
			"verify:\n  profile: strict\n  max_seal_age_seconds: 3600\n",
		);

		const result = loadConfig(tmpDir);
		expect(result.source).toBe(join(configDir, "config.yml"));
		expect(result.config.verify?.profile).toBe("strict");
		expect(result.config.verify?.max_seal_age_seconds).toBe(3600);
	});

	it("M3: project-level config takes precedence over user-level", () => {
		// Create project-level config
		const projectConfigDir = join(tmpDir, ".patchwork");
		mkdirSync(projectConfigDir, { recursive: true });
		writeFileSync(
			join(projectConfigDir, "config.yml"),
			"verify:\n  profile: strict\n",
		);

		// User-level would be at ~/.patchwork/config.yml — since we pass cwd
		// the project-level is found first and returned
		const result = loadConfig(tmpDir);
		expect(result.source).toBe(join(projectConfigDir, "config.yml"));
		expect(result.config.verify?.profile).toBe("strict");
	});

	it("M3b: gracefully handles invalid YAML", () => {
		const configDir = join(tmpDir, ".patchwork");
		mkdirSync(configDir, { recursive: true });
		writeFileSync(join(configDir, "config.yml"), ": : : invalid yaml [[[");

		const result = loadConfig(tmpDir);
		// Should return empty config, not throw
		expect(result.config).toEqual({});
		expect(result.source).toBe(join(configDir, "config.yml"));
	});

	it("M3c: gracefully handles non-object YAML", () => {
		const configDir = join(tmpDir, ".patchwork");
		mkdirSync(configDir, { recursive: true });
		writeFileSync(join(configDir, "config.yml"), "just a string\n");

		const result = loadConfig(tmpDir);
		expect(result.config).toEqual({});
	});
});

describe("resolveVerifyDefaults", () => {
	const emptyConfig: PatchworkConfig = {};

	it("M4: profile strict sets all enforcement flags true", () => {
		const result = resolveVerifyDefaults({
			profile: "strict",
			cliFlags: {},
			config: emptyConfig,
			configSource: "none",
		});
		expect(result.profileName).toBe("strict");
		expect(result.defaults.requireSeal).toBe(true);
		expect(result.defaults.requireWitness).toBe(true);
		expect(result.defaults.requireRemoteWitnessProof).toBe(true);
		expect(result.defaults.requireSignedAttestation).toBe(true);
		expect(result.defaults.requireAttestationBinding).toBe(true);
		expect(result.defaults.strictAttestationFile).toBe(true);
	});

	it("M5: profile baseline leaves all flags false", () => {
		const result = resolveVerifyDefaults({
			profile: "baseline",
			cliFlags: {},
			config: emptyConfig,
			configSource: "none",
		});
		expect(result.profileName).toBe("baseline");
		expect(result.defaults.requireSeal).toBe(false);
		expect(result.defaults.requireWitness).toBe(false);
		expect(result.defaults.requireRemoteWitnessProof).toBe(false);
		expect(result.defaults.requireSignedAttestation).toBe(false);
		expect(result.defaults.requireAttestationBinding).toBe(false);
		expect(result.defaults.strictAttestationFile).toBe(false);
	});

	it("M6: config file values apply when no CLI flags set", () => {
		const config: PatchworkConfig = {
			verify: {
				require_seal: true,
				max_seal_age_seconds: 7200,
				token_env: "MY_TOKEN",
			},
		};
		const result = resolveVerifyDefaults({
			cliFlags: {},
			config,
			configSource: "/some/config.yml",
		});
		expect(result.defaults.requireSeal).toBe(true);
		expect(result.defaults.maxSealAgeSeconds).toBe("7200");
		expect(result.defaults.tokenEnv).toBe("MY_TOKEN");
		expect(result.configSource).toBe("/some/config.yml");
	});

	it("M7: CLI flag overrides config value", () => {
		const config: PatchworkConfig = {
			verify: {
				require_seal: true,
				max_seal_age_seconds: 7200,
			},
		};
		const result = resolveVerifyDefaults({
			cliFlags: {
				sealCheck: false, // --no-seal-check disables profile/config require_seal
			},
			config,
			configSource: "/some/config.yml",
		});
		// --no-seal-check overrides config require_seal: true
		expect(result.defaults.requireSeal).toBe(false);
	});

	it("M7b: CLI age flag overrides config age value", () => {
		const config: PatchworkConfig = {
			verify: {
				max_seal_age_seconds: 7200,
			},
		};
		const result = resolveVerifyDefaults({
			cliFlags: {
				maxSealAgeSeconds: "1800",
			},
			config,
			configSource: "/some/config.yml",
		});
		expect(result.defaults.maxSealAgeSeconds).toBe("1800");
	});

	it("M8: CLI flag overrides profile default", () => {
		const result = resolveVerifyDefaults({
			profile: "strict",
			cliFlags: {
				sealCheck: false, // --no-seal-check
			},
			config: emptyConfig,
			configSource: "none",
		});
		// Profile strict sets requireSeal=true, but --no-seal-check overrides
		expect(result.defaults.requireSeal).toBe(false);
		// Other strict flags remain
		expect(result.defaults.requireWitness).toBe(true);
		expect(result.defaults.requireSignedAttestation).toBe(true);
	});

	it("M8b: --no-attestation-check disables all attestation profile flags", () => {
		const result = resolveVerifyDefaults({
			profile: "strict",
			cliFlags: {
				attestationCheck: false, // --no-attestation-check
			},
			config: emptyConfig,
			configSource: "none",
		});
		expect(result.defaults.requireSignedAttestation).toBe(false);
		expect(result.defaults.requireAttestationBinding).toBe(false);
		expect(result.defaults.strictAttestationFile).toBe(false);
		// Non-attestation flags remain
		expect(result.defaults.requireSeal).toBe(true);
		expect(result.defaults.requireWitness).toBe(true);
	});

	it("M9: unknown profile name falls back to baseline", () => {
		const result = resolveVerifyDefaults({
			profile: "nonexistent",
			cliFlags: {},
			config: emptyConfig,
			configSource: "none",
		});
		expect(result.profileName).toBe("nonexistent");
		expect(result.defaults.requireSeal).toBe(false);
		expect(result.defaults.requireWitness).toBe(false);
	});

	it("M9b: config file profile is used when no CLI --profile", () => {
		const config: PatchworkConfig = {
			verify: {
				profile: "strict",
			},
		};
		const result = resolveVerifyDefaults({
			cliFlags: {},
			config,
			configSource: "/some/config.yml",
		});
		expect(result.profileName).toBe("strict");
		expect(result.defaults.requireSeal).toBe(true);
	});

	it("M9c: CLI --profile overrides config file profile", () => {
		const config: PatchworkConfig = {
			verify: {
				profile: "strict",
			},
		};
		const result = resolveVerifyDefaults({
			profile: "baseline",
			cliFlags: {},
			config,
			configSource: "/some/config.yml",
		});
		expect(result.profileName).toBe("baseline");
		expect(result.defaults.requireSeal).toBe(false);
	});

	it("M9d: config file can disable profile flags", () => {
		const config: PatchworkConfig = {
			verify: {
				profile: "strict",
				require_seal: false,
			},
		};
		const result = resolveVerifyDefaults({
			cliFlags: {},
			config,
			configSource: "/some/config.yml",
		});
		// Profile sets requireSeal=true, but config overrides to false
		expect(result.defaults.requireSeal).toBe(false);
		// Other strict flags remain
		expect(result.defaults.requireWitness).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// V-series: config validation tests
// ---------------------------------------------------------------------------

describe("config validation", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-config-val-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	function writeConfig(content: string): void {
		const configDir = join(tmpDir, ".patchwork");
		mkdirSync(configDir, { recursive: true });
		writeFileSync(join(configDir, "config.yml"), content);
	}

	it("V1: valid config returns validation status=valid", () => {
		writeConfig("verify:\n  profile: strict\n  max_seal_age_seconds: 3600\n");
		const result = loadConfig(tmpDir);
		expect(result.validation.status).toBe("valid");
		expect(result.validation.errors).toEqual([]);
	});

	it("V2: unknown top-level key returns status=invalid with error path", () => {
		writeConfig("verify:\n  profile: strict\nother_section:\n  foo: bar\n");
		const result = loadConfig(tmpDir);
		expect(result.validation.status).toBe("invalid");
		expect(result.validation.errors.length).toBeGreaterThan(0);
		const paths = result.validation.errors.map((e) => e.path);
		expect(paths).toContain("other_section");
	});

	it("V3: unknown nested key under verify returns error path", () => {
		writeConfig("verify:\n  profile: strict\n  unknown_key: true\n");
		const result = loadConfig(tmpDir);
		expect(result.validation.status).toBe("invalid");
		const paths = result.validation.errors.map((e) => e.path);
		expect(paths).toContain("verify.unknown_key");
	});

	it("V4: wrong type (string for number) reports error", () => {
		writeConfig("verify:\n  max_seal_age_seconds: not_a_number\n");
		const result = loadConfig(tmpDir);
		expect(result.validation.status).toBe("invalid");
		const paths = result.validation.errors.map((e) => e.path);
		expect(paths.some((p) => p.includes("max_seal_age_seconds"))).toBe(true);
	});

	it("V5: wrong type (number for boolean) reports error", () => {
		writeConfig("verify:\n  require_seal: 42\n");
		const result = loadConfig(tmpDir);
		expect(result.validation.status).toBe("invalid");
		const paths = result.validation.errors.map((e) => e.path);
		expect(paths.some((p) => p.includes("require_seal"))).toBe(true);
	});

	it("V6: negative number for age constraint reports error", () => {
		writeConfig("verify:\n  max_seal_age_seconds: -100\n");
		const result = loadConfig(tmpDir);
		expect(result.validation.status).toBe("invalid");
		const paths = result.validation.errors.map((e) => e.path);
		expect(paths.some((p) => p.includes("max_seal_age_seconds"))).toBe(true);
	});

	it("V7: invalid config still extracts known valid keys (lenient recovery)", () => {
		writeConfig("verify:\n  profile: strict\n  unknown_key: true\n");
		const result = loadConfig(tmpDir);
		// Validation reports the error
		expect(result.validation.status).toBe("invalid");
		// But usable config is still extracted
		expect(result.config.verify?.profile).toBe("strict");
	});

	it("V8: no config file returns validation status=valid", () => {
		const result = loadConfig(tmpDir);
		expect(result.source).toBe("none");
		expect(result.validation.status).toBe("valid");
		expect(result.validation.errors).toEqual([]);
	});
});
