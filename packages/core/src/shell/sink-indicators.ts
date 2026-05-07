/**
 * Sink-indicator detection for the v0.6.11 shell recognizer.
 *
 * The detector scans the words and redirects of a `ParsedCommand`
 * (after unwrapping compound prefixes) and emits typed indicators that
 * the commit-8 enforcement layer consumes. The keystone enforcement
 * rule is:
 *
 *   `parse_confidence === "unknown"` AND any indicator AND any taint
 *   active = DENY
 *
 * Indicators also fire on `confidence: "high"` commands — those drive
 * the structured sink classifier (pipe_to_shell, allowed_saas_upload,
 * configured_remote_network, etc.). Detection is deliberately
 * over-inclusive on indicator emission because the cost of a false
 * positive at this layer is "we look more carefully", and the cost of
 * a false negative is "the attack works".
 */

import type {
	ParsedCommand,
	SinkIndicator,
	SinkIndicatorKind,
	Redirect,
} from "./types.js";
import {
	INTERPRETER_NAMES,
	FETCH_TOOL_NAMES,
	INLINE_EVAL_FLAGS,
} from "./types.js";

const EVAL_CONSTRUCTS = new Set(["eval", "source", "."]);
const SCP_RSYNC = new Set(["scp", "rsync"]);
const NC_SOCAT = new Set(["nc", "ncat", "socat"]);
const SSH_TOOLS = new Set(["ssh", "sshpass"]);
const PACKAGE_LIFECYCLE = new Set(["npm", "pnpm", "yarn", "bun"]);
const PACKAGE_LIFECYCLE_VERBS = new Set([
	"install",
	"i",
	"add",
	"ci",
	"rebuild",
]);

const SECRET_PATH_FRAGMENTS = [
	"/.aws/credentials",
	"/.ssh/id_",
	"/.npmrc",
	"/.netrc",
	"/.git-credentials",
	"/.config/gh/hosts.yml",
	"/.docker/config.json",
	"/.kube/config",
	"/.gnupg/private-keys-v1.d/",
	"/.password-store/",
];

const ENV_DOT_FILE_RE = /(?:^|\/)\.env(?:[^/]*)?$/;

const NETWORK_REDIRECT_PREFIXES = [
	"/dev/tcp/",
	"/dev/udp/",
];

function isSecretPath(value: string): boolean {
	if (ENV_DOT_FILE_RE.test(value)) return true;
	for (const frag of SECRET_PATH_FRAGMENTS) {
		if (value.includes(frag)) return true;
	}
	return false;
}

function pushIndicator(
	out: SinkIndicator[],
	kind: SinkIndicatorKind,
	token: string,
	position: number,
	detail?: string,
): void {
	out.push({ kind, token, position, detail });
}

/**
 * Scan a leaf command (argv) for sink indicators. The leaf is the
 * command after compound-prefix unwrap (so `sudo curl x` is scanned
 * with argv=["curl","x"], not the sudo prefix).
 */
