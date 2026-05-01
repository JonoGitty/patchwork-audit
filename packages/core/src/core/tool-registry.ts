import type { SafetyMode } from "./tool-event.js";

/**
 * Per-tool metadata describing how Patchwork must behave for each Claude Code
 * tool. The registry is the single source of truth consumed by:
 *   - the PreToolUse / PostToolUse hooks (decide which phases to handle)
 *   - the sink classifier (decide which tools can register sinks at all)
 *   - the taint engine (decide which tool outputs register taint)
 *   - `docs/hook-coverage.md` (generated from this table)
 *   - the invariant test (asserts no tool ships without explicit coverage)
 *
 * If a tool is not in this registry and the safety mode is `enforce`,
 * Patchwork fails closed. This closes the unknown-tool bypass: an attacker
 * can't add a new tool to the agent's manifest and have it skip Patchwork.
 */

export interface ToolRegistryEntry {
	/** Stable Claude Code tool name (e.g. "Bash", "WebFetch"). MCP tools use
	 *  the `mcp:<server>:<tool>` shape; the bare `mcp:` prefix matches all. */
	tool: string;

	/** Human-readable description for the generated coverage doc. */
	description: string;

	/** Whether Patchwork hooks observe this tool's PreToolUse phase. */
	pre_guarded: boolean;

	/** Whether Patchwork hooks observe this tool's PostToolUse phase. */
	post_logged: boolean;

	/** Whether this tool's output can register taint into the session.
	 *  Populated in commit 3 (taint engine); declared here so the registry
	 *  is the durable source of truth. */
	taint_source: boolean;

	/** Whether this tool can drive a sensitive sink (Write/Edit/Bash etc).
	 *  Populated in commit 2 (sink taxonomy). */
	sink_eligible: boolean;

	/** Default safety mode for this tool's checks at v0.6.11 ship.
	 *  Per design 3.7: high-confidence sinks default to enforce. */
	default_mode: SafetyMode;

	/** Behavior when a hook for this tool throws or times out. Always
	 *  fail-closed for tools that can drive sinks; advisory for read-only
	 *  observers where a hook crash should not break the user's session. */
	hook_failure: "fail_closed" | "fail_open_with_audit";

	/** Behavior when the hook payload is malformed (e.g. unknown schema
	 *  fields, missing required field). Always fail-closed for sink-eligible
	 *  tools. */
	malformed_payload: "fail_closed" | "fail_open_with_audit";

	/** Hook execution timeout in ms. Hooks exceeding this trip
	 *  `hook_failure` behavior. */
	timeout_ms: number;
}

/**
 * Wildcard matcher entries. Used for MCP tools where the per-server / per-tool
 * names are not known statically — `mcp:` matches any tool whose name starts
 * with the prefix. The registry lookup function below walks exact entries
 * first, then prefix entries.
 */
