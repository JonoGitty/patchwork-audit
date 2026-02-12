import type { Action, Risk, Target } from "../schema/event.js";
import { SENSITIVE_GLOBS, matchesGlob } from "./sensitive.js";

/**
 * Patterns that indicate dangerous commands.
 * Extracted from Tool Factory's starky-approval-policy.yml deny_prefix list.
 */
const DENY_COMMAND_PREFIXES = [
	"rm -rf",
	"rm -r",
	"sudo ",
	"curl ",
	"wget ",
	"ssh ",
	"scp ",
	"dd ",
	":(){ ",
	"chmod 777",
	"mkfs",
	"> /dev/",
];

const HIGH_RISK_COMMAND_PREFIXES = [
	"npm install",
	"npm i ",
	"pip install",
	"brew install",
	"apt install",
	"apt-get install",
	"git rebase",
	"git reset",
	"git push --force",
	"git push -f",
	"docker run",
];

const CONFIG_FILE_PATTERNS = [
	"package.json",
	"package-lock.json",
	"tsconfig.json",
	"Dockerfile",
	"docker-compose",
	".github/workflows",
	".gitlab-ci",
	"Makefile",
	"Cargo.toml",
	"go.mod",
	"pyproject.toml",
	"requirements.txt",
];

export function classifyRisk(action: string, target?: Target): Risk {
	const flags: string[] = [];
	let level: Risk["level"] = "none";

	// Session lifecycle events are always "none"
	if (action.startsWith("session_") || action === "prompt_submit" || action === "response_complete") {
		return { level: "none", flags: [] };
	}

	// File-based risk
	if (target?.path || target?.abs_path) {
		const filePath = target.path || target.abs_path || "";

		// Check sensitive file patterns
		if (SENSITIVE_GLOBS.some((glob) => matchesGlob(filePath, glob))) {
			flags.push("sensitive_path");
			if (action === "file_read") {
				level = raiseLevel(level, "high");
			} else {
				level = raiseLevel(level, "critical");
			}
		}

		// Check config file patterns
		if (CONFIG_FILE_PATTERNS.some((p) => filePath.includes(p))) {
			flags.push("config_file");
			if (action !== "file_read") {
				level = raiseLevel(level, "high");
			}
		}

		// Write actions are at least medium
		if (["file_write", "file_edit", "file_create"].includes(action)) {
			level = raiseLevel(level, "medium");
		}

		// Deletes are at least high
		if (action === "file_delete") {
			flags.push("destructive");
			level = raiseLevel(level, "high");
		}

		// Reads are low
		if (action === "file_read" && level === "none") {
			level = "low";
		}

		// Search operations are low
		if (["file_glob", "file_grep"].includes(action) && level === "none") {
			level = "low";
		}
	}

	// Command-based risk
	if (target?.command) {
		const cmd = target.command.trim().toLowerCase();

		if (DENY_COMMAND_PREFIXES.some((p) => cmd.startsWith(p))) {
			flags.push("dangerous_command");
			level = raiseLevel(level, "critical");
		} else if (HIGH_RISK_COMMAND_PREFIXES.some((p) => cmd.startsWith(p))) {
			flags.push("install_or_modify_command");
			level = raiseLevel(level, "high");
		} else {
			level = raiseLevel(level, "medium");
		}
	}

	// Network-based risk
	if (["web_fetch", "web_search", "api_call"].includes(action)) {
		flags.push("network_access");
		level = raiseLevel(level, "medium");
	}

	// MCP tool calls are at least medium (unknown surface)
	if (action.startsWith("mcp_")) {
		flags.push("mcp_tool");
		level = raiseLevel(level, "medium");
	}

	return { level, flags };
}

const RISK_ORDER: Risk["level"][] = ["none", "low", "medium", "high", "critical"];

function raiseLevel(current: Risk["level"], candidate: Risk["level"]): Risk["level"] {
	const currentIdx = RISK_ORDER.indexOf(current);
	const candidateIdx = RISK_ORDER.indexOf(candidate);
	return candidateIdx > currentIdx ? candidate : current;
}
