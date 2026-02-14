import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	loadPolicyFromFile,
	loadActivePolicy,
	policyToYaml,
	DEFAULT_POLICY,
	STRICT_POLICY,
} from "../../src/policy/loader.js";

describe("loadPolicyFromFile", () => {
	const testDir = join(tmpdir(), `patchwork-policy-test-${Date.now()}`);
	const policyFile = join(testDir, "policy.yml");

	beforeEach(() => {
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("loads and parses a YAML policy file", () => {
		const yaml = `
name: test
version: "1"
max_risk: medium
files:
  deny:
    - pattern: "**/.env"
      action: deny
      reason: Secrets
  default_action: allow
commands:
  deny:
    - prefix: sudo
      action: deny
  default_action: allow
`;
		writeFileSync(policyFile, yaml, "utf-8");
		const policy = loadPolicyFromFile(policyFile);
		expect(policy.name).toBe("test");
		expect(policy.max_risk).toBe("medium");
		expect(policy.files.deny).toHaveLength(1);
		expect(policy.files.deny[0].pattern).toBe("**/.env");
		expect(policy.commands.deny).toHaveLength(1);
	});

	it("applies defaults for missing fields", () => {
		writeFileSync(policyFile, "name: minimal\n", "utf-8");
		const policy = loadPolicyFromFile(policyFile);
		expect(policy.name).toBe("minimal");
		expect(policy.max_risk).toBe("high");
		expect(policy.files.default_action).toBe("allow");
	});
});

describe("loadActivePolicy", () => {
	const testDir = join(tmpdir(), `patchwork-active-policy-${Date.now()}`);
	const projectDir = join(testDir, "project");
	let originalHome: string | undefined;

	beforeEach(() => {
		originalHome = process.env.HOME;
		process.env.HOME = testDir;
		mkdirSync(join(testDir, ".patchwork"), { recursive: true });
		mkdirSync(join(projectDir, ".patchwork"), { recursive: true });
	});

	afterEach(() => {
		process.env.HOME = originalHome;
		rmSync(testDir, { recursive: true, force: true });
	});

	it("returns default policy when no files exist", () => {
		// Remove the .patchwork dirs so no policy files are found
		rmSync(join(testDir, ".patchwork"), { recursive: true, force: true });
		rmSync(join(projectDir, ".patchwork"), { recursive: true, force: true });

		const { policy, source } = loadActivePolicy(projectDir);
		expect(source).toBe("built-in");
		expect(policy.name).toBe("default");
	});

	it("loads project-level policy when present", () => {
		writeFileSync(
			join(projectDir, ".patchwork", "policy.yml"),
			"name: project-policy\nmax_risk: low\n",
			"utf-8",
		);
		const { policy, source } = loadActivePolicy(projectDir);
		expect(source).toContain("project");
		expect(policy.name).toBe("project-policy");
		expect(policy.max_risk).toBe("low");
	});

	it("loads user-level policy when no project policy", () => {
		writeFileSync(
			join(testDir, ".patchwork", "policy.yml"),
			"name: user-policy\nmax_risk: medium\n",
			"utf-8",
		);
		const { policy, source } = loadActivePolicy("/nonexistent");
		expect(source).toContain(join(".patchwork", "policy.yml"));
		expect(policy.name).toBe("user-policy");
	});

	it("project policy takes precedence over user policy", () => {
		writeFileSync(
			join(testDir, ".patchwork", "policy.yml"),
			"name: user-policy\n",
			"utf-8",
		);
		writeFileSync(
			join(projectDir, ".patchwork", "policy.yml"),
			"name: project-policy\n",
			"utf-8",
		);
		const { policy } = loadActivePolicy(projectDir);
		expect(policy.name).toBe("project-policy");
	});
});

describe("policyToYaml", () => {
	it("serializes default policy to YAML", () => {
		const yaml = policyToYaml(DEFAULT_POLICY);
		expect(yaml).toContain("name: default");
		expect(yaml).toContain("max_risk: critical");
	});

	it("serializes strict policy to YAML", () => {
		const yaml = policyToYaml(STRICT_POLICY);
		expect(yaml).toContain("name: strict");
		expect(yaml).toContain("max_risk: high");
		expect(yaml).toContain(".env");
		expect(yaml).toContain("sudo");
	});
});

describe("built-in policies", () => {
	it("DEFAULT_POLICY allows everything", () => {
		expect(DEFAULT_POLICY.max_risk).toBe("critical");
		expect(DEFAULT_POLICY.files.default_action).toBe("allow");
		expect(DEFAULT_POLICY.commands.default_action).toBe("allow");
	});

	it("STRICT_POLICY has deny rules for secrets", () => {
		expect(STRICT_POLICY.max_risk).toBe("high");
		expect(STRICT_POLICY.files.deny.length).toBeGreaterThan(0);
		expect(STRICT_POLICY.commands.deny.length).toBeGreaterThan(0);
	});
});
