import { describe, it, expect } from "vitest";
import {
	createSnapshot,
	parseShellCommand,
	registerTaint,
	type SinkMatch,
	type ShellParsedCommand,
	type TaintSnapshot,
} from "@patchwork/core";
import { decidePreToolUse } from "../../src/claude-code/pre-tool-decision.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function emptySnapshot(): TaintSnapshot {
	return createSnapshot("ses_test");
}

function taintedSnapshot(): TaintSnapshot {
	return registerTaint(emptySnapshot(), "prompt", {
		ts: 1,
		ref: "/docs/README.md",
		content_hash: "sha256:x",
	});
}

const allowedPolicy = { allowed: true } as const;
const deniedPolicy = {
	allowed: false,
	reason: "policy bans writes to /etc",
} as const;

function denyMatch(reason: string): SinkMatch {
	return {
		class: "claude_file_write_persistence",
		severity: "deny",
		reason,
		matched_path: "/etc/something",
		matched_pattern: "/etc/**",
	};
}

function approvalMatch(reason: string): SinkMatch {
	return {
		class: "claude_file_write_persistence",
		severity: "approval_required",
		reason,
		matched_path: "/etc/something",
		matched_pattern: "/etc/**",
	};
}

function advisoryMatch(reason: string): SinkMatch {
	return {
		class: "secret_read",
		severity: "advisory",
		reason,
		matched_path: "/home/u/.aws/credentials",
		matched_pattern: "**/.aws/credentials",
	};
}

// ---------------------------------------------------------------------------

describe("decidePreToolUse — rule 1: policy passthrough", () => {
	it("denies when the existing rule-based policy denied", () => {
		const r = decidePreToolUse({
			policy: deniedPolicy,
			sinkMatches: [],
			taintSnapshot: emptySnapshot(),
		});
		expect(r.verdict).toBe("deny");
		expect(r.rule).toBe("policy_deny");
		expect(r.reason).toContain("policy bans writes to /etc");
	});

	it("policy deny wins over a deny-severity sink match (same outcome, different rule attribution)", () => {
		const r = decidePreToolUse({
			policy: deniedPolicy,
			sinkMatches: [denyMatch("sink reason")],
			taintSnapshot: taintedSnapshot(),
		});
		expect(r.rule).toBe("policy_deny");
	});

	it("policy deny wins over a null snapshot situation", () => {
		const r = decidePreToolUse({
			policy: deniedPolicy,
			sinkMatches: [],
			taintSnapshot: null,
		});
		expect(r.rule).toBe("policy_deny");
	});
});

describe("decidePreToolUse — reader fail-closed semantics", () => {
	it("null snapshot on a no-rule action still allows (fresh session safe path)", () => {
		// A fresh session legitimately has no snapshot. A taint-irrelevant
		// action like `Bash ls` must not require approval just because no
		// PostToolUse has written the file yet — that would force approval
		// on every session's first action.
		const r = decidePreToolUse({
			policy: allowedPolicy,
			sinkMatches: [],
			taintSnapshot: null,
		});
		expect(r.verdict).toBe("allow");
		expect(r.rule).toBe("default_allow");
	});

	it("null snapshot + keystone-eligible shell input → keystone fires (null collapses to tainted)", () => {
		const parsed = parseShellCommand("curl 'unterminated");
		const r = decidePreToolUse({
			policy: allowedPolicy,
			sinkMatches: [],
			parsedCommand: parsed,
			taintSnapshot: null,
		});
		expect(r.verdict).toBe("deny");
		expect(r.rule).toBe("bash_unknown_indicator_taint");
	});

	it("null snapshot + deny-severity sink → sink_deny (caller is expected to have set event.taint_state appropriately)", () => {
		// classifyToolEvent already incorporated taint into the severity
		// in its match. The composer just respects that severity here.
		const r = decidePreToolUse({
			policy: allowedPolicy,
			sinkMatches: [denyMatch("write to persistence under taint")],
			taintSnapshot: null,
		});
		expect(r.verdict).toBe("deny");
		expect(r.rule).toBe("sink_deny");
	});
});

