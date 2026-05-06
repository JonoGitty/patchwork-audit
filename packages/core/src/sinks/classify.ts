/**
 * Sink classifier — pure predicate over a normalized `ToolEvent` plus the
 * current taint snapshot. Returns the set of sink classes the event matches
 * with per-class severity.
 *
 * v0.6.11 commit 2 ships only the **Claude-native** sink classes that don't
 * need a shell parser:
 *
 *   - `claude_file_write_persistence`  Write/Edit/MultiEdit/NotebookEdit into
 *                                      shell-rc, git-hook, CI, ssh, launchd,
 *                                      systemd, direnv, editor-tasks paths.
 *                                      Deny under any taint; approval_required
 *                                      untainted (per design §3.2 + §3.7).
 *
 *   - `secret_read`                    Read of credential-class paths. No
 *                                      immediate block — registers `secret`
 *                                      taint (commit 3 wires that). Severity
 *                                      is `advisory` here so the audit log
 *                                      records the read without breaking the
 *                                      flow (`gh auth status`, etc.).
 *
 * Bash-mediated equivalents (`cat ~/.aws/credentials`, `tee .git/hooks/pre-commit`)
 * are deferred to commits 4 + 7 — they require the conservative shell
 * recognizer to extract redirect targets and read paths, and need taint
 * routing through `parsed_command`.
 *
 * Network-class sinks (pipe_to_shell, configured_remote_network,
 * allowed_saas_upload, etc.) are deferred to commit 5 (URL canonicalization)
 * + commit 4 (shell recognizer).
 *
 * GPT round-4 watch-out #2 (read/write/execute roles per path): this file
 * already encodes role via tool name. A `Write` to `.bashrc` is persistence,
 * a `Read` of `.bashrc` is not. The Bash-side equivalent (commit 4+) will
 * carry per-path roles in `ParsedCommand` so `cat x > y; bash y` doesn't
 * double-count `y` as both write-target and read-target.
 *
 * GPT round-4 watch-out #6 (parser failure paths): N/A here — this commit
 * does no parsing. Bash events are skipped for sink classification at this
 * commit (sink_eligible: true in the registry, but no rules fire on them
 * yet). The integration handler in commit 8 will treat
 * `parse_confidence: "unknown"` + sink-suggestive tokens as deny under taint.
 */

import picomatch from "picomatch";
import type { ToolEvent, TaintSnapshot } from "../core/tool-event.js";
import { PERSISTENCE_PATTERNS, expandHomePattern } from "./persistence-paths.js";
import { SECRET_PATTERNS } from "./secret-paths.js";
import type { SinkMatch } from "./types.js";

/** Tools whose target_paths drive the persistence-class sink. */
const CLAUDE_NATIVE_WRITE_TOOLS = new Set([
	"Write",
	"Edit",
	"MultiEdit",
	"NotebookEdit",
]);

/** Tools that drive read-class sinks for the taint engine. */
const CLAUDE_NATIVE_READ_TOOLS = new Set(["Read"]);

/**
 * Picomatch options shared across both pattern groups. Case-insensitive
 * because case-folding filesystems exist (HFS+ / APFS default / NTFS).
 * `dot: true` so patterns like `~/.ssh/**` match files starting with a dot.
 */
const MATCH_OPTS: picomatch.PicomatchOptions = {
	nocase: true,
	dot: true,
};

interface CompiledPattern {
	matcher: (path: string) => boolean;
	rawPattern: string;
	expandedPattern: string;
	label: string;
}

function compilePatterns(
	patterns: readonly { pattern: string; label: string }[],
): CompiledPattern[] {
	return patterns.map((p) => {
		const expanded = expandHomePattern(p.pattern);
		const matcher = picomatch(expanded, MATCH_OPTS);
		return {
			matcher,
			rawPattern: p.pattern,
			expandedPattern: expanded,
			label: p.label,
		};
	});
}

const PERSISTENCE_MATCHERS: CompiledPattern[] = compilePatterns(
	PERSISTENCE_PATTERNS,
);
const SECRET_MATCHERS: CompiledPattern[] = compilePatterns(SECRET_PATTERNS);

/**
 * Pick the canonical paths to evaluate. Per GPT round-4 watch-out #9 we
 * prefer `resolved_paths` (realpath chain set by the PostToolUse handler in
 * commit 7) over `target_paths` so symlink games can't bypass. If
 * `resolved_paths` is empty we fall back to `target_paths` — but the
 * fallback is itself a sign we're in a pre-commit-7 / partial-event
 * situation, and the commit-8 integration layer treats that as fail-closed
 * under taint.
 */
