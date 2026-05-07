/**
 * Conservative shell lexer for the v0.6.11 recognizer.
 *
 * Goal: turn a Bash command line into a flat stream of typed tokens
 * that the parser in `parse.ts` can walk. Anything we can't lex
 * cleanly we mark `has_expansion: true` and `resolved: undefined` on
 * the offending word, which forces the parser into `low` or `unknown`
 * confidence — never silent allow.
 *
 * What's covered:
 *   - single quotes (literal — no expansion at all)
 *   - double quotes (`$VAR` and `$(...)` allowed inside)
 *   - ANSI-C `$'...'` quoting with the common escapes (\n \t \\ \' \xNN \uNNNN)
 *   - backslash escapes outside quotes
 *   - `$VAR` and `${VAR}` expansion (marks word as expansion)
 *   - `$(...)` and backtick command substitution (depth-tracked, marks word
 *      as has_command_sub)
 *   - process substitution `<(…)` and `>(…)` as their own token kinds
 *   - redirects: `>`, `>>`, `<`, `<<`, `<<-`, `<<<`, `2>`, `2>>`, `&>`,
 *     `&>>`, fd-numbered `n>`, `n>>`, `n<`, `n<&m`, `n>&m`
 *   - operators: `|`, `||`, `&&`, `;`, `&`
 *   - `(` `)` for subshells (parser decides whether they're subshells
 *     or process-sub closers)
 *   - heredoc body capture for the simple `<< EOF` form (we only need
 *     to consume it — the body itself doesn't need parsing for sink
 *     detection beyond noticing that a redirect target file is being
 *     written)
 *   - comments (`#` to end of line) — preserved as a token so the
 *     parser can reconstruct raw strings if needed
 *
 * What's NOT covered (yields `unknown` parts in the resulting word):
 *   - Brace expansion `{a,b}c` — we keep the literal token; the
 *     parser flags low/unknown if a sink-suggestive token contains `{`
 *   - Arithmetic expansion `$((...))` — treated as expansion
 *   - Parameter expansion modifiers `${var:-default}` — treated as
 *     expansion (we don't try to evaluate)
 *   - History expansion `!!`, `!$` — treated as literal (Patchwork
 *     hooks see post-expansion argv anyway)
 *   - Multi-line continuations `\<newline>` — joined as whitespace
 *
 * The lexer NEVER throws. On a parse error it emits whatever
 * tokens it produced and the caller (parser) treats the result as
 * `confidence: "unknown"`.
 */

import type { Token, TokenKind } from "./types.js";

class Lexer {
	private i = 0;
	private readonly len: number;
	readonly tokens: Token[] = [];
	readonly errors: string[] = [];
	private lastWasCommandSub = false;

	constructor(private readonly src: string) {
		this.len = src.length;
	}

	run(): Token[] {
		while (this.i < this.len) {
			const c = this.src[this.i];
			if (c === " " || c === "\t") {
				this.i++;
				continue;
			}
			if (c === "\n") {
				this.tokens.push({ kind: "newline", raw: "\n" });
				this.i++;
				continue;
			}
			if (c === "#") {
				this.consumeComment();
				continue;
			}
			if (c === "\\" && this.peek(1) === "\n") {
				this.i += 2;
				continue;
			}
			if (c === "|") {
				if (this.peek(1) === "|") {
					this.tokens.push({ kind: "or_if", raw: "||" });
					this.i += 2;
				} else {
					this.tokens.push({ kind: "pipe", raw: "|" });
					this.i++;
				}
				continue;
			}
			if (c === "&") {
				if (this.peek(1) === "&") {
					this.tokens.push({ kind: "and_if", raw: "&&" });
					this.i += 2;
				} else if (this.peek(1) === ">") {
					if (this.peek(2) === ">") {
						this.tokens.push({
							kind: "redirect",
							raw: "&>>",
							redirect_op: "&>>",
						});
						this.i += 3;
					} else {
						this.tokens.push({
							kind: "redirect",
							raw: "&>",
							redirect_op: "&>",
						});
						this.i += 2;
					}
				} else {
					this.tokens.push({ kind: "amp", raw: "&" });
					this.i++;
				}
				continue;
			}
			if (c === ";") {
				this.tokens.push({ kind: "semi", raw: ";" });
				this.i++;
				continue;
			}
			if (c === "(") {
				this.tokens.push({ kind: "lparen", raw: "(" });
				this.i++;
				continue;
			}
			if (c === ")") {
				this.tokens.push({ kind: "rparen", raw: ")" });
				this.i++;
				continue;
			}
			if ((c === "<" || c === ">") && this.peek(1) === "(") {
				const kind: TokenKind =
					c === "<" ? "process_sub_in" : "process_sub_out";
				this.tokens.push({ kind, raw: c + "(" });
				this.i += 2;
				continue;
			}
			if (this.startsRedirect()) {
				this.consumeRedirect();
				continue;
			}
			this.consumeWord();
		}
		return this.tokens;
	}

