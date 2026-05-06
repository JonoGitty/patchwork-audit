/**
 * Multi-kind taint state engine — pure, in-memory, immutable.
 *
 * Each session gets its own `TaintSnapshot`. The PostToolUse handler
 * (commit 7) calls `registerTaint` / `registerGeneratedFile` after a tool
 * runs to record what entered the session's context. The PreToolUse
 * sink classifier (commits 2 + 4) reads the snapshot to decide severity.
 * The CLI (commit 9) calls `clearTaint` when the user runs
 * `patchwork clear-taint` from their TTY.
 *
 * v0.6.11 keeps the snapshot in process memory — persistence across
 * sessions is the v0.6.12 follow-up. Every operation here returns a NEW
 * snapshot rather than mutating in place; the cost is trivial (small
 * arrays of pointer-sized records) and immutable updates make it
 * impossible for a tool handler to corrupt another's view of the state.
 *
 * Design references:
 *   - §3.3 (taint state engine, declassification rules)
 *   - §3.7 (severity table — engine doesn't enforce, just reports state)
 *   - GPT round-4 watch-out #4 (declassification can never come from the
 *     agent — the engine doesn't expose a way for in-session callers to
 *     clear taint without `out_of_band` or `config_trusted` method tags)
 *   - GPT round-4 watch-out #9 (generated_file path identity — keys are
 *     the realpath/canonical path; callers must pass realpath'd paths)
 *
 * What this module does NOT do:
 *   - Decide *which* tool events raise *which* taint kinds — that's
 *     wiring in commit 7 (`@patchwork/agents` PostToolUse handler), which
 *     uses `RAISES_FOR_TOOL` below as data.
 *   - Enforce or block anything — sink classifier + integration handler.
 *   - Persist anything to disk.
 *   - Run shell parsing — generated-file taint via Bash redirection
 *     comes from the conservative recognizer (commit 4) which extracts
 *     redirect targets and feeds them to `registerGeneratedFile`.
 */

import type {
	TaintKind,
	TaintSnapshot,
	TaintSource,
} from "../core/tool-event.js";

/** All five taint kinds in declaration order. */
export const ALL_TAINT_KINDS: readonly TaintKind[] = [
	"prompt",
	"secret",
	"network_content",
	"mcp",
	"generated_file",
];

/**
 * Mapping from tool name to the taint kinds its PostToolUse output
 * registers (per design §3.3). Agents handler in commit 7 consumes this.
 *
 * Notes:
 *   - `Read` raises `prompt` only when the path is classified as
 *     untrusted (see `isPathUntrustedRepo` below) — this table records
 *     the maximum surface; the handler narrows.
 *   - `Read` raises `secret` only when the path matches `secret_read`
 *     sink patterns — same caveat.
 *   - `Bash` outputs that include `curl`/`wget` results raise
 *     `network_content` + `prompt`; that subset detection requires
 *     the shell recognizer (commit 4) and is therefore left as the empty
 *     set here. The handler in commit 7 will compose this table with
 *     parser output to make the actual decision.
 *   - MCP entries are matched by prefix (`mcp:`) — the handler does that.
 */
export const RAISES_FOR_TOOL: Readonly<Record<string, readonly TaintKind[]>> = {
	WebFetch: ["network_content", "prompt"],
	WebSearch: ["network_content", "prompt"],
	"mcp:": ["mcp", "prompt"],
	Read: ["prompt", "secret"],
	Bash: [],
	Write: ["generated_file"],
	Edit: ["generated_file"],
	MultiEdit: ["generated_file"],
	NotebookEdit: ["generated_file"],
};

/**
 * Repo-path patterns that are ALWAYS treated as untrusted, even if the
 * user's `trusted_paths:` config tries to whitelist a parent directory.
 * Source: design §3.3 default-untrusted list. Picomatch globs.
 *
 * Rationale: README/CHANGELOG/docs/examples are written in human prose
 * which is the canonical place hostile instructions arrive. node_modules,
 * vendor and dist are mostly third-party / generated and shouldn't be
 * trusted just because they live in the repo.
 */
export const FORCE_UNTRUSTED_PATTERNS: readonly string[] = [
	"**/README*",
	"README*",
	"docs/**",
	"**/docs/**",
	"examples/**",
	"**/examples/**",
	"tests/fixtures/**",
	"**/tests/fixtures/**",
	"**/.changeset/*",
	"CHANGELOG*",
	"**/CHANGELOG*",
	"node_modules/**",
	"**/node_modules/**",
	"vendor/**",
	"**/vendor/**",
	"dist/**",
	"**/dist/**",
	"build/**",
	"**/build/**",
];

/**
 * Constructor. Returns an empty per-session snapshot. The `by_kind`
 * record is dense — every kind gets an empty array — so callers can
 * read `snapshot.by_kind.prompt` without an undefined check.
 */