function pathsToEvaluate(event: ToolEvent): string[] {
	if (event.resolved_paths && event.resolved_paths.length > 0) {
		return event.resolved_paths;
	}
	return event.target_paths ?? [];
}

function findFirstMatch(
	matchers: CompiledPattern[],
	candidatePaths: string[],
): { path: string; pattern: CompiledPattern } | null {
	for (const path of candidatePaths) {
		for (const m of matchers) {
			if (m.matcher(path)) {
				return { path, pattern: m };
			}
		}
	}
	return null;
}

/**
 * Whether the snapshot has *any* taint kind active. Used as a single flip
 * for severity (`deny` vs `approval_required`) on the persistence sink.
 * The taint engine's clear-taint API (commit 3) is responsible for clearing
 * `by_kind` entries when the user runs `patchwork clear-taint`; we just
 * read whatever the snapshot currently says.
 */
function hasAnyTaint(snapshot: TaintSnapshot | undefined): boolean {
	if (!snapshot) return false;
	for (const kind of Object.keys(snapshot.by_kind)) {
		const sources = snapshot.by_kind[kind];
		if (sources && sources.length > 0) return true;
	}
	return false;
}

/**
 * Classify the Claude-native persistence sink for Write/Edit/MultiEdit/
 * NotebookEdit. Returns at most one match (first persistence path wins —
 * the persistence patterns are ordered most-specific-first so the first
 * match yields the most informative label).
 */
function classifyPersistence(event: ToolEvent): SinkMatch | null {
	if (!CLAUDE_NATIVE_WRITE_TOOLS.has(event.tool)) return null;
	const paths = pathsToEvaluate(event);
	if (paths.length === 0) return null;
	const hit = findFirstMatch(PERSISTENCE_MATCHERS, paths);
	if (!hit) return null;
	const tainted = hasAnyTaint(event.taint_state);
	return {
		class: "claude_file_write_persistence",
		severity: tainted ? "deny" : "approval_required",
		reason: tainted
			? `Write to persistence path under active taint: ${hit.pattern.label}`
			: `Write to persistence path requires out-of-band approval: ${hit.pattern.label}`,
		matched_path: hit.path,
		matched_pattern: hit.pattern.rawPattern,
	};
}

/**
 * Classify Claude-native `Read` of credential-class paths. Severity is
 * `advisory` — the read itself is not blocked. The taint engine in commit 3
 * subscribes to the same paths to register `secret` taint, and the
 * `direct_secret_to_network` sink (commit 4 + 8) is what actually blocks
 * the exfiltration step.
 */
function classifySecretRead(event: ToolEvent): SinkMatch | null {
	if (!CLAUDE_NATIVE_READ_TOOLS.has(event.tool)) return null;
	const paths = pathsToEvaluate(event);
	if (paths.length === 0) return null;
	const hit = findFirstMatch(SECRET_MATCHERS, paths);
	if (!hit) return null;
	return {
		class: "secret_read",
		severity: "advisory",
		reason: `Read of credential-class path: ${hit.pattern.label}`,
		matched_path: hit.path,
		matched_pattern: hit.pattern.rawPattern,
	};
}

/**
 * Public classifier entry point. Iterates over the v0.6.11 commit-2 sink
 * predicates and returns all matches. Order is stable: persistence first,
 * then secret-read. The PreToolUse integration in commit 8 will combine
 * these matches with severity into a single allow / approval_required /
 * deny decision per design §3.7.
 */
export function classifyToolEvent(event: ToolEvent): SinkMatch[] {
	const matches: SinkMatch[] = [];
	const persistence = classifyPersistence(event);
	if (persistence) matches.push(persistence);
	const secretRead = classifySecretRead(event);
	if (secretRead) matches.push(secretRead);
	return matches;
}

/**
 * Convenience: the highest-severity match in a result list, or null if
 * empty. Severity ranking matches the enforcement decision tree:
 *   deny > approval_required > advisory.
 *
 * Used by the audit logger to pick the headline reason when multiple sinks
 * fire on a single event.
 */
export function highestSeverity(matches: SinkMatch[]): SinkMatch | null {
	if (matches.length === 0) return null;
	const rank: Record<SinkMatch["severity"], number> = {
		advisory: 0,
		approval_required: 1,
		deny: 2,
	};
	let best = matches[0];
	for (let i = 1; i < matches.length; i++) {
		if (rank[matches[i].severity] > rank[best.severity]) {
			best = matches[i];
		}
	}
	return best;
}