	private peek(n: number): string {
		return this.src[this.i + n] ?? "";
	}

	private consumeComment(): void {
		const start = this.i;
		while (this.i < this.len && this.src[this.i] !== "\n") this.i++;
		this.tokens.push({
			kind: "comment",
			raw: this.src.slice(start, this.i),
		});
	}

	private startsRedirect(): boolean {
		let j = this.i;
		while (j < this.len && /[0-9]/.test(this.src[j])) j++;
		const c = this.src[j];
		return c === "<" || c === ">";
	}

	private consumeRedirect(): void {
		const start = this.i;
		let fdStr = "";
		while (this.i < this.len && /[0-9]/.test(this.src[this.i])) {
			fdStr += this.src[this.i];
			this.i++;
		}
		const c = this.src[this.i];
		let op = "";
		if (c === "<") {
			op = "<";
			this.i++;
			if (this.src[this.i] === "<") {
				op += "<";
				this.i++;
				if (this.src[this.i] === "<") {
					op += "<";
					this.i++;
				} else if (this.src[this.i] === "-") {
					op += "-";
					this.i++;
				}
			} else if (this.src[this.i] === "&") {
				op += "&";
				this.i++;
			}
		} else if (c === ">") {
			op = ">";
			this.i++;
			if (this.src[this.i] === ">") {
				op += ">";
				this.i++;
			} else if (this.src[this.i] === "&") {
				op += "&";
				this.i++;
			} else if (this.src[this.i] === "|") {
				op += "|";
				this.i++;
			}
		}
		const raw = this.src.slice(start, this.i);
		const fd = fdStr === "" ? undefined : parseInt(fdStr, 10);
		const isHeredoc = op === "<<" || op === "<<-";
		this.tokens.push({
			kind: isHeredoc ? "heredoc_marker" : "redirect",
			raw,
			redirect_op: op,
			fd,
		});
		if (isHeredoc) {
			while (
				this.i < this.len &&
				(this.src[this.i] === " " || this.src[this.i] === "\t")
			) {
				this.i++;
			}
			const delimWord = this.consumeBareDelimiter();
			if (delimWord !== null) {
				this.tokens.push({
					kind: "word",
					raw: delimWord.raw,
					resolved: delimWord.resolved,
				});
				this.consumeHeredocBody(
					delimWord.resolved ?? delimWord.raw,
					op === "<<-",
				);
			}
		}
	}

	private consumeBareDelimiter(): { raw: string; resolved: string } | null {
		const start = this.i;
		let resolved = "";
		while (this.i < this.len) {
			const c = this.src[this.i];
			if (c === "'" || c === '"') {
				this.i++;
				while (this.i < this.len && this.src[this.i] !== c) {
					resolved += this.src[this.i];
					this.i++;
				}
				if (this.src[this.i] === c) this.i++;
				continue;
			}
			if (c === " " || c === "\t" || c === "\n" || c === ";") break;
			resolved += c;
			this.i++;
		}
		if (this.i === start) return null;
		const raw = this.src.slice(start, this.i);
		return { raw, resolved };
	}

	private consumeHeredocBody(delim: string, dashed: boolean): void {
		while (this.i < this.len && this.src[this.i] !== "\n") this.i++;
		if (this.i < this.len) this.i++;
		const bodyStart = this.i;
		const bodyLines: string[] = [];
		while (this.i < this.len) {
			const lineStart = this.i;
			while (this.i < this.len && this.src[this.i] !== "\n") this.i++;
			let line = this.src.slice(lineStart, this.i);
			if (dashed) line = line.replace(/^\t+/, "");
			if (line === delim) {
				const raw = this.src.slice(bodyStart, lineStart);
				if (this.i < this.len) this.i++;
				const resolved = bodyLines.length > 0 ? bodyLines.join("\n") + "\n" : "";
				this.tokens.push({
					kind: "word",
					raw,
					resolved,
				});
				// Emit a newline token so the parser correctly treats
				// the next command as a new pipeline. Without this the
				// heredoc-terminator-line newline would be silently
				// absorbed and `cat <<EOF\n...\nEOF\nbash x` would parse
				// as a single command with `bash` and `x` as argv.
				this.tokens.push({ kind: "newline", raw: "\n" });
				return;
			}
			bodyLines.push(line);
			if (this.i < this.len) this.i++;
		}
		this.errors.push("heredoc not terminated");
		const raw = this.src.slice(bodyStart);
		const resolved = bodyLines.length > 0 ? bodyLines.join("\n") + "\n" : raw;
		this.tokens.push({ kind: "word", raw, resolved });
	}