export function createSnapshot(sessionId: string): TaintSnapshot {
	const by_kind: Record<string, TaintSource[]> = {};
	for (const kind of ALL_TAINT_KINDS) {
		by_kind[kind] = [];
	}
	return {
		session_id: sessionId,
		by_kind,
		generated_files: {},
	};
}

/**
 * Add a taint source for a given kind. Returns a new snapshot. The
 * `cleared` field on the new source must be unset — clearing happens
 * exclusively through `clearTaint`, which sets the `cleared` field on
 * existing sources rather than letting callers seed cleared records.
 */
export function registerTaint(
	snapshot: TaintSnapshot,
	kind: TaintKind,
	source: Omit<TaintSource, "cleared">,
): TaintSnapshot {
	// Defensive runtime check for non-TS callers — the type forbids it
	// but a JS caller could still pass the field through.
	if ((source as Partial<TaintSource>).cleared !== undefined) {
		throw new Error(
			"registerTaint: cleared field is reserved for clearTaint",
		);
	}
	const next = cloneSnapshot(snapshot);
	const list = next.by_kind[kind] ?? [];
	next.by_kind[kind] = [...list, { ...source }];
	return next;
}

/**
 * Tag a written file with `generated_file` provenance. The provenance
 * is the LIST of currently-active taint sources at the time of write —
 * so a file written while both `prompt` and `network_content` were
 * active records both upstream sources.
 *
 * `path` MUST be the canonical/realpath path (GPT round-4 watch-out #9).
 * Symlink resolution is the caller's responsibility.
 */
export function registerGeneratedFile(
	snapshot: TaintSnapshot,
	path: string,
	upstreamSources: readonly TaintSource[],
): TaintSnapshot {
	const next = cloneSnapshot(snapshot);
	const existing = next.generated_files[path] ?? [];
	const filteredUpstream = upstreamSources
		.filter((s) => !s.cleared)
		.map((s) => ({ ts: s.ts, ref: s.ref, content_hash: s.content_hash }));
	next.generated_files[path] = [...existing, ...filteredUpstream];
	// generated_file is also a taint kind; mirror the path-anchored
	// sources into by_kind so existing-taint queries see it.
	next.by_kind.generated_file = [
		...(next.by_kind.generated_file ?? []),
		...filteredUpstream.map((s) => ({ ...s, ref: path })),
	];
	return next;
}

export interface ClearTaintOptions {
	/** Clearance method, written into the `cleared.method` audit field. */
	method: "out_of_band" | "config_trusted";
	/** Wall-clock timestamp the clearance was authorized. */
	ts: number;
	/**
	 * Required when clearing `secret`. The `patchwork clear-taint` CLI
	 * must pass `--allow-secret-clear` to flip this on. Default false
	 * means a `secret` clearance is rejected without explicit opt-in.
	 */
	allowSecretClear?: boolean;
}

/**
 * Mark all currently-active sources of `kind` as cleared.
 *
 *   - Sources stay in `by_kind[kind]` (audit trail preserved); the
 *     `cleared` field is added per design §3.3.
 *   - `secret` is rejected unless `allowSecretClear: true`.
 *   - `generated_file` clearance only marks the kind's by_kind entries
 *     and does NOT remove path entries from `generated_files` —
 *     declassifying after-the-fact doesn't undo that the file came from
 *     a tainted process. Callers that want to forget a specific path
 *     should use `forgetGeneratedFile` instead.
 *
 * Returns a new snapshot. Throws on disallowed `secret` clearance — the
 * CLI surfaces this to the user as "use --allow-secret-clear".
 */
export function clearTaint(
	snapshot: TaintSnapshot,
	kind: TaintKind,
	opts: ClearTaintOptions,
): TaintSnapshot {
	if (kind === "secret" && !opts.allowSecretClear) {
		throw new Error(
			"clearTaint: secret kind requires allowSecretClear=true",
		);
	}
	const next = cloneSnapshot(snapshot);
	const list = next.by_kind[kind] ?? [];
	next.by_kind[kind] = list.map((src) =>
		src.cleared
			? src
			: {
					...src,
					cleared: {
						ts: opts.ts,
						method: opts.method,
						scope: [kind],
					},
				},
	);
	return next;
}

/**
 * Drop a path from `generated_files`. Used when the user explicitly
 * removes a file that was written from a tainted context (e.g. `rm
 * installer.sh` followed by `patchwork forget-generated installer.sh`).
 * The path's by_kind generated_file entries are also tombstoned via
 * `cleared`.
 *
 * This is separate from `clearTaint("generated_file")` because path-
 * scoped forgetting is a finer-grained operation than blanket
 * declassification of the kind.
 */
