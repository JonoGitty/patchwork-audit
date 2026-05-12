/**
 * Conservative shell parser for the v0.6.11 recognizer.
 *
 * Walks the lexer's token stream and produces a `ParsedCommand` tree
 * with structured argv / env / redirects / children, plus the
 * confidence and sink-indicator metadata the commit-8 enforcement
 * layer needs.
 *
 * The parser is intentionally narrow:
 *   - It models pipe / sequence / and-if / or-if / process-sub tree
 *     structure, but does NOT try to evaluate variable expansion or
 *     command substitution. Anything dynamic drops the confidence.
 *   - It unwraps the compound prefixes listed in `COMPOUND_PREFIXES`
 *     and the inline `-c` form for shell interpreters (`sh`/`bash`/etc.)
 *     so the resulting argv reflects the *target* command.
 *   - It classifies redirects into `Redirect[]` with a typed `RedirectKind`.
 *   - It populates `sink_indicators` via `sink-indicators.ts`.
 *
 * The parser NEVER throws. If anything fails, the relevant node is
 * marked `confidence: "unknown"` with a `parse_error` string, and
 * collected sink indicators are still returned — that's the fail-closed
 * substrate the enforcement layer relies on.
 */

import { tokenize } from "./lexer.js";
import type {
	Token,
	ParsedCommand,
	ParsedOp,
	Redirect,
	RedirectKind,
	ParseConfidence,
	SinkIndicator,
} from "./types.js";
import { COMPOUND_PREFIXES, INTERPRETER_NAMES } from "./types.js";
import {
	indicatorsForLeaf,
	combineChildrenIndicators,
} from "./sink-indicators.js";

interface Cursor {
	tokens: Token[];
	i: number;
	src: string;
}

function classifyRedirect(op: string, fd: number | undefined): RedirectKind {
	switch (op) {
		case "<":
			return "stdin_file";
		case ">":
			return fd === 2 ? "stderr_file" : "stdout_file";
		case ">>":
			return fd === 2 ? "stderr_append" : "stdout_append";
		case "2>":
			return "stderr_file";
		case "2>>":
			return "stderr_append";
		case "&>":
		case "&>>":
			return "merge_stderr_stdout";
		case ">&":
		case "<&":
			return "fd_dup";
		case "<<":
			return "heredoc";
		case "<<-":
			return "heredoc_dash";
		case "<<<":
			return "herestring";
		default:
			return "unknown";
	}
}

function parseSequence(cur: Cursor, raw: string): ParsedCommand {
	// Top-level: split on ; && || newline (left-to-right, left-associative)
	const segments: { node: ParsedCommand; op: ParsedOp | null }[] = [];
	let opAfterPrev: ParsedOp | null = null;
	while (cur.i < cur.tokens.length) {
		const t = cur.tokens[cur.i];
		if (
			t.kind === "rparen" ||
			(t.kind === "comment" && false) // comments are passthrough
		) {
			break;
		}
		if (t.kind === "comment") {
			cur.i++;
			continue;
		}
		if (
			t.kind === "semi" ||
			t.kind === "newline" ||
			t.kind === "and_if" ||
			t.kind === "or_if" ||
			t.kind === "amp"
		) {
			cur.i++;
			continue;
		}
		const node = parsePipeline(cur);
		segments.push({ node, op: opAfterPrev });
		// Look at next token to determine separator
		opAfterPrev = null;
		const sep = cur.tokens[cur.i];
		if (!sep) break;
		if (sep.kind === "semi" || sep.kind === "newline") {
			opAfterPrev = "sequence_unconditional";
		} else if (sep.kind === "and_if") {
			opAfterPrev = "sequence_and";
		} else if (sep.kind === "or_if") {
			opAfterPrev = "sequence_or";
		} else if (sep.kind === "amp") {
			opAfterPrev = "background";
		} else {
			break;
		}
		cur.i++;
	}
	if (segments.length === 0) {
		return makeUnknown(raw, "empty input");
	}
	if (segments.length === 1) {
		return segments[0].node;
	}
	// Build a left-associative sequence tree. For simplicity we flatten
	// into a single node with children + the op of the FIRST separator
	// (this gives commit-8 the structural info it needs without forcing
	// it to walk a deeply nested tree). Per-edge ops get attached to
	// each child as `op` field — the parent op records the predominant
	// op for log readability.
	const children = segments.map((s) => s.node);
	for (let i = 1; i < segments.length; i++) {
		children[i].op = segments[i].op ?? "sequence_unconditional";
	}
	const confidence = mergeConfidence(children.map((c) => c.confidence));
	const indicators = collectChildSinkIndicators(children);
	return {
		argv: "unresolved",
		env: {},
		redirects: [],
		children,
		op: segments[1].op ?? "sequence_unconditional",
		raw,
		confidence,
		sink_indicators: indicators,
	};
}

