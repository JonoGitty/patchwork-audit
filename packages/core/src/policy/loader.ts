import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { PolicySchema, type Policy } from "./engine.js";

/**
 * Load a policy from a YAML file.
 */
export function loadPolicyFromFile(filePath: string): Policy {
	const content = readFileSync(filePath, "utf-8");
	const raw = YAML.parse(content);
	return PolicySchema.parse(raw);
}

/**
 * Load the active policy. Resolution order:
 * 1. Project-level: .patchwork/policy.yml in cwd
 * 2. User-level: ~/.patchwork/policy.yml
 * 3. Built-in default (audit-only, no enforcement)
 */
export function loadActivePolicy(cwd?: string): { policy: Policy; source: string } {
	// Project-level
	if (cwd) {
		const projectPath = join(cwd, ".patchwork", "policy.yml");
		if (existsSync(projectPath)) {
			return { policy: loadPolicyFromFile(projectPath), source: projectPath };
		}
	}

	// User-level
	const userPath = join(process.env.HOME || "~", ".patchwork", "policy.yml");
	if (existsSync(userPath)) {
		return { policy: loadPolicyFromFile(userPath), source: userPath };
	}

	// Default: audit-only (everything allowed)
	return { policy: DEFAULT_POLICY, source: "built-in" };
}

/**
 * Default policy: permissive audit-only mode.
 * Everything is allowed, but still logged.
 */
export const DEFAULT_POLICY: Policy = PolicySchema.parse({
	name: "default",
	version: "1",
	description: "Default audit-only policy. All actions are allowed and logged.",
	max_risk: "critical",
	files: { default_action: "allow" },
	commands: { default_action: "allow" },
	network: { default_action: "allow" },
	mcp: { default_action: "allow" },
});

/**
 * Strict policy: deny dangerous operations.
 * Good starting point for enterprise teams.
 */
export const STRICT_POLICY: Policy = PolicySchema.parse({
	name: "strict",
	version: "1",
	description: "Strict policy for enterprise environments. Blocks dangerous operations.",
	max_risk: "high",
	files: {
		deny: [
			{ pattern: "**/.env", action: "deny", reason: "Environment files contain secrets" },
			{ pattern: "**/.env.*", action: "deny", reason: "Environment files contain secrets" },
			{ pattern: "**/*.key", action: "deny", reason: "Private key files" },
			{ pattern: "**/*.pem", action: "deny", reason: "Certificate files" },
			{ pattern: "**/.ssh/*", action: "deny", reason: "SSH configuration" },
			{ pattern: "**/.aws/credentials", action: "deny", reason: "AWS credentials" },
			{ pattern: "**/*secret*", action: "deny", reason: "Files containing secrets" },
		],
		default_action: "allow",
	},
	commands: {
		deny: [
			{ prefix: "rm -rf", action: "deny", reason: "Recursive force delete" },
			{ prefix: "sudo", action: "deny", reason: "Elevated privileges" },
			{ prefix: "curl", action: "deny", reason: "Network commands blocked in strict mode" },
			{ prefix: "wget", action: "deny", reason: "Network commands blocked in strict mode" },
			{ prefix: "ssh", action: "deny", reason: "Remote access blocked" },
			{ prefix: "scp", action: "deny", reason: "Remote copy blocked" },
			{ prefix: "git push --force", action: "deny", reason: "Force push blocked" },
			{ prefix: "git push -f", action: "deny", reason: "Force push blocked" },
			{ prefix: "chmod 777", action: "deny", reason: "Overly permissive file permissions" },
		],
		allow: [
			{ prefix: "npm test", action: "allow", reason: "Test execution" },
			{ prefix: "npm run", action: "allow", reason: "Script execution" },
			{ prefix: "npx", action: "allow", reason: "Package runner" },
			{ prefix: "git status", action: "allow", reason: "Git status check" },
			{ prefix: "git diff", action: "allow", reason: "Git diff" },
			{ prefix: "git log", action: "allow", reason: "Git log" },
			{ prefix: "git add", action: "allow", reason: "Git staging" },
			{ prefix: "git commit", action: "allow", reason: "Git commit" },
			{ prefix: "ls", action: "allow", reason: "Directory listing" },
			{ prefix: "cat", action: "allow", reason: "File reading" },
		],
		default_action: "allow",
	},
	network: {
		deny: [],
		default_action: "allow",
	},
	mcp: {
		deny: [],
		default_action: "allow",
	},
});

/**
 * Serialize a policy to YAML.
 */
export function policyToYaml(policy: Policy): string {
	return YAML.stringify(policy, { lineWidth: 100 });
}