export function indicatorsForLeaf(
	cmd: ParsedCommand,
): SinkIndicator[] {
	const out: SinkIndicator[] = [];
	const argv = Array.isArray(cmd.argv) ? cmd.argv : [];
	// Use argv[0] when fully resolved, else fall back to resolved_head
	// (the parser stamps this when at least the first word was static).
	const head = (argv[0] ?? cmd.resolved_head ?? "") as string;
	const lowerHead = head.toLowerCase();
	const baseHead = lowerHead.split("/").pop() || lowerHead;

	if (INTERPRETER_NAMES.has(baseHead)) {
		pushIndicator(out, "interpreter", argv[0], 0);
	}
	if (FETCH_TOOL_NAMES.has(baseHead)) {
		pushIndicator(out, "fetch_tool", argv[0], 0);
	}
	if (EVAL_CONSTRUCTS.has(baseHead)) {
		pushIndicator(out, "eval_construct", argv[0], 0);
	}
	if (SCP_RSYNC.has(baseHead)) {
		pushIndicator(out, "scp_rsync", argv[0], 0);
	}
	if (NC_SOCAT.has(baseHead)) {
		pushIndicator(out, "nc_socat", argv[0], 0);
	}
	if (SSH_TOOLS.has(baseHead)) {
		pushIndicator(out, "ssh", argv[0], 0);
	}

	// Package lifecycle: npm install, pnpm i, yarn add, bun install
	if (PACKAGE_LIFECYCLE.has(baseHead) && argv.length > 1) {
		const verb = (argv[1] ?? "").toLowerCase();
		if (PACKAGE_LIFECYCLE_VERBS.has(verb)) {
			const hasIgnoreScripts = argv
				.slice(1)
				.some((a) => a === "--ignore-scripts");
			if (!hasIgnoreScripts) {
				pushIndicator(
					out,
					"package_lifecycle",
					`${argv[0]} ${argv[1]}`,
					0,
					"missing --ignore-scripts",
				);
			}
		}
	}

	// gh upload variants — gh gist create / gh release upload / gh api
	if (baseHead === "gh" && argv.length >= 3) {
		const sub1 = (argv[1] ?? "").toLowerCase();
		const sub2 = (argv[2] ?? "").toLowerCase();
		const upload =
			(sub1 === "gist" && sub2 === "create") ||
			(sub1 === "release" && sub2 === "upload") ||
			(sub1 === "issue" && sub2 === "create") ||
			(sub1 === "pr" && sub2 === "comment") ||
			sub1 === "api";
		if (upload) {
			pushIndicator(out, "gh_upload", `gh ${sub1} ${sub2}`, 0);
		}
	}

	// git remote-mutating operations
	if (baseHead === "git" && argv.length > 1) {
		const sub = (argv[1] ?? "").toLowerCase();
		if (
			sub === "push" ||
			sub === "fetch" ||
			sub === "pull" ||
			sub === "remote" ||
			sub === "config" ||
			sub === "submodule"
		) {
			pushIndicator(out, "git_remote_mutate", `git ${sub}`, 0);
		}
		// `git -c remote.x.url=...` smuggle
		if (sub === "-c") {
			pushIndicator(out, "git_remote_mutate", `git -c …`, 0, "git -c flag");
		}
	}

	// Inline eval: node -e / python -c / ruby -e / perl -e / php -r
	const flagsForHead = INLINE_EVAL_FLAGS[baseHead];
	if (flagsForHead && argv.length > 1) {
		for (let i = 1; i < argv.length; i++) {
			if (flagsForHead.has(argv[i])) {
				pushIndicator(
					out,
					"interpreter_inline_eval",
					`${argv[0]} ${argv[i]}`,
					i,
				);
				break;
			}
		}
	}

	// Secret-path arguments anywhere in argv
	for (let i = 0; i < argv.length; i++) {
		const v = argv[i];
		if (typeof v === "string" && isSecretPath(v)) {
			pushIndicator(out, "secret_path", v, i);
		}
	}

	// Redirects
	for (const r of cmd.redirects) {
		const rIndic = indicatorForRedirect(r);
		if (rIndic) out.push(rIndic);
	}

	return out;
}

export function indicatorForRedirect(
	r: Redirect,
): SinkIndicator | null {
	if (!r.target_resolved) return null;
	for (const prefix of NETWORK_REDIRECT_PREFIXES) {
		if (r.target.startsWith(prefix)) {
			return {
				kind: "network_redirect",
				token: r.target,
				position: -1,
				detail: r.kind,
			};
		}
	}
	if (isSecretPath(r.target)) {
		return {
			kind: "secret_path",
			token: r.target,
			position: -1,
			detail: `redirect ${r.kind}`,
		};
	}
	return null;
}

/**
 * Combinator: given the parent of a pipe / process-sub tree, return
 * indicators that span children — pipe_to_interpreter,
 * process_sub_to_interpreter. The indicators are emitted on the parent
 * node so the enforcement layer sees them at the top level.
 */
export function combineChildrenIndicators(
	parent: ParsedCommand,
): SinkIndicator[] {
	const out: SinkIndicator[] = [];
	const children = parent.children ?? [];

	if (parent.op === "pipe" && children.length >= 2) {
		// Look for `… | sh` or `… | bash`: the LAST stage is the
		// interpreter, and any earlier stage is a fetch_tool — that's
		// the A5 attack. We emit the indicator if the last stage is
		// an interpreter (severity decision is left to enforcement).
		const last = children[children.length - 1];
		if (
			Array.isArray(last.argv) &&
			last.argv.length > 0 &&
			INTERPRETER_NAMES.has(
				(last.argv[0] ?? "").toLowerCase().split("/").pop() ?? "",
			)
		) {
			pushIndicator(
				out,
				"pipe_to_interpreter",
				last.argv[0],
				children.length - 1,
				"final stage is shell interpreter",
			);
		}
	}

	// process_sub_to_interpreter: parent's argv[0] is an interpreter
	// AND any child's op is process_sub_in/out — the A8 attack.
	const headIsInterpreter =
		Array.isArray(parent.argv) &&
		parent.argv.length > 0 &&
		INTERPRETER_NAMES.has(
			(parent.argv[0] ?? "").toLowerCase().split("/").pop() ?? "",
		);
	if (headIsInterpreter) {
		for (const child of children) {
			if (
				child.op === "process_sub_in" ||
				child.op === "process_sub_out"
			) {
				pushIndicator(
					out,
					"process_sub_to_interpreter",
					String(parent.argv[0]),
					0,
					"interpreter consumes process substitution",
				);
				break;
			}
		}
	}

	return out;
}