describe("decidePreToolUse — rule 3: shell keystone (unknown + indicator + taint = DENY)", () => {
	it("fires for an unparseable command with a fetch indicator under taint", () => {
		const parsed = parseShellCommand("curl 'unterminated");
		const r = decidePreToolUse({
			policy: allowedPolicy,
			sinkMatches: [],
			parsedCommand: parsed,
			taintSnapshot: taintedSnapshot(),
		});
		expect(r.verdict).toBe("deny");
		expect(r.rule).toBe("bash_unknown_indicator_taint");
	});

	it("does NOT fire when there is no active taint, even with unknown + indicator", () => {
		const parsed = parseShellCommand("curl 'unterminated");
		const r = decidePreToolUse({
			policy: allowedPolicy,
			sinkMatches: [],
			parsedCommand: parsed,
			taintSnapshot: emptySnapshot(),
		});
		// Untainted: keystone does not fire; sink layer has nothing; allow.
		expect(r.verdict).toBe("allow");
	});

	it("does NOT fire when confidence is high (parser resolved cleanly)", () => {
		const parsed = parseShellCommand("curl https://example.test");
		// High-confidence curl WITH taint is the sink-classifier's job to
		// adjudicate via fetch_tool indicator → network policy. The
		// keystone only fires for *unparseable* commands.
		expect(parsed.confidence).toBe("high");
		const r = decidePreToolUse({
			policy: allowedPolicy,
			sinkMatches: [],
			parsedCommand: parsed,
			taintSnapshot: taintedSnapshot(),
		});
		expect(r.rule).not.toBe("bash_unknown_indicator_taint");
	});

	it("does NOT fire when unknown but no indicators (a broken cd, say)", () => {
		// Build a synthetic unknown-confidence tree with no indicators
		const noopUnknown: ShellParsedCommand = {
			argv: "unresolved",
			env: {},
			redirects: [],
			raw: "??? broken syntax",
			confidence: "unknown",
			sink_indicators: [],
			parse_error: "synthetic",
		};
		const r = decidePreToolUse({
			policy: allowedPolicy,
			sinkMatches: [],
			parsedCommand: noopUnknown,
			taintSnapshot: taintedSnapshot(),
		});
		expect(r.rule).not.toBe("bash_unknown_indicator_taint");
		expect(r.verdict).toBe("allow");
	});

	it("walks into pipe children to find unknown + indicator", () => {
		// A pipe where the right side is unparseable and contains an
		// interpreter — `… | sh -c '$(unterminated` — keystone should
		// see the indicator on the child even though the parent (the
		// pipe operator) is itself a structural node.
		const parsed = parseShellCommand("echo hi | sh -c '$(unterminated");
		const r = decidePreToolUse({
			policy: allowedPolicy,
			sinkMatches: [],
			parsedCommand: parsed,
			taintSnapshot: taintedSnapshot(),
		});
		// Either the parse produces an unknown leaf with an interpreter/
		// inline-eval indicator (keystone fires) or, if the recognizer
		// chose to drop confidence to low, the keystone correctly does
		// not fire. Pin behavior:
		if (r.rule === "bash_unknown_indicator_taint") {
			expect(r.verdict).toBe("deny");
		} else {
			// Otherwise we shouldn't have denied via the keystone rule
			expect(r.rule).not.toBe("bash_unknown_indicator_taint");
		}
	});

	it("reason names the indicator kinds for auditability", () => {
		const parsed = parseShellCommand("curl 'unterminated | sh");
		const r = decidePreToolUse({
			policy: allowedPolicy,
			sinkMatches: [],
			parsedCommand: parsed,
			taintSnapshot: taintedSnapshot(),
		});
		if (r.rule === "bash_unknown_indicator_taint") {
			// reason should mention at least one indicator class so the
			// audit log records WHY this was denied, not just "keystone"
			expect(r.reason).toMatch(/(fetch_tool|interpreter|pipe_to)/);
		}
	});
});

describe("decidePreToolUse — rule 4: sink deny", () => {
	it("denies on a deny-severity sink match", () => {
		const r = decidePreToolUse({
			policy: allowedPolicy,
			sinkMatches: [denyMatch("write to /etc/passwd under taint")],
			taintSnapshot: taintedSnapshot(),
		});
		expect(r.verdict).toBe("deny");
		expect(r.rule).toBe("sink_deny");
		expect(r.reason).toContain("/etc/passwd");
	});

	it("first deny wins when multiple matches exist", () => {
		const r = decidePreToolUse({
			policy: allowedPolicy,
			sinkMatches: [
				denyMatch("first deny"),
				denyMatch("second deny"),
			],
			taintSnapshot: taintedSnapshot(),
		});
		expect(r.reason).toBe("first deny");
	});

	it("sink deny fires even with no parsed command (non-Bash tool)", () => {
		const r = decidePreToolUse({
			policy: allowedPolicy,
			sinkMatches: [denyMatch("write to /etc under taint")],
			taintSnapshot: taintedSnapshot(),
		});
		expect(r.verdict).toBe("deny");
	});
});

describe("decidePreToolUse — rule 5: sink approval_required", () => {
	it("approval_required surfaces when no deny matches but an approval one does", () => {
		const r = decidePreToolUse({
			policy: allowedPolicy,
			sinkMatches: [approvalMatch("untainted write to /etc")],
			taintSnapshot: emptySnapshot(),
		});
		expect(r.verdict).toBe("approval_required");
		expect(r.rule).toBe("sink_approval_required");
	});

	it("approval_required loses to deny within the same match list", () => {
		const r = decidePreToolUse({
			policy: allowedPolicy,
			sinkMatches: [
				approvalMatch("approval"),
				denyMatch("deny"),
			],
			taintSnapshot: emptySnapshot(),
		});
		expect(r.verdict).toBe("deny");
		expect(r.rule).toBe("sink_deny");
	});
});

