import { describe, it, expect } from "vitest";
import {
	isGitCommitCommand,
	extractCommitInfo,
	usesNoVerify,
} from "../../src/claude-code/git-commit-detector.js";

describe("isGitCommitCommand", () => {
	it("detects simple git commit", () => {
		expect(isGitCommitCommand('git commit -m "fix bug"')).toBe(true);
	});

	it("detects git commit -am", () => {
		expect(isGitCommitCommand('git commit -am "quick fix"')).toBe(true);
	});

	it("detects git commit in chained commands", () => {
		expect(isGitCommitCommand('git add . && git commit -m "msg"')).toBe(true);
	});

	it("detects git commit with env vars", () => {
		expect(isGitCommitCommand('GIT_AUTHOR_NAME=bot git commit -m "auto"')).toBe(true);
	});

	it("detects git commit after semicolon", () => {
		expect(isGitCommitCommand('cd repo; git commit -m "msg"')).toBe(true);
	});

	it("detects git commit after ||", () => {
		expect(isGitCommitCommand('git add . || git commit -m "msg"')).toBe(true);
	});

	it("rejects git log", () => {
		expect(isGitCommitCommand("git log --oneline")).toBe(false);
	});

	it("rejects echo containing git commit", () => {
		expect(isGitCommitCommand('echo "git commit is great"')).toBe(false);
	});

	it("rejects single-quoted echo", () => {
		expect(isGitCommitCommand("echo 'git commit -m test'")).toBe(false);
	});

	it("rejects commented out git commit", () => {
		expect(isGitCommitCommand("# git commit -m 'msg'")).toBe(false);
	});

	it("rejects empty string", () => {
		expect(isGitCommitCommand("")).toBe(false);
	});

	it("rejects git status", () => {
		expect(isGitCommitCommand("git status")).toBe(false);
	});

	it("rejects git diff with commit in message", () => {
		expect(isGitCommitCommand("git diff")).toBe(false);
	});
});

describe("extractCommitInfo", () => {
	it("extracts SHA and branch from standard output", () => {
		const result = extractCommitInfo("[main abc1234] Fix the bug\n 1 file changed");
		expect(result).toEqual({ sha: "abc1234", branch: "main" });
	});

	it("extracts from branch with slashes", () => {
		const result = extractCommitInfo("[feature/auth 1234567] Add auth");
		expect(result).toEqual({ sha: "1234567", branch: "feature/auth" });
	});

	it("extracts full 40-char SHA", () => {
		const sha = "a".repeat(40);
		const result = extractCommitInfo(`[main ${sha}] Full hash`);
		expect(result).toEqual({ sha, branch: "main" });
	});

	it("returns null for empty string", () => {
		expect(extractCommitInfo("")).toBeNull();
	});

	it("returns null for non-commit output", () => {
		expect(extractCommitInfo("On branch main\nnothing to commit")).toBeNull();
	});

	it("returns null for failed commit", () => {
		expect(extractCommitInfo("error: pathspec 'x' did not match")).toBeNull();
	});

	it("extracts from multiline output with noise", () => {
		const output = `[main 9f8e7d6] Commit message here
 3 files changed, 45 insertions(+), 12 deletions(-)
 create mode 100644 new-file.ts`;
		const result = extractCommitInfo(output);
		expect(result).toEqual({ sha: "9f8e7d6", branch: "main" });
	});

	it("extracts from a root commit (silently skipped pre-v0.6.9)", () => {
		const output = "[main (root-commit) ab117fb] initial commit\n 1 file changed, 1 insertion(+)";
		const result = extractCommitInfo(output);
		expect(result).toEqual({ sha: "ab117fb", branch: "main" });
	});

	it("extracts from a detached HEAD (multi-token branch label)", () => {
		const result = extractCommitInfo("[detached HEAD 1e8d7e3] cherry-picked");
		expect(result).toEqual({ sha: "1e8d7e3", branch: "detached HEAD" });
	});

	it("extracts root commit on a feature branch", () => {
		const result = extractCommitInfo("[feature/init (root-commit) abcdef0] bootstrap");
		expect(result).toEqual({ sha: "abcdef0", branch: "feature/init" });
	});
});

describe("usesNoVerify", () => {
	it("detects --no-verify", () => {
		expect(usesNoVerify('git commit --no-verify -m "msg"')).toBe(true);
	});

	it("returns false for normal commit", () => {
		expect(usesNoVerify('git commit -m "msg"')).toBe(false);
	});

	it("returns false for git log with verify in message", () => {
		expect(usesNoVerify("git log --no-verify")).toBe(false);
	});
});