function parsePipeline(cur: Cursor): ParsedCommand {
	const stages: ParsedCommand[] = [];
	const start = cur.i;
	stages.push(parseSimpleCommand(cur));
	while (cur.i < cur.tokens.length && cur.tokens[cur.i].kind === "pipe") {
		cur.i++;
		stages.push(parseSimpleCommand(cur));
	}
	if (stages.length === 1) return stages[0];
	const raw = rawFromTokens(cur.tokens.slice(start, cur.i));
	const confidence = mergeConfidence(stages.map((s) => s.confidence));
	const parent: ParsedCommand = {
		argv: "unresolved",
		env: {},
		redirects: [],
		children: stages,
		op: "pipe",
		raw,
		confidence,
		sink_indicators: [],
	};
	parent.sink_indicators = [
		...collectChildSinkIndicators(stages),
		...combineChildrenIndicators(parent),
	];
	return parent;
}

function parseSimpleCommand(cur: Cursor): ParsedCommand {
	const start = cur.i;
	const env: Record<string, string> = {};
	const argvTokens: Token[] = [];
	const redirects: Redirect[] = [];
	const childProcessSubs: ParsedCommand[] = [];
	let confidenceFlags: ParseConfidence = "high";
	const errors: string[] = [];

	// Subshell: `( … )`
	if (cur.tokens[cur.i]?.kind === "lparen") {
		cur.i++;
		const inner = parseSequence(cur, "");
		if (cur.tokens[cur.i]?.kind === "rparen") cur.i++;
		const raw = rawFromTokens(cur.tokens.slice(start, cur.i));
		const node: ParsedCommand = {
			argv: "unresolved",
			env: {},
			redirects: [],
			children: [inner],
			op: "subshell",
			raw,
			confidence: inner.confidence,
			sink_indicators: inner.sink_indicators,
		};
		// trailing redirects on the subshell
		while (
			cur.i < cur.tokens.length &&
			cur.tokens[cur.i].kind === "redirect"
		) {
			const r = consumeRedirect(cur);
			if (r) node.redirects.push(r);
			if (r && !r.target_resolved) confidenceFlags = "low";
		}
		return node;
	}

	while (cur.i < cur.tokens.length) {
		const t = cur.tokens[cur.i];
		if (
			t.kind === "pipe" ||
			t.kind === "semi" ||
			t.kind === "newline" ||
			t.kind === "and_if" ||
			t.kind === "or_if" ||
			t.kind === "amp" ||
			t.kind === "rparen"
		) {
			break;
		}
		if (t.kind === "comment") {
			cur.i++;
			continue;
		}
		if (t.kind === "assignment" && argvTokens.length === 0) {
			const eqIdx = t.raw.indexOf("=");
			const name = t.raw.slice(0, eqIdx);
			const value = t.raw.slice(eqIdx + 1);
			if (t.has_expansion) {
				confidenceFlags = "low";
			} else {
				env[name] = stripQuotes(value);
			}
			cur.i++;
			continue;
		}
		if (t.kind === "redirect") {
			const r = consumeRedirect(cur);
			if (r) redirects.push(r);
			if (r && !r.target_resolved) confidenceFlags = downgrade(confidenceFlags, "low");
			continue;
		}
		if (t.kind === "heredoc_marker") {
			const r = consumeHeredoc(cur);
			if (r) redirects.push(r);
			continue;
		}
		if (t.kind === "process_sub_in" || t.kind === "process_sub_out") {
			cur.i++;
			const inner = parseSequence(cur, "");
			if (cur.tokens[cur.i]?.kind === "rparen") cur.i++;
			inner.op =
				t.kind === "process_sub_in" ? "process_sub_in" : "process_sub_out";
			childProcessSubs.push(inner);
			continue;
		}
		if (t.kind === "word" || t.kind === "assignment") {
			argvTokens.push(t);
			if (t.has_expansion || t.resolved === undefined) {
				confidenceFlags = downgrade(confidenceFlags, "low");
			}
			cur.i++;
			continue;
		}
		// Unknown token kind in command position — shouldn't happen but
		// be conservative.
		errors.push(`unexpected token: ${t.kind}`);
		confidenceFlags = "unknown";
		cur.i++;
	}

	const raw = rawFromTokens(cur.tokens.slice(start, cur.i));
	const argvResolved = argvTokens.every(
		(t) => t.resolved !== undefined && !t.has_expansion,
	);
	const argv: string[] | "unresolved" = argvResolved
		? argvTokens.map((t) => t.resolved as string)
		: "unresolved";
	// Best-effort head: if the first word is statically known (no
	// expansion) we capture it even when later words drop confidence.
	const headTok = argvTokens[0];
	const resolvedHead =
		headTok && headTok.resolved !== undefined && !headTok.has_expansion
			? headTok.resolved
			: undefined;
	// Process-sub children present? Drop parent to "low" because the
	// outer argv doesn't reflect what the substituted process emits.
	if (childProcessSubs.length > 0 && confidenceFlags === "high") {
		confidenceFlags = "low";
	}

	let node: ParsedCommand = {
		argv,
		env,
		redirects,
		children: childProcessSubs.length > 0 ? childProcessSubs : undefined,
		op: undefined,
		raw,
		confidence: confidenceFlags,
		sink_indicators: [],
		parse_error: errors.length > 0 ? errors.join("; ") : undefined,
		resolved_head: resolvedHead,
	};

	// Compound-prefix unwrap. Iterate because `sudo timeout 30 nice curl x`
	// can chain prefixes.
	node = unwrapCompoundPrefixes(node, argvTokens);

	// Inline -c unwrap for `sh -c '...'` / `bash -c "..."`. Only when
	// the body is a fully-resolved string AND the interpreter is one we
	// recognize.
	node = maybeUnwrapInlineDashC(node);

	// Sink indicators (computed AFTER unwrapping so the right argv is
	// scanned). Children's indicators bubble up so an outer command
	// retains the inner sh -c body's findings, the process-sub child's
	// findings, etc.
	node.sink_indicators = [
		...indicatorsForLeaf(node),
		...collectChildSinkIndicators(node.children ?? []),
		...combineChildrenIndicators(node),
	];

	return node;
}

