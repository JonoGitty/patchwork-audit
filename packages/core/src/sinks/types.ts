/**
 * Sensitive-sink taxonomy for v0.6.11 taint-aware policy enforcement.
 *
 * A "sink" is any tool action that, in a tainted context, an attacker could
 * weaponize for exfiltration, persistence, or supply-chain mutation. The
 * classifier in `classify.ts` takes a normalized `ToolEvent` plus the
 * current taint state and returns the set of sink classes the event
 * matches, with per-class severity.
 *
 * v0.6.11 ships two sink classes (this commit):
 *   - claude_file_write_persistence  (Write/Edit/MultiEdit/NotebookEdit
 *                                     into shell-rc / git-hook / CI-config /
 *                                     ssh-config / etc. paths)
 *   - secret_read                    (Read of credential-class files;
 *                                     no immediate block — labels for the
 *                                     taint engine in commit 3)
 *
 * Remaining sink classes from DESIGN/v0.6.11.md §3.2 (pipe_to_shell,
 * direct_secret_to_network, allowed_saas_upload, configured_remote_network,
 * network_egress_off_allowlist, package_lifecycle, interpreter_eval_with_network,
 * generated_file_execute) need the shell recognizer (commit 4) before they
 * can be classified safely. They are declared in this enum so the
 * classifier API is stable across commits.
 */

export const SINK_CLASSES = [
	"claude_file_write_persistence",
	"secret_read",
	"pipe_to_shell",
	"direct_secret_to_network",
	"allowed_saas_upload",
	"configured_remote_network",
	"network_egress_off_allowlist",
	"package_lifecycle",
	"interpreter_eval_with_network",
	"generated_file_execute",
] as const;

export type SinkClass = (typeof SINK_CLASSES)[number];

/**
 * Per-match severity. Maps onto the enforcement decision the PreToolUse
 * handler will make in commit 8 (deny → 2 = block; approval_required →
 * `patchwork approve` flow; advisory → log only).
 */
export type SinkSeverity = "advisory" | "approval_required" | "deny";

export interface SinkMatch {
	/** Which sink class matched. */
	class: SinkClass;
	/** Decision severity for this specific match. Per design 3.7 the same
	 *  sink class can land on different severities depending on taint state
	 *  (e.g. `claude_file_write_persistence` is `deny` under taint and
	 *  `approval_required` untainted). */
	severity: SinkSeverity;
	/** Human-readable reason — surfaced in audit log + denial message. */
	reason: string;
	/** The specific path that triggered the match (for path-based sinks). */
	matched_path?: string;
	/** The pattern that matched (for debugging + audit). */
	matched_pattern: string;
}
