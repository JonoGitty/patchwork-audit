/**
 * Git remote resolution — public API for v0.6.11 commit 6.
 *
 * Consumed by the PreToolUse enforcement layer (commit 8) when a
 * `git push|fetch|pull|clone|ls-remote` argv reaches a sink-eligible
 * decision. The resolver returns the URLs the operation will hit; the
 * enforcement layer feeds each through `decideUrlPolicy` from the
 * commit-5 URL module.
 */

export {
	parseGitConfig,
	getConfigValue,
	getConfigValues,
	mergeGitConfig,
	configFromFlat,
	type GitConfig,
} from "./parse-config.js";

export {
	resolveGitRemote,
	parseGitArgv,
	extractMutationsFromArgv,
	type ResolveInput,
	type ResolveResult,
	type ResolveSource,
	type AppliedRewrite,
	type ParsedGitArgv,
} from "./resolve-remote.js";
