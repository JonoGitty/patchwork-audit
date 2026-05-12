import { describe, it, expect } from "vitest";
import {
	evaluatePolicy,
	PolicySchema,
	type Policy,
} from "../../src/policy/engine.js";

/**
 * R4-001 regression: the default-policy regex denying agent invocations
 * of `patchwork approve|clear-taint|trust-repo-config` must match
 * every wrapper shape an agent could use to spawn the admin CLI.
 *
 * The regex under test is the one shipped in docs/default-policy.yml:
 *
 *   (^|[^A-Za-z0-9_./-])patchwork[ \t]+(approve|clear-taint|trust-repo-config)\b
 *
 * R3 used a narrower left boundary `[ ;&|]|/` which missed
 * quote/paren/backtick — `script -q -c 'patchwork approve <id>'`
 * passed through it. R4-001 broadened to `[^A-Za-z0-9_./-]`.
 */

const ADMIN_DENY_REGEX =
	"(^|[^A-Za-z0-9_-])patchwork[ \\t]+(approve|clear-taint|trust-repo-config)\\b";

function policyWithRegex(): Policy {
	return PolicySchema.parse({
		name: "test",
		version: "1",
		max_risk: "high",
		commands: {
			deny: [
				{
					regex: ADMIN_DENY_REGEX,
					action: "deny",
					reason: "Administrative CLI — human only",
				},
			],
			allow: [],
			default_action: "allow",
		},
	});
}

function check(command: string): boolean {
	const r = evaluatePolicy(policyWithRegex(), {
		action: "command_execute",
		risk_level: "low",
		target: { type: "command", command },
	});
	return r.allowed;
}

describe("R4-001: admin CLI deny regex catches wrapper shapes", () => {
	describe("must DENY", () => {
		it("bare `patchwork approve <id>`", () => {
			expect(check("patchwork approve abc123")).toBe(false);
		});

		it("bare `patchwork clear-taint`", () => {
			expect(check("patchwork clear-taint")).toBe(false);
		});

		it("bare `patchwork trust-repo-config foo`", () => {
			expect(check("patchwork trust-repo-config /tmp/x")).toBe(false);
		});

		it("env-wrapped `env X=1 patchwork approve <id>`", () => {
			expect(check("env X=1 patchwork approve abc123")).toBe(false);
		});

		it("absolute path `/usr/local/bin/patchwork approve <id>`", () => {
			expect(check("/usr/local/bin/patchwork approve abc123")).toBe(false);
		});

		it("script PTY wrapper (single quotes): `script -q -c 'patchwork approve <id>'`", () => {
			expect(
				check("script -q -c 'patchwork approve abc123' /dev/null"),
			).toBe(false);
		});

		it("script PTY wrapper (double quotes): `script -q -c \"patchwork approve <id>\"`", () => {
			expect(
				check('script -q -c "patchwork approve abc123" /dev/null'),
			).toBe(false);
		});

		it("subshell `(patchwork approve <id>)`", () => {
			expect(check("(patchwork approve abc123)")).toBe(false);
		});

		it("command substitution `$(patchwork approve <id>)`", () => {
			expect(check("echo $(patchwork approve abc123)")).toBe(false);
		});

		it("backtick `` `patchwork approve <id>` ``", () => {
			expect(check("echo `patchwork approve abc123`")).toBe(false);
		});

		it("chained `do_thing; patchwork approve <id>`", () => {
			expect(check("ls; patchwork approve abc123")).toBe(false);
		});

		it("pipe `something | patchwork approve <id>` (rare but possible)", () => {
			expect(check("echo abc123 | patchwork approve abc123")).toBe(false);
		});

		it("tab-separated `exec\\tpatchwork approve <id>`", () => {
			expect(check("exec\tpatchwork approve abc123")).toBe(false);
		});

		it("`bash -c 'patchwork clear-taint'`", () => {
			expect(check("bash -c 'patchwork clear-taint'")).toBe(false);
		});

		it("`sh -c \"patchwork trust-repo-config /tmp/x\"`", () => {
			expect(check('sh -c "patchwork trust-repo-config /tmp/x"')).toBe(false);
		});
	});

	describe("must NOT false-positive", () => {
		it("unrelated patchwork subcommands allowed (patchwork status)", () => {
			expect(check("patchwork status")).toBe(true);
		});

		it("patchwork-foo with similar prefix not matched", () => {
			expect(check("patchwork-foo approve abc123")).toBe(true);
		});

		it("patchworkapprove with no space not matched", () => {
			expect(check("patchworkapprove abc123")).toBe(true);
		});

		it("the substring 'approve' alone is not matched", () => {
			expect(check("approve abc123")).toBe(true);
		});

		it("npm install patchwork allowed", () => {
			expect(check("npm install @patchwork/cli")).toBe(true);
		});
	});
});
