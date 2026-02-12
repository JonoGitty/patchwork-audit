import { z } from "zod";
import { matchesGlob } from "../risk/sensitive.js";

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
});

export type Policy = z.infer<typeof PolicySchema>;
export type PolicyDecision = {
	allowed: boolean;
	reason: string;
	matched_rule?: string;
};

const RISK_ORDER = ["none", "low", "medium", "high", "critical"];

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
	const filePath = input.target?.path || input.target?.abs_path;
	if (filePath && isFileAction(input.action)) {
		const decision = evaluateFileRules(policy.files, filePath);
		if (decision) return decision;
	}

	// 3. Check command rules
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

function matchesCommandRule(
	command: string,
	rule: z.infer<typeof CommandRuleSchema>,
): boolean {
	if (rule.prefix && command.toLowerCase().startsWith(rule.prefix.toLowerCase())) {
		return true;
	}
	if (rule.exact && command.trim() === rule.exact) {
		return true;
	}
	if (rule.regex) {
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
		return url.startsWith(rule.url_prefix);
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

function matchesMcpRule(
	toolName: string,
	rule: z.infer<typeof McpRuleSchema>,
): boolean {
	// MCP tool names follow pattern: mcp__<server>__<tool>
	if (rule.tool && toolName === rule.tool) {
		return true;
	}
	if (rule.server) {
		// Match by server prefix (e.g., server "github" matches "mcp__github__create_issue")
		return toolName.includes(`__${rule.server}__`) || toolName.startsWith(`${rule.server}__`);
	}
	return false;
}
