/**
 * Shared types for the conservative shell recognizer (v0.6.11 commit 4).
 *
 * The recognizer is deliberately limited to the constructs needed for
 * the v0.6.11 sink classifier — not a full shell grammar. Anything the
 * recognizer can't match cleanly yields `confidence: "unknown"` so the
 * commit-8 enforcement layer can apply the keystone security rule:
 *
 *     parse_confidence === "unknown"
 *       AND any sink_indicator present
 *       AND any taint kind active
 *       =>  DENY
 *
 * The recognizer NEVER throws. Even on garbage input the result is
 * `{ argv: "unresolved", confidence: "unknown", sink_indicators: [...] }`
 * — fail-open at the parser level is fine because the enforcement layer
 * fails closed under taint.
 */

export type TokenKind =
	| "word"            // command name / argument / redirect target
	| "assignment"      // `VAR=value` standalone token (env prefix)
	| "pipe"            // |
	| "and_if"          // &&
	| "or_if"           // ||
	| "semi"            // ;
	| "amp"             // & (background)
	| "redirect"        // >, >>, <, <<, <<<, 2>, &>, &>>, n>&m, n<&m
	| "lparen"          // (   subshell open
	| "rparen"          // )   subshell / process-sub close
	| "process_sub_in"  // <(
	| "process_sub_out" // >(
	| "heredoc_marker"  // raw `<<` or `<<-` waiting for delimiter on the next word
	| "newline"         // significant newline
	| "comment";        // # ... (ignored, but recorded for raw)

/**
 * A token is the smallest unit of parser-relevant input. For `word`
 * tokens we also keep `resolved` (the static value when the entire
 * word is literal-or-resolvable) and `has_expansion` (true when any
 * dynamic part — $VAR, $(...), `...`, $'...' with non-trivial escapes
 * — is present).
 *
 * For `redirect` tokens, `redirect_op` carries the exact redirect
 * operator string (`>`, `2>>`, `&>`, `<<<`, etc.) and `fd` carries the
 * explicit fd if the operator had a leading number.
 */
export interface Token {
	kind: TokenKind;
	raw: string;
	resolved?: string;
	has_expansion?: boolean;
	/** True if the word contains $(...), `...`, or process-sub. */
	has_command_sub?: boolean;
	redirect_op?: string;
	fd?: number;
}

/** Parser-level redirect classification. */
export type RedirectKind =
	| "stdin_file"           // < file
	| "stdout_file"          // > file
	| "stdout_append"        // >> file
	| "stderr_file"          // 2> file
	| "stderr_append"        // 2>> file
	| "merge_stderr_stdout"  // 2>&1, &>, &>>
	| "fd_dup"               // n>&m, n<&m
	| "heredoc"              // << EOF
	| "heredoc_dash"         // <<- EOF (tab-stripping)
	| "herestring"           // <<< "value"
	| "unknown";

export interface Redirect {
	kind: RedirectKind;
	/** Source fd (e.g. `2` in `2>&1`, `1` in `>file`). */
	fd: number | null;
	/** Destination — file path / fd number / heredoc body / "&1" etc. */
	target: string;
	/** True when `target` is statically known. False on `> $VAR` etc. */
	target_resolved: boolean;
	/** Exact source text for audit. */
	raw: string;
}

/**
 * Sink indicators catalog tokens that the commit-8 enforcement layer
 * cares about even when the parsed argv is unresolved. `kind` groups
 * them so the rule "any sink-suggestive token under taint with parse
 * confidence unknown = deny" can be evaluated cheaply.
 */
export type SinkIndicatorKind =
	| "interpreter"                    // sh, bash, dash, zsh, ksh, ash, fish
	| "fetch_tool"                     // curl, wget, httpie/http, fetch
	| "eval_construct"                 // eval, source, "."
	| "network_redirect"               // > /dev/tcp/host/port  | < /dev/tcp/...
	| "secret_path"                    // argv contains a credential-class path
	| "scp_rsync"                      // scp, rsync (network egress sinks)
	| "nc_socat"                       // nc, ncat, socat (raw network)
	| "ssh"                            // ssh (remote exec / port-forward)
	| "package_lifecycle"              // npm install / pnpm install / yarn install / bun install
	| "gh_upload"                      // gh gist create / gh release upload / etc.
	| "git_remote_mutate"              // git remote add / git push / git fetch / git config
	| "process_sub_to_interpreter"     // bash <(curl ...) — the A8 attack
	| "pipe_to_interpreter"            // ... | sh   — the A5 attack
	| "interpreter_inline_eval";       // node -e / python -c / ruby -e / perl -e / php -r