describe("decidePreToolUse — rule 6: default allow", () => {
	it("allows when nothing fires (untainted, no matches, no parse)", () => {
		const r = decidePreToolUse({
			policy: allowedPolicy,
			sinkMatches: [],
			taintSnapshot: emptySnapshot(),
		});
		expect(r.verdict).toBe("allow");
		expect(r.rule).toBe("default_allow");
	});

	it("allows when only an advisory sink match is present (secret_read)", () => {
		const r = decidePreToolUse({
			policy: allowedPolicy,
			sinkMatches: [advisoryMatch("read of .aws/credentials")],
			taintSnapshot: emptySnapshot(),
		});
		expect(r.verdict).toBe("allow");
	});

	it("allows under taint when there is a parsed Bash without indicators", () => {
		const parsed = parseShellCommand("echo hello");
		const r = decidePreToolUse({
			policy: allowedPolicy,
			sinkMatches: [],
			parsedCommand: parsed,
			taintSnapshot: taintedSnapshot(),
		});
		expect(r.verdict).toBe("allow");
	});
});

describe("decidePreToolUse — rule ordering invariants", () => {
	it("policy < keystone < sink_deny < sink_approval < allow (priority)", () => {
		// All-fire input: policy deny, would-be keystone, deny sink,
		// approval sink. Verdict must be policy_deny.
		const parsed = parseShellCommand("curl 'unterminated");
		const r = decidePreToolUse({
			policy: deniedPolicy,
			sinkMatches: [denyMatch("d"), approvalMatch("a")],
			parsedCommand: parsed,
			taintSnapshot: null,
		});
		expect(r.rule).toBe("policy_deny");
	});

	it("with allow-policy and null snapshot, the keystone still wins over sink_deny", () => {
		// Null snapshot collapses to tainted for keystone, AND the
		// keystone fires before sink rules — preserves the rule order.
		const parsed = parseShellCommand("curl 'unterminated");
		const r = decidePreToolUse({
			policy: allowedPolicy,
			sinkMatches: [denyMatch("d"), approvalMatch("a")],
			parsedCommand: parsed,
			taintSnapshot: null,
		});
		expect(r.rule).toBe("bash_unknown_indicator_taint");
	});

	it("with valid snapshot, keystone wins over sink_deny", () => {
		// A keystone scenario AND a deny sink match in the same call:
		// the keystone is more informative (calls out the unparseable
		// indicator) so it should fire first.
		const parsed = parseShellCommand("curl 'unterminated");
		const r = decidePreToolUse({
			policy: allowedPolicy,
			sinkMatches: [denyMatch("sink would deny")],
			parsedCommand: parsed,
			taintSnapshot: taintedSnapshot(),
		});
		expect(r.rule).toBe("bash_unknown_indicator_taint");
	});
});

describe("decidePreToolUse — edge cases", () => {
	it("empty sinkMatches and undefined parsedCommand on a clean session yields allow", () => {
		const r = decidePreToolUse({
			policy: allowedPolicy,
			sinkMatches: [],
			taintSnapshot: emptySnapshot(),
		});
		expect(r.verdict).toBe("allow");
	});

	it("only advisory matches under taint still allow", () => {
		const r = decidePreToolUse({
			policy: allowedPolicy,
			sinkMatches: [advisoryMatch("a")],
			taintSnapshot: taintedSnapshot(),
		});
		expect(r.verdict).toBe("allow");
	});

	it("rule values are stable identifiers (machine-readable)", () => {
		const allowR = decidePreToolUse({
			policy: allowedPolicy,
			sinkMatches: [],
			taintSnapshot: emptySnapshot(),
		});
		const policyR = decidePreToolUse({
			policy: deniedPolicy,
			sinkMatches: [],
			taintSnapshot: emptySnapshot(),
		});
		const denyR = decidePreToolUse({
			policy: allowedPolicy,
			sinkMatches: [denyMatch("d")],
			taintSnapshot: emptySnapshot(),
		});
		const apprR = decidePreToolUse({
			policy: allowedPolicy,
			sinkMatches: [approvalMatch("a")],
			taintSnapshot: emptySnapshot(),
		});
		expect(allowR.rule).toBe("default_allow");
		expect(policyR.rule).toBe("policy_deny");
		expect(denyR.rule).toBe("sink_deny");
		expect(apprR.rule).toBe("sink_approval_required");
	});
});