function downgrade(
	a: ParseConfidence,
	b: ParseConfidence,
): ParseConfidence {
	const order: ParseConfidence[] = ["unknown", "low", "high"];
	const idx = (x: ParseConfidence) => order.indexOf(x);
	return order[Math.min(idx(a), idx(b))];
}

function mergeConfidence(parts: ParseConfidence[]): ParseConfidence {
	let r: ParseConfidence = "high";
	for (const p of parts) r = downgrade(r, p);
	return r;
}

function consumeRedirect(cur: Cursor): Redirect | null {
	const op = cur.tokens[cur.i];
	cur.i++;
	const target = cur.tokens[cur.i];
	let targetStr = "";
	let resolved = false;
	if (target && target.kind === "word") {
		targetStr =
			target.resolved !== undefined && !target.has_expansion
				? target.resolved
				: target.raw;
		resolved = target.resolved !== undefined && !target.has_expansion;
		cur.i++;
	}
	return {
		kind: classifyRedirect(op.redirect_op ?? op.raw, op.fd),
		fd: op.fd ?? null,
		target: targetStr,
		target_resolved: resolved,
		raw: `${op.raw}${target ? " " + target.raw : ""}`,
	};
}

function consumeHeredoc(cur: Cursor): Redirect | null {
	const op = cur.tokens[cur.i];
	cur.i++;
	const delim = cur.tokens[cur.i];
	if (!delim || delim.kind !== "word") return null;
	cur.i++;
	const body = cur.tokens[cur.i];
	let bodyText = "";
	if (body && body.kind === "word") {
		bodyText = body.resolved ?? body.raw;
		cur.i++;
	}
	return {
		kind: op.redirect_op === "<<-" ? "heredoc_dash" : "heredoc",
		fd: op.fd ?? null,
		target: bodyText,
		target_resolved: true,
		raw: `${op.raw} ${delim.raw}\n${bodyText}\n${delim.raw}`,
	};
}

function rawFromTokens(toks: Token[]): string {
	return toks.map((t) => t.raw).join(" ");
}

function stripQuotes(s: string): string {
	if (s.length >= 2) {
		if (
			(s[0] === "'" && s[s.length - 1] === "'") ||
			(s[0] === '"' && s[s.length - 1] === '"')
		) {
			return s.slice(1, -1);
		}
	}
	return s;
}

/**
 * Unwrap compound prefixes like `sudo`, `nice`, `timeout 30`, `env A=B`,
 * `command`, `exec`, `nohup`, `stdbuf -oL`. After unwrapping, `argv`
 * reflects the *target* command. Env assignments captured by `env A=B`
 * merge into the node's env map.
 *
 * Iterative: handles `sudo nice timeout 30 env A=B curl x`.
 */