export interface SinkIndicator {
	kind: SinkIndicatorKind;
	/** The literal token that triggered the indicator (for audit). */
	token: string;
	/**
	 * Word index inside the parsed command's argv-equivalent token
	 * stream — so commit-8 can correlate "the bad word was at position N".
	 * -1 for indicators derived from redirects rather than argv.
	 */
	position: number;
	detail?: string;
}

/**
 * Parser confidence — the keystone of the v0.6.11 enforcement model.
 *
 * - `high`: argv is fully resolved (no $VAR, no $(...), no escaping
 *   surprises), redirects all resolved, no unsupported constructs.
 * - `low`: argv is resolved enough to reason about *but* contains at
 *   least one expansion point (`$VAR`, `$(...)`, `...` `...`,
 *   process-sub, herestring with expansion). Sink classifier may still
 *   make decisions but commit-8 will not pre-approve.
 * - `unknown`: anything the recognizer hit but couldn't fully model
 *   (deeply nested $(...), unsupported redirect form, malformed quoting,
 *   tokenizer error). Fail-closed under taint.
 */
export type ParseConfidence = "high" | "low" | "unknown";

/**
 * The parsed shape — mirror of `ParsedCommand` declared on `ToolEvent`,
 * but with the typed fields filled in. The recognizer's public entry
 * function returns this; the agents PostToolUse handler in commit 7
 * stamps it onto `ToolEvent.parsed_command`.
 */
export interface ParsedCommand {
	/** Resolved argv when every word is statically known; "unresolved"
	 *  otherwise. Compound prefixes (sh/bash -c, env, sudo, nice, timeout)
	 *  are unwrapped — the argv reflects the *target* command. */
	argv: string[] | "unresolved";
	/** Environment assignments preceding the command (`A=B C=D cmd ...`).
	 *  Only literal-resolved values are retained; assignments with
	 *  expansion are dropped (and `confidence` drops to "low"). */
	env: Record<string, string>;
	/** Output / input redirects on this node (not its children). */
	redirects: Redirect[];
	/** Pipe / sequence / process-sub children, in left-to-right order.
	 *  - For `a | b`, parent has children=[a,b] and op="pipe"
	 *  - For `a; b`, op="sequence_unconditional"
	 *  - For `a && b`, op="sequence_and"
	 *  - For `a || b`, op="sequence_or"
	 *  - For `cmd <(curl ...)`, the cmd node has the process-sub as a
	 *    child with op="process_sub_in"
	 */
	children?: ParsedCommand[];
	op?: ParsedOp;
	raw: string;
	confidence: ParseConfidence;
	sink_indicators: SinkIndicator[];
	/** When confidence is "unknown", this records WHY for the audit log. */
	parse_error?: string;
	/**
	 * Best-effort first word as a string when the parser could resolve
	 * it, even if the rest of argv is dynamic. The indicator scanner
	 * uses this to flag `eval $(date)`, `curl 'unterminated`, etc.,
	 * where argv is unresolved overall but the head is statically known.
	 */
	resolved_head?: string;
}

export type ParsedOp =
	| "pipe"
	| "sequence_unconditional"
	| "sequence_and"
	| "sequence_or"
	| "process_sub_in"
	| "process_sub_out"
	| "subshell"
	| "background";

/** The interpreter words we recognize as `sh -c` / `bash -c` style. */
export const INTERPRETER_NAMES: ReadonlySet<string> = new Set([
	"sh",
	"bash",
	"dash",
	"zsh",
	"ksh",
	"ash",
	"fish",
	"busybox",
]);

/** Fetch tools with high-confidence sink semantics. */
export const FETCH_TOOL_NAMES: ReadonlySet<string> = new Set([
	"curl",
	"wget",
	"http",
	"httpie",
	"fetch",
]);

/** Compound prefixes the parser unwraps to look at the target argv. */
export const COMPOUND_PREFIXES: ReadonlySet<string> = new Set([
	"sudo",
	"nice",
	"timeout",
	"env",
	"command",
	"exec",
	"nohup",
	"stdbuf",
]);

/** Inline-eval flags per interpreter family. */
export const INLINE_EVAL_FLAGS: Readonly<Record<string, ReadonlySet<string>>> = {
	node: new Set(["-e", "--eval", "-p", "--print"]),
	deno: new Set(["eval"]),
	python: new Set(["-c"]),
	python3: new Set(["-c"]),
	ruby: new Set(["-e"]),
	perl: new Set(["-e", "-E"]),
	php: new Set(["-r"]),
	osascript: new Set(["-e"]),
};