const TOOL_REGISTRY_ENTRIES: ToolRegistryEntry[] = [
	{
		tool: "Bash",
		description: "Shell command execution. Highest-risk surface — all sink classes can route through it.",
		pre_guarded: true,
		post_logged: true,
		taint_source: true,
		sink_eligible: true,
		default_mode: "enforce",
		hook_failure: "fail_closed",
		malformed_payload: "fail_closed",
		timeout_ms: 5000,
	},
	{
		tool: "Read",
		description: "File read. Source of `prompt` taint for untrusted-content paths and `secret` taint for credential-class paths.",
		pre_guarded: true,
		post_logged: true,
		taint_source: true,
		sink_eligible: false,
		default_mode: "enforce",
		hook_failure: "fail_closed",
		malformed_payload: "fail_closed",
		timeout_ms: 3000,
	},
	{
		tool: "Write",
		description: "File write. First-class sink for `claude_file_write_persistence` (shell rc, git hooks, CI config, etc).",
		pre_guarded: true,
		post_logged: true,
		taint_source: false,
		sink_eligible: true,
		default_mode: "enforce",
		hook_failure: "fail_closed",
		malformed_payload: "fail_closed",
		timeout_ms: 3000,
	},
	{
		tool: "Edit",
		description: "Single-file edit. Same sink class as Write.",
		pre_guarded: true,
		post_logged: true,
		taint_source: false,
		sink_eligible: true,
		default_mode: "enforce",
		hook_failure: "fail_closed",
		malformed_payload: "fail_closed",
		timeout_ms: 3000,
	},
	{
		tool: "MultiEdit",
		description: "Multi-edit on a single file. Same sink class as Write.",
		pre_guarded: true,
		post_logged: true,
		taint_source: false,
		sink_eligible: true,
		default_mode: "enforce",
		hook_failure: "fail_closed",
		malformed_payload: "fail_closed",
		timeout_ms: 3000,
	},
	{
		tool: "NotebookEdit",
		description: "Jupyter notebook cell edit. Same sink class as Write.",
		pre_guarded: true,
		post_logged: true,
		taint_source: false,
		sink_eligible: true,
		default_mode: "enforce",
		hook_failure: "fail_closed",
		malformed_payload: "fail_closed",
		timeout_ms: 3000,
	},
	{
		tool: "WebFetch",
		description: "External HTTP fetch. Source of `network_content` and `prompt` taint; also subject to network egress allowlist.",
		pre_guarded: true,
		post_logged: true,
		taint_source: true,
		sink_eligible: true,
		default_mode: "enforce",
		hook_failure: "fail_closed",
		malformed_payload: "fail_closed",
		timeout_ms: 3000,
	},
	{
		tool: "WebSearch",
		description: "External search. Result content registers `network_content` taint at PostToolUse.",
		pre_guarded: false,
		post_logged: true,
		taint_source: true,
		sink_eligible: false,
		default_mode: "advisory",
		hook_failure: "fail_open_with_audit",
		malformed_payload: "fail_open_with_audit",
		timeout_ms: 3000,
	},
	{
		tool: "Glob",
		description: "Filesystem glob. Read-only listing; no taint registration in v0.6.11.",
		pre_guarded: false,
		post_logged: true,
		taint_source: false,
		sink_eligible: false,
		default_mode: "advisory",
		hook_failure: "fail_open_with_audit",
		malformed_payload: "fail_open_with_audit",
		timeout_ms: 3000,
	},
	{
		tool: "Grep",
		description: "Filesystem grep. Read-only; no taint registration in v0.6.11 (matched lines are arguably untrusted but tracking that is deferred to v0.6.12).",
		pre_guarded: false,
		post_logged: true,
		taint_source: false,
		sink_eligible: false,
		default_mode: "advisory",
		hook_failure: "fail_open_with_audit",
		malformed_payload: "fail_open_with_audit",
		timeout_ms: 3000,
	},
	{
		tool: "TodoWrite",
		description: "Internal todo-list updates. No filesystem or network effect.",
		pre_guarded: false,
		post_logged: true,
		taint_source: false,
		sink_eligible: false,
		default_mode: "advisory",
		hook_failure: "fail_open_with_audit",
		malformed_payload: "fail_open_with_audit",
		timeout_ms: 1000,
	},
	{
		tool: "Task",
		description: "Subagent spawn. The subagent runs its own session — Patchwork does not currently propagate parent-session taint into the child (deferred to v0.7.0).",
		pre_guarded: true,
		post_logged: true,
		taint_source: false,
		sink_eligible: false,
		default_mode: "advisory",
		hook_failure: "fail_closed",
		malformed_payload: "fail_closed",
		timeout_ms: 5000,
	},
	{
		tool: "ExitPlanMode",
		description: "Plan-mode exit signal. No effect on filesystem or network.",
		pre_guarded: false,
		post_logged: false,
		taint_source: false,
		sink_eligible: false,
		default_mode: "advisory",
		hook_failure: "fail_open_with_audit",
		malformed_payload: "fail_open_with_audit",
		timeout_ms: 1000,
	},
];

const TOOL_REGISTRY = new Map<string, ToolRegistryEntry>(
	TOOL_REGISTRY_ENTRIES.map((e) => [e.tool, e]),
);

/**
 * MCP tools are registered by prefix. Any `mcp:<server>:<tool>` lookup that
 * doesn't match an exact entry falls back to this. Per design 3.3, ALL MCP
 * responses are tainted by default (`mcp` and `prompt` kinds), and any MCP
 * tool that drives filesystem/network/command effects is sink-eligible.
 */
const MCP_PREFIX_ENTRY: ToolRegistryEntry = {
	tool: "mcp:",
	description: "MCP server tool (any). Default-untrusted: response registers `mcp` and `prompt` taint. MCP tools that drive filesystem/network/command effects are sink-eligible.",
	pre_guarded: true,
	post_logged: true,
	taint_source: true,
	sink_eligible: true,
	default_mode: "enforce",
	hook_failure: "fail_closed",
	malformed_payload: "fail_closed",
	timeout_ms: 5000,
};

/**
 * Look up registry coverage for a tool name. Returns `undefined` if the tool
 * is not covered — callers in enforce mode MUST fail-closed on undefined per
 * the unknown-tool invariant (release-gate scenario 14 in DESIGN/v0.6.11.md).
 */
export function lookupToolRegistry(tool: string): ToolRegistryEntry | undefined {
	const exact = TOOL_REGISTRY.get(tool);
	if (exact) return exact;
	if (tool.startsWith("mcp:") || tool.startsWith("mcp__")) return MCP_PREFIX_ENTRY;
	return undefined;
}

/** Read-only view of every exact-match entry. Used by the docs generator and
 *  the invariant test. MCP prefix matcher is exposed separately. */
export function listToolRegistry(): readonly ToolRegistryEntry[] {
	return TOOL_REGISTRY_ENTRIES;
}

/** The MCP prefix entry, exposed for docs generation. */
export function getMcpPrefixEntry(): ToolRegistryEntry {
	return MCP_PREFIX_ENTRY;
}
