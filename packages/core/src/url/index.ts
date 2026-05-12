/**
 * URL canonicalization + allowlist policy — public API for v0.6.11
 * commit 5. The single source of truth for URL decisions across
 * WebFetch, shell-classifier (commit 4), git-remote resolution
 * (commit 6), and SaaS upload sinks (commit 8).
 */

export {
	canonicalizeUrl,
	evaluateAllowlist,
	decideUrlPolicy,
	type CanonicalUrl,
	type CanonicalReject,
	type CanonicalResult,
	type CanonicalFlags,
	type RejectReason,
	type AllowlistEntry,
	type AllowlistEvalOptions,
	type AllowlistDecision,
	type UrlPolicyDecision,
} from "./canonicalize.js";