function unwrapCompoundPrefixes(
	node: ParsedCommand,
	originalTokens: Token[],
): ParsedCommand {
	if (!Array.isArray(node.argv) || node.argv.length === 0) return node;
	let argv = [...node.argv];
	let tokens = [...originalTokens];
	const env = { ...node.env };
	let unwrapped = false;
	let safety = 8;
	while (safety-- > 0 && argv.length > 0) {
		const head = argv[0];
		if (!COMPOUND_PREFIXES.has(head)) break;
		switch (head) {
			case "sudo":
			case "nohup":
			case "command":
			case "exec":
				argv = argv.slice(1);
				tokens = tokens.slice(1);
				unwrapped = true;
				break;
			case "nice": {
				let n = 1;
				if (argv[1] === "-n" && argv[2] !== undefined) n = 3;
				else if ((argv[1] ?? "").startsWith("-")) n = 2;
				argv = argv.slice(n);
				tokens = tokens.slice(n);
				unwrapped = true;
				break;
			}
			case "timeout": {
				let n = 1;
				while (
					n < argv.length &&
					(argv[n].startsWith("-") || /^\d+(\.\d+)?[smhd]?$/.test(argv[n]))
				) {
					n++;
				}
				argv = argv.slice(n);
				tokens = tokens.slice(n);
				unwrapped = true;
				break;
			}
			case "stdbuf": {
				let n = 1;
				while (n < argv.length && argv[n].startsWith("-")) {
					if (argv[n].length === 2 && n + 1 < argv.length) {
						n += 2;
					} else {
						n++;
					}
				}
				argv = argv.slice(n);
				tokens = tokens.slice(n);
				unwrapped = true;
				break;
			}
			case "env": {
				let n = 1;
				while (n < argv.length) {
					const a = argv[n];
					if (/^-/.test(a)) {
						n++;
						continue;
					}
					const eq = a.indexOf("=");
					if (eq <= 0 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(a.slice(0, eq))) {
						break;
					}
					env[a.slice(0, eq)] = a.slice(eq + 1);
					n++;
				}
				argv = argv.slice(n);
				tokens = tokens.slice(n);
				unwrapped = true;
				break;
			}
			default:
				break;
		}
	}
	if (!unwrapped) return node;
	return {
		...node,
		argv: argv.length === 0 ? "unresolved" : argv,
		env,
	};
}

function maybeUnwrapInlineDashC(node: ParsedCommand): ParsedCommand {
	if (!Array.isArray(node.argv) || node.argv.length < 3) return node;
	const head = node.argv[0].toLowerCase();
	const baseHead = head.split("/").pop() || head;
	if (!INTERPRETER_NAMES.has(baseHead)) return node;
	// find the -c / --command flag and the script body
	for (let i = 1; i < node.argv.length - 1; i++) {
		const flag = node.argv[i];
		if (flag === "-c" || flag === "--command") {
			const body = node.argv[i + 1];
			if (typeof body !== "string" || body === "") return node;
			// Recursively parse the inline body. Set raw to the body so
			// downstream tooling can correlate.
			const inner = parseShellCommand(body);
			// keep the outer argv as the wrapping interpreter so the audit
			// log shows both layers; expose the parsed inline body as the
			// only child.
			return {
				...node,
				children: [inner, ...(node.children ?? [])],
				op: node.op ?? undefined,
				confidence: downgrade(node.confidence, inner.confidence),
				sink_indicators: [
					...node.sink_indicators,
					...inner.sink_indicators,
				],
			};
		}
	}
	return node;
}

function collectChildSinkIndicators(
	children: ParsedCommand[],
): SinkIndicator[] {
	const out: SinkIndicator[] = [];
	for (const c of children) {
		for (const ind of c.sink_indicators) {
			out.push(ind);
		}
	}
	return out;
}

function makeUnknown(raw: string, why: string): ParsedCommand {
	return {
		argv: "unresolved",
		env: {},
		redirects: [],
		raw,
		confidence: "unknown",
		sink_indicators: [],
		parse_error: why,
	};
}

/**
 * Public parser entry. Returns a ParsedCommand tree. Never throws;
 * any parse failure is reported via `confidence: "unknown"` and a
 * `parse_error` string.
 */
export function parseShellCommand(input: string): ParsedCommand {
	if (typeof input !== "string" || input.length === 0) {
		return makeUnknown("", "empty input");
	}
	const { tokens, errors } = tokenize(input);
	if (tokens.length === 0) {
		const node = makeUnknown(input, "no tokens");
		if (errors.length > 0) node.parse_error = errors.join("; ");
		return node;
	}
	const cur: Cursor = { tokens, i: 0, src: input };
	const node = parseSequence(cur, input);
	// If the lexer flagged errors, downgrade.
	if (errors.length > 0) {
		node.confidence = downgrade(node.confidence, "unknown");
		node.parse_error = (node.parse_error ? node.parse_error + "; " : "") +
			errors.join("; ");
	}
	return node;
}
