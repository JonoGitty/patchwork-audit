import { lookupToolRegistry } from "./tool-registry.js";
import type { ToolEvent, ToolPhase, SafetyMode } from "./tool-event.js";

/**
 * v0.6.11 policy version stamp embedded into every normalized ToolEvent.
 * Bumped whenever the registry, sink taxonomy, or taint rules change in a
 * way that an approval token bound to the old version must NOT validate
 * against. Approval tokens are bound to this string per design 3.6.
 */
export const POLICY_VERSION = "v0.6.11-pre.1";

export interface NormalizeInput {
	tool: string;
	phase: ToolPhase;
	cwd: string;
	project_root: string;
	raw_input: unknown;
	safety_mode: SafetyMode;
}

export interface NormalizeResult {
	event: ToolEvent;
	covered: boolean;
	fail_closed: boolean;
	failure_reason?: string;
}

/**
 * Build a canonical `ToolEvent` from minimal hook input. This is the entry
 * point every PreToolUse and PostToolUse handler routes through before any
 * sink-specific logic runs. v0.6.11 commit 1 only fills the always-present
 * fields (tool, phase, cwd, project_root, raw_input, policy_version) and
 * returns coverage metadata. Later commits enrich the event with parsed
 * commands, resolved paths/URLs/remotes, taint state, and content hashes.
 *
 * The `fail_closed` flag is the load-bearing output: if the registry has no
 * entry for the tool and safety mode is `enforce`, the caller MUST refuse
 * the action. This closes the unknown-tool bypass — a future Claude release
 * adding a new tool can't silently sidestep Patchwork's safety layer.
 */
export function normalizeToolEvent(input: NormalizeInput): NormalizeResult {
	const entry = lookupToolRegistry(input.tool);

	const event: ToolEvent = {
		tool: input.tool,
		phase: input.phase,
		cwd: input.cwd,
		project_root: input.project_root,
		raw_input: input.raw_input,
		target_paths: [],
		resolved_paths: [],
		urls: [],
		hosts: [],
		policy_version: POLICY_VERSION,
	};

	if (!entry) {
		return {
			event,
			covered: false,
			fail_closed: input.safety_mode === "enforce",
			failure_reason: `unknown tool '${input.tool}' — not registered in tool-registry.ts; enforce mode requires explicit coverage`,
		};
	}

	const phaseCovered =
		(input.phase === "pre" && entry.pre_guarded) ||
		(input.phase === "post" && entry.post_logged);

	if (!phaseCovered) {
		return {
			event,
			covered: false,
			fail_closed: false,
			failure_reason: `tool '${input.tool}' is registered but does not declare coverage for phase '${input.phase}'`,
		};
	}

	return { event, covered: true, fail_closed: false };
}
