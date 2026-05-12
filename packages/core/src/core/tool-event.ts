import { z } from "zod";

/**
 * Canonical event shape consumed by every v0.6.11+ safety subsystem (taint
 * engine, sink classifier, network policy, approval flow). PreToolUse and
 * PostToolUse hooks both normalize their input into a `ToolEvent` before any
 * sink-specific logic runs — this keeps every later check working from one
 * known-shape input regardless of which Claude Code tool fired the hook.
 *
 * v0.6.11 commit 1 lands the type, the tool registry, and the invariant test.
 * The richer fields (parsed_command, taint_state, resolved_paths, etc.) are
 * carried as optional here so later commits can populate them without
 * reshaping the event.
 */

export const ToolPhase = z.enum(["pre", "post"]);
export type ToolPhase = z.infer<typeof ToolPhase>;

export const SafetyMode = z.enum(["advisory", "enforce"]);
export type SafetyMode = z.infer<typeof SafetyMode>;

export const ParseConfidence = z.enum(["high", "low", "unknown"]);
export type ParseConfidence = z.infer<typeof ParseConfidence>;

export const TaintKind = z.enum([
	"prompt",
	"secret",
	"network_content",
	"mcp",
	"generated_file",
]);
export type TaintKind = z.infer<typeof TaintKind>;

/**
 * `TaintKind` is declared above; we re-state the literal union here as a Zod
 * schema for the optional `cleared.scope` field on a `TaintSource`. Keeping
 * it inline (rather than re-importing TaintKind) avoids a circular schema
 * definition and keeps the source-of-truth in this file.
 */
const TaintKindEnumSchema = TaintKind;

/**
 * `cleared` records out-of-band declassification. The taint engine in
 * `src/taint/` sets this when the user runs `patchwork clear-taint`
 * (commit 9). Sources are NEVER removed from the snapshot — they are
 * marked cleared so the audit trail remains intact and a stale
 * declassification can be diffed against the current chain. Query helpers
 * filter cleared sources out of "active" results by default.
 */
const TaintClearedSchema = z.object({
	ts: z.number(),
	method: z.enum(["out_of_band", "config_trusted"]),
	scope: z.array(TaintKindEnumSchema),
});

const TaintSourceSchema = z.object({
	ts: z.number(),
	ref: z.string(),
	content_hash: z.string(),
	cleared: TaintClearedSchema.optional(),
});
export type TaintSource = z.infer<typeof TaintSourceSchema>;

export const TaintSnapshotSchema = z.object({
	session_id: z.string(),
	by_kind: z.record(z.string(), z.array(TaintSourceSchema)),
	generated_files: z.record(z.string(), z.array(TaintSourceSchema)).default({}),
});
export type TaintSnapshot = z.infer<typeof TaintSnapshotSchema>;

export interface ParsedCommand {
	argv: string[] | "unresolved";
	env: Record<string, string>;
	redirects: unknown[];
	children?: ParsedCommand[];
	raw: string;
	confidence: ParseConfidence;
	sink_indicators: string[];
}

const ParsedCommandSchema: z.ZodType<ParsedCommand, z.ZodTypeDef, unknown> = z.lazy(() =>
	z.object({
		argv: z.union([z.array(z.string()), z.literal("unresolved")]),
		env: z.record(z.string(), z.string()).default({}),
		redirects: z.array(z.unknown()).default([]),
		children: z.array(ParsedCommandSchema).optional(),
		raw: z.string(),
		confidence: ParseConfidence,
		sink_indicators: z.array(z.string()).default([]),
	}),
);

export const ToolEventSchema = z.object({
	tool: z.string(),
	phase: ToolPhase,
	cwd: z.string(),
	project_root: z.string(),
	raw_input: z.unknown(),
	parsed_command: ParsedCommandSchema.optional(),
	parse_confidence: ParseConfidence.optional(),
	env_delta: z.record(z.string(), z.string()).optional(),
	stdin_hash: z.string().optional(),
	target_paths: z.array(z.string()).default([]),
	resolved_paths: z.array(z.string()).default([]),
	urls: z.array(z.string()).default([]),
	hosts: z.array(z.string()).default([]),
	git_remotes: z
		.array(
			z.object({
				name: z.string(),
				url: z.string(),
				resolved_via: z.enum(["argv", "config"]),
			}),
		)
		.optional(),
	content_hashes: z.record(z.string(), z.string()).optional(),
	taint_state: TaintSnapshotSchema.optional(),
	policy_version: z.string(),
});
export type ToolEvent = z.infer<typeof ToolEventSchema>;
