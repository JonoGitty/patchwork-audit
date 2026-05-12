import { describe, it, expect } from "vitest";
import {
	parseGitConfig,
	getConfigValue,
	getConfigValues,
	mergeGitConfig,
	configFromFlat,
} from "../../src/git/parse-config.js";

describe("parseGitConfig — basic sections", () => {
	it("parses [section] key = value", () => {
		const c = parseGitConfig("[core]\nbare = false\n");
		expect(getConfigValue(c, "core", "bare")).toBe("false");
	});

	it("parses [section \"sub\"] form", () => {
		const c = parseGitConfig('[remote "origin"]\nurl = https://github.com/foo/bar\n');
		expect(getConfigValue(c, "remote.origin", "url")).toBe(
			"https://github.com/foo/bar",
		);
	});

	it("parses legacy [section.sub] dotted form", () => {
		const c = parseGitConfig("[branch.main]\nremote = origin\n");
		expect(getConfigValue(c, "branch.main", "remote")).toBe("origin");
	});

	it("section name is case-insensitive but subsection name preserves case (per git semantics)", () => {
		const c = parseGitConfig('[Remote "Origin"]\nURL = x\n');
		// Section "Remote" folds to "remote", subsection "Origin" stays "Origin".
		// Query must use the case-preserved subsection.
		expect(getConfigValue(c, "remote.Origin", "url")).toBe("x");
	});

	it("preserves multi-value keys in order", () => {
		const c = parseGitConfig(`[remote "origin"]
fetch = +refs/heads/*:refs/remotes/origin/*
fetch = +refs/tags/*:refs/tags/*
`);
		expect(getConfigValues(c, "remote.origin", "fetch")).toEqual([
			"+refs/heads/*:refs/remotes/origin/*",
			"+refs/tags/*:refs/tags/*",
		]);
	});
});

describe("parseGitConfig — quoting and escapes", () => {
	it("strips trailing whitespace and #-comments outside quotes", () => {
		const c = parseGitConfig(`[core]\nname = jono # an alias\n`);
		expect(getConfigValue(c, "core", "name")).toBe("jono");
	});

	it("preserves # inside quoted value", () => {
		const c = parseGitConfig(`[core]\nname = "with # hash"\n`);
		expect(getConfigValue(c, "core", "name")).toBe("with # hash");
	});

	it("handles escape sequences \\n \\t \\\\", () => {
		const c = parseGitConfig(`[core]\nx = a\\nb\\tc\\\\d\n`);
		expect(getConfigValue(c, "core", "x")).toBe("a\nb\tc\\d");
	});

	it("boolean shorthand `key` (no =) becomes 'true'", () => {
		const c = parseGitConfig(`[core]\nbare\n`);
		expect(getConfigValue(c, "core", "bare")).toBe("true");
	});

	it("ignores blank lines and ; / # comments", () => {
		const c = parseGitConfig(`# comment
; another
[core]

name = jono
`);
		expect(getConfigValue(c, "core", "name")).toBe("jono");
	});

	it("survives malformed line by skipping it", () => {
		const c = parseGitConfig(`[core]
this-line-has-no-equals-and-no-key
name = jono
`);
		expect(getConfigValue(c, "core", "name")).toBe("jono");
	});
});

describe("parseGitConfig — url.PREFIX subsections", () => {
	it("parses [url \"PREFIX\"] insteadOf for rewrite chains", () => {
		const c = parseGitConfig(`[url "https://github.com/"]
	insteadOf = gh:
	insteadOf = github:
[url "git@github.com:"]
	pushInsteadOf = https://github.com/
`);
		expect(getConfigValues(c, "url.https://github.com/", "insteadof")).toEqual([
			"gh:",
			"github:",
		]);
		expect(
			getConfigValue(c, "url.git@github.com:", "pushinsteadof"),
		).toBe("https://github.com/");
	});
});

describe("mergeGitConfig + configFromFlat", () => {
	it("flat builder produces lookup-able config", () => {
		const c = configFromFlat({
			"remote.x.url": "https://example.com/x",
			"remote.x.pushurl": "https://push.example.com/x",
		});
		expect(getConfigValue(c, "remote.x", "url")).toBe(
			"https://example.com/x",
		);
		expect(getConfigValue(c, "remote.x", "pushurl")).toBe(
			"https://push.example.com/x",
		);
	});

	it("merge overlays last-write-wins per key (replaces values)", () => {
		const a = configFromFlat({ "remote.origin.url": "https://a/" });
		const b = configFromFlat({ "remote.origin.url": "https://b/" });
		const m = mergeGitConfig(a, b);
		expect(getConfigValue(m, "remote.origin", "url")).toBe("https://b/");
	});

	it("merge preserves base sections not present in overlay", () => {
		const a = configFromFlat({ "core.bare": "false" });
		const b = configFromFlat({ "remote.x.url": "https://b/" });
		const m = mergeGitConfig(a, b);
		expect(getConfigValue(m, "core", "bare")).toBe("false");
		expect(getConfigValue(m, "remote.x", "url")).toBe("https://b/");
	});
});