	private consumeWord(): void {
		const start = this.i;
		let resolved = "";
		let hasExpansion = false;
		let hasCommandSub = false;
		let resolvable = true;

		while (this.i < this.len) {
			const c = this.src[this.i];
			if (
				c === " " ||
				c === "\t" ||
				c === "\n" ||
				c === "|" ||
				c === ";" ||
				c === "&" ||
				c === "(" ||
				c === ")" ||
				c === "<" ||
				c === ">"
			) {
				break;
			}
			if (c === "\\") {
				const next = this.peek(1);
				if (next === "\n") {
					this.i += 2;
					continue;
				}
				if (next !== "") {
					resolved += next;
					this.i += 2;
					continue;
				}
				this.i++;
				continue;
			}
			if (c === "'") {
				const seg = this.consumeSingleQuoted();
				if (seg === null) {
					this.errors.push("unterminated single quote");
					resolvable = false;
					break;
				}
				resolved += seg;
				continue;
			}
			if (c === "$" && this.peek(1) === "'") {
				const ansi = this.consumeAnsiCQuoted();
				if (ansi === null) {
					this.errors.push("unterminated ansi-c quote");
					resolvable = false;
					break;
				}
				resolved += ansi;
				continue;
			}
			if (c === '"') {
				const seg = this.consumeDoubleQuoted();
				if (seg === null) {
					this.errors.push("unterminated double quote");
					resolvable = false;
					break;
				}
				resolved += seg.literal;
				if (seg.hasExpansion) hasExpansion = true;
				if (seg.hasCommandSub) hasCommandSub = true;
				if (!seg.resolvable) resolvable = false;
				continue;
			}
			if (c === "$") {
				this.consumeDollarExpansion();
				resolvable = false;
				hasExpansion = true;
				if (this.lastWasCommandSub) hasCommandSub = true;
				continue;
			}
			if (c === "`") {
				this.consumeBacktick();
				resolvable = false;
				hasExpansion = true;
				hasCommandSub = true;
				continue;
			}
			resolved += c;
			this.i++;
		}
		const raw = this.src.slice(start, this.i);
		if (raw === "") return;
		const assignMatch = /^[A-Za-z_][A-Za-z0-9_]*=/.exec(raw);
		const isAssignment = assignMatch !== null && this.startsCommand();
		this.tokens.push({
			kind: isAssignment ? "assignment" : "word",
			raw,
			resolved: resolvable ? resolved : undefined,
			has_expansion: hasExpansion,
			has_command_sub: hasCommandSub,
		});
	}

	private startsCommand(): boolean {
		if (this.tokens.length === 0) return true;
		const last = this.tokens[this.tokens.length - 1];
		switch (last.kind) {
			case "pipe":
			case "and_if":
			case "or_if":
			case "semi":
			case "amp":
			case "newline":
			case "lparen":
			case "process_sub_in":
			case "process_sub_out":
			case "comment":
			case "assignment":
				return true;
			default:
				return false;
		}
	}

	private consumeSingleQuoted(): string | null {
		this.i++;
		const start = this.i;
		while (this.i < this.len && this.src[this.i] !== "'") this.i++;
		if (this.i >= this.len) return null;
		const inner = this.src.slice(start, this.i);
		this.i++;
		return inner;
	}

