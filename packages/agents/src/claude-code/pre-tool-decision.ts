/**
 * PreToolUse decision composer (v0.6.11 commit 8 — the keystone).
 *
 * Pure function that combines every commit-2…commit-7 input into a
 * single allow / approval_required / deny verdict for the PreToolUse
 * hook. No I/O — the adapter is responsible for sourcing each input.
 *
 * Decision order (first match wins):
 *
 *   1. POLICY DENY (passthrough).
 *      If the existing rule-based policy already denied the action,
 *      surface that. The taint/sink layer can only *escalate*, never
 *      relax the rule-based policy.
 *
 *   2. SHELL KEYSTONE (`unknown` + indicator + taint = DENY).
 *      For Bash, if the parsed tree has ANY node with `confidence:
 *      "unknown"` AND that node carries ANY sink indicator AND the
 *      session has ANY active taint kind, deny. The premise: an
 *      unparseable command we can't fully reason about, which still
 *      shows surface-level danger (curl, eval, scp, …), running in a
 *      session that has already touched untrusted content — the only
 *      safe answer is no. Source: design §3.7 + GPT round-4.
 *
 *   3. SINK DENY.
 *      Any `classifyToolEvent` match with `severity: "deny"`. Today
 *      this is `claude_file_write_persistence` under active taint
 *      (classify.ts already folds taint state into the severity flip),
 *      plus anything later commits add.
 *
 *   4. SINK APPROVAL_REQUIRED.
 *      Any match with `severity: "approval_required"`. The `patchwork
 *      approve` CLI lands in commit 9; until then, this verdict maps
 *      to a deny with an explicit "approval required" reason so the
 *      agent can see what to ask the user for. Advisory matches
 *      (e.g. `secret_read`) do NOT block here — they only feed the
 *      taint engine via the PostToolUse path.
 *
 *   5. ALLOW.
 *      Default. Audit-only — the action proceeds and PostToolUse will
 *      record any taint it generates.
 *
 * Reader fail-closed semantics:
 *      A `null` taint snapshot means missing-or-corrupt — `null` IS NOT
 *      a top-level verdict by itself. Instead, every rule that *consults*
 *      taint treats `null` as "every kind active." A fresh session
 *      (snapshot legitimately missing) running `Bash ls` still allows
 *      because no rule consults taint for that input. A fresh session
 *      running `Bash curl 'unterminated` hits the keystone because the
 *      keystone consults taint and `null` collapses to "tainted." The
 *      sink layer inherits the same behavior because the adapter
 *      synthesizes an "all-active" `taint_state` on the `ToolEvent` it
 *      passes to `classifyToolEvent` when the snapshot is null —
 *      `classify.ts`'s persistence severity then flips from
 *      `approval_required` to `deny` exactly as if real taint were
 *      present. A source-layer bug therefore only ever forces more
 *      enforcement where enforcement matters, never fewer.
 */

// `ShellShellParsedCommand` is the rich shell-parser tree from commit 4 (op,
// children, structured sink_indicators, confidence). The simpler
// `ShellParsedCommand` re-export from `tool-event.ts` is for ToolEvent
// serialization and is intentionally lossy — the keystone rule needs the
// rich tree.
import type {
	ShellShellParsedCommand,
	SinkIndicator,
	SinkMatch,
	TaintSnapshot,
} from "@patchwork/core";
import { hasAnyTaint } from "@patchwork/core";

/** Result of `evaluatePolicy` for the same event. */
export interface PolicyDecisionLike {
	allowed: boolean;
	reason?: string;
}

export interface PreToolDecisionInput {
	policy: PolicyDecisionLike;
	sinkMatches: readonly SinkMatch[];
	/** Parsed shell tree for Bash; undefined for other tools. */
	parsedCommand?: ShellParsedCommand;
	/**
	 * Current per-session taint snapshot, OR `null` for
	 * missing/corrupt/unreadable. See decision rule 2.
	 */
	taintSnapshot: TaintSnapshot | null;
}

export type PreToolVerdict = "allow" | "approval_required" | "deny";

export interface PreToolDecision {
	verdict: PreToolVerdict;
	reason: string;
	/** Short identifier for the rule that produced the verdict — used in
	 *  audit logs to distinguish "denied by policy" from "denied by sink"
	 *  from "denied by keystone" without parsing free-form reasons. */
	rule:
		| "policy_deny"
		| "bash_unknown_indicator_taint"
		| "sink_deny"
		| "sink_approval_required"
		| "default_allow";
}