export function forgetGeneratedFile(
	snapshot: TaintSnapshot,
	path: string,
	opts: { ts: number; method: "out_of_band" | "config_trusted" },
): TaintSnapshot {
	const next = cloneSnapshot(snapshot);
	delete next.generated_files[path];
	next.by_kind.generated_file = (next.by_kind.generated_file ?? []).map(
		(src) =>
			src.ref === path && !src.cleared
				? {
						...src,
						cleared: {
							ts: opts.ts,
							method: opts.method,
							scope: ["generated_file"],
						},
					}
				: src,
	);
	return next;
}

/**
 * True if any kind has at least one non-cleared source. The
 * persistence-sink severity flip in commit 2 already calls a local
 * shim — that shim should migrate to this once the engine wires in.
 */
export function hasAnyTaint(snapshot: TaintSnapshot): boolean {
	for (const kind of ALL_TAINT_KINDS) {
		if (hasKind(snapshot, kind)) return true;
	}
	return false;
}

/** True if the given kind has at least one non-cleared source. */
export function hasKind(snapshot: TaintSnapshot, kind: TaintKind): boolean {
	const list = snapshot.by_kind[kind] ?? [];
	return list.some((s) => !s.cleared);
}

/** All non-cleared sources for a kind. */
export function getActiveSources(
	snapshot: TaintSnapshot,
	kind: TaintKind,
): TaintSource[] {
	return (snapshot.by_kind[kind] ?? []).filter((s) => !s.cleared);
}

/** All sources (including cleared) for a kind — for audit tooling. */
export function getAllSources(
	snapshot: TaintSnapshot,
	kind: TaintKind,
): TaintSource[] {
	return [...(snapshot.by_kind[kind] ?? [])];
}

/** True if `path` was written from a tainted context (any non-cleared upstream). */
export function isFileGenerated(
	snapshot: TaintSnapshot,
	path: string,
): boolean {
	const sources = snapshot.generated_files[path];
	if (!sources || sources.length === 0) return false;
	return sources.some((s) => !s.cleared);
}

/** Provenance entries (non-cleared) for a generated file. */
export function getGeneratedFileSources(
	snapshot: TaintSnapshot,
	path: string,
): TaintSource[] {
	return (snapshot.generated_files[path] ?? []).filter((s) => !s.cleared);
}

/**
 * Trust posture classifier — does a Read of `path` register `prompt`
 * taint per design §3.3?
 *
 * Order of evaluation:
 *   1. If the path matches FORCE_UNTRUSTED_PATTERNS → untrusted (cannot
 *      be overridden by trusted_paths).
 *   2. If the path is outside `projectRoot` → untrusted.
 *   3. If `trustedPaths` is non-empty AND path matches any → trusted.
 *   4. Otherwise (in-repo, no trust config matches) → untrusted (default
 *      posture per GPT round-3 reversal).
 *
 * `picomatch` is required by the caller because we don't want to hard-
 * code a glob lib in this pure module's typings; the caller passes a
 * matcher factory. The classify.ts sink module already depends on
 * picomatch directly so this is a deliberate split — the engine is
 * dependency-light; classifiers can be heavier.
 */
export interface TrustClassifierOptions {
	projectRoot: string;
	trustedPaths?: readonly string[];
	/**
	 * Glob match function. Caller passes picomatch-or-equivalent. Must
	 * be case-insensitive and dot-aware to match the rest of Patchwork's
	 * matchers.
	 */
	matchGlob: (path: string, pattern: string) => boolean;
	/** Override the default force-untrusted list — used by tests. */
	forceUntrusted?: readonly string[];
}

export function isPathUntrustedRepo(
	path: string,
	opts: TrustClassifierOptions,
): boolean {
	const force = opts.forceUntrusted ?? FORCE_UNTRUSTED_PATTERNS;
	for (const pat of force) {
		if (opts.matchGlob(path, pat)) return true;
	}
	if (!path.startsWith(opts.projectRoot)) {
		return true;
	}
	const trusted = opts.trustedPaths ?? [];
	if (trusted.length === 0) {
		return true;
	}
	for (const pat of trusted) {
		if (opts.matchGlob(path, pat)) return false;
	}
	return true;
}

/**
 * Deep-clone a snapshot for immutable updates. Manual rather than
 * `structuredClone` so this works in test runners where it isn't
 * polyfilled, and so we can be explicit about which fields we're
 * copying as the schema evolves.
 */
function cloneSnapshot(s: TaintSnapshot): TaintSnapshot {
	const by_kind: Record<string, TaintSource[]> = {};
	for (const kind of Object.keys(s.by_kind)) {
		by_kind[kind] = (s.by_kind[kind] ?? []).map((src) => ({ ...src }));
	}
	const generated_files: Record<string, TaintSource[]> = {};
	for (const path of Object.keys(s.generated_files)) {
		generated_files[path] = (s.generated_files[path] ?? []).map((src) => ({
			...src,
		}));
	}
	return {
		session_id: s.session_id,
		by_kind,
		generated_files,
	};
}