	private consumeAnsiCQuoted(): string | null {
		this.i += 2;
		let out = "";
		while (this.i < this.len && this.src[this.i] !== "'") {
			const c = this.src[this.i];
			if (c === "\\") {
				const next = this.peek(1);
				switch (next) {
					case "n": out += "\n"; this.i += 2; continue;
					case "t": out += "\t"; this.i += 2; continue;
					case "r": out += "\r"; this.i += 2; continue;
					case "\\": out += "\\"; this.i += 2; continue;
					case "'": out += "'"; this.i += 2; continue;
					case '"': out += '"'; this.i += 2; continue;
					case "0": out += "\0"; this.i += 2; continue;
					case "x": {
						const hex = this.src.slice(this.i + 2, this.i + 4);
						if (/^[0-9a-fA-F]{2}$/.test(hex)) {
							out += String.fromCharCode(parseInt(hex, 16));
							this.i += 4;
							continue;
						}
						out += next;
						this.i += 2;
						continue;
					}
					case "u": {
						const hex = this.src.slice(this.i + 2, this.i + 6);
						if (/^[0-9a-fA-F]{4}$/.test(hex)) {
							out += String.fromCharCode(parseInt(hex, 16));
							this.i += 6;
							continue;
						}
						out += next;
						this.i += 2;
						continue;
					}
					default:
						out += next;
						this.i += 2;
						continue;
				}
			}
			out += c;
			this.i++;
		}
		if (this.i >= this.len) return null;
		this.i++;
		return out;
	}

	private consumeDoubleQuoted(): {
		literal: string;
		hasExpansion: boolean;
		hasCommandSub: boolean;
		resolvable: boolean;
	} | null {
		this.i++;
		let literal = "";
		let hasExpansion = false;
		let hasCommandSub = false;
		let resolvable = true;
		while (this.i < this.len && this.src[this.i] !== '"') {
			const c = this.src[this.i];
			if (c === "\\") {
				const next = this.peek(1);
				if (
					next === "$" ||
					next === "`" ||
					next === '"' ||
					next === "\\" ||
					next === "\n"
				) {
					if (next !== "\n") literal += next;
					this.i += 2;
					continue;
				}
				literal += c;
				this.i++;
				continue;
			}
			if (c === "$") {
				this.consumeDollarExpansion();
				resolvable = false;
				hasExpansion = true;
				if (this.lastWasCommandSub) hasCommandSub = true;
				continue;
			}
			if (c === "`") {
				this.consumeBacktick();
				resolvable = false;
				hasExpansion = true;
				hasCommandSub = true;
				continue;
			}
			literal += c;
			this.i++;
		}
		if (this.i >= this.len) return null;
		this.i++;
		return { literal, hasExpansion, hasCommandSub, resolvable };
	}

	private consumeDollarExpansion(): void {
		this.lastWasCommandSub = false;
		this.i++;
		const c = this.src[this.i];
		if (c === "(") {
			if (this.peek(1) === "(") {
				this.consumeBalanced("((", "))");
				return;
			}
			this.consumeBalanced("(", ")");
			this.lastWasCommandSub = true;
			return;
		}
		if (c === "{") {
			this.consumeBalanced("{", "}");
			return;
		}
		if (c !== undefined && /[A-Za-z_]/.test(c)) {
			while (
				this.i < this.len &&
				/[A-Za-z0-9_]/.test(this.src[this.i])
			) {
				this.i++;
			}
		}
	}

	private consumeBacktick(): void {
		this.i++;
		while (this.i < this.len && this.src[this.i] !== "`") {
			if (this.src[this.i] === "\\" && this.i + 1 < this.len) {
				this.i += 2;
				continue;
			}
			this.i++;
		}
		if (this.i < this.len) this.i++;
	}

	private consumeBalanced(open: string, close: string): void {
		this.i += open.length;
		let depth = 1;
		while (this.i < this.len && depth > 0) {
			if (this.src.startsWith(close, this.i)) {
				depth--;
				this.i += close.length;
				continue;
			}
			if (this.src.startsWith(open, this.i)) {
				depth++;
				this.i += open.length;
				continue;
			}
			if (this.src[this.i] === "\\" && this.i + 1 < this.len) {
				this.i += 2;
				continue;
			}
			if (this.src[this.i] === "'") {
				this.i++;
				while (this.i < this.len && this.src[this.i] !== "'") this.i++;
				if (this.i < this.len) this.i++;
				continue;
			}
			if (this.src[this.i] === '"') {
				this.i++;
				while (this.i < this.len && this.src[this.i] !== '"') {
					if (this.src[this.i] === "\\" && this.i + 1 < this.len) {
						this.i += 2;
						continue;
					}
					this.i++;
				}
				if (this.i < this.len) this.i++;
				continue;
			}
			this.i++;
		}
	}
}

/**
 * Public lexer entry — turns a shell command line into a Token[].
 * Never throws; lexer-level errors land in the returned `errors` array
 * and the parser treats the result as `confidence: "unknown"`.
 */
export function tokenize(input: string): {
	tokens: Token[];
	errors: string[];
} {
	const t = new Lexer(input);
	const tokens = t.run();
	return { tokens, errors: t.errors };
}