/**
 * Collect every sink indicator that appears anywhere in the parsed
 * shell tree. Walks children recursively. Uses an explicit stack
 * rather than recursion so a deeply-nested process-sub forest can't
 * blow the JS stack on a hostile input.
 */
function collectIndicators(root: ShellParsedCommand): SinkIndicator[] {
	const out: SinkIndicator[] = [];
	const stack: ShellParsedCommand[] = [root];
	while (stack.length > 0) {
		const node = stack.pop() as ShellParsedCommand;
		for (const ind of node.sink_indicators) out.push(ind);
		if (node.children) {
			for (const child of node.children) stack.push(child);
		}
	}
	return out;
}

/**
 * True if any node in the tree has `confidence === "unknown"`. The
 * keystone rule only triggers when the parser explicitly gave up on
 * some portion — `low` confidence (e.g. an env expansion we couldn't
 * resolve but otherwise understood the command) is not the same as
 * `unknown` and does not by itself flip the verdict.
 */
function hasUnknownNode(root: ShellParsedCommand): boolean {
	const stack: ShellParsedCommand[] = [root];
	while (stack.length > 0) {
		const node = stack.pop() as ShellParsedCommand;
		if (node.confidence === "unknown") return true;
		if (node.children) {
			for (const child of node.children) stack.push(child);
		}
	}
	return false;
}

/** First match with severity === target, or null. */
function firstWithSeverity(
	matches: readonly SinkMatch[],
	target: SinkMatch["severity"],
): SinkMatch | null {
	for (const m of matches) {
		if (m.severity === target) return m;
	}
	return null;
}

export function decidePreToolUse(
	input: PreToolDecisionInput,
): PreToolDecision {
	// Rule 1: existing rule-based policy denial passes straight through.
	if (!input.policy.allowed) {
		return {
			verdict: "deny",
			reason: input.policy.reason || "policy denied this action",
			rule: "policy_deny",
		};
	}

	// Reader fail-closed: a `null` snapshot collapses to "every kind
	// active" for any rule that consults taint. We do NOT short-circuit
	// to approval_required at this point — a fresh session legitimately
	// has no snapshot, and forcing approval on every first-action would
	// make the whole system unusable. Instead, downstream rules that
	// consult taint substitute `true` when the snapshot is null. See
	// file header "Reader fail-closed semantics" for rationale.
	const tainted =
		input.taintSnapshot === null
			? true
			: hasAnyTaint(input.taintSnapshot);

	// Rule 2: shell keystone — unknown + indicator + taint = DENY.
	// Order matters: this fires BEFORE sink rules because an
	// unparseable Bash with a curl indicator under taint is more
	// dangerous than what classifyToolEvent can see (the sink layer
	// only matches resolved paths/urls; the keystone matches surface
	// indicators on commands we couldn't statically resolve).
	if (input.parsedCommand && tainted) {
		const indicators = collectIndicators(input.parsedCommand);
		if (indicators.length > 0 && hasUnknownNode(input.parsedCommand)) {
			const indKinds = Array.from(new Set(indicators.map((i) => i.kind))).join(
				", ",
			);
			return {
				verdict: "deny",
				reason: `Unparseable shell with sink indicator(s) [${indKinds}] under active taint — refusing to proceed`,
				rule: "bash_unknown_indicator_taint",
			};
		}
	}

	// Rule 3: any sink classifier match marked deny.
	const denyMatch = firstWithSeverity(input.sinkMatches, "deny");
	if (denyMatch) {
		return {
			verdict: "deny",
			reason: denyMatch.reason,
			rule: "sink_deny",
		};
	}

	// Rule 4: any sink classifier match marked approval_required. Until
	// commit 9 lands `patchwork approve`, this surfaces as a deny with a
	// clear reason. The verdict is "approval_required" so the audit log
	// distinguishes the two — the hook-to-Claude translation collapses
	// both to a permissionDecision:"deny" with different reason strings.
	const approvalMatch = firstWithSeverity(
		input.sinkMatches,
		"approval_required",
	);
	if (approvalMatch) {
		return {
			verdict: "approval_required",
			reason: approvalMatch.reason,
			rule: "sink_approval_required",
		};
	}

	// Rule 5: default allow. Advisory sink matches do not block here;
	// they only feed the taint engine via the PostToolUse path.
	return {
		verdict: "allow",
		reason: "no rule blocks this action",
		rule: "default_allow",
	};
}
