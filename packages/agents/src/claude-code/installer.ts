import { existsSync, mkdirSync, readFileSync, writeFileSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { getHomeDir } from "@patchwork/core";

const CLAUDE_SETTINGS_DIR = join(getHomeDir(), ".claude");
const CLAUDE_SETTINGS_PATH = join(CLAUDE_SETTINGS_DIR, "settings.json");

/**
 * Matches any command that contains "patchwork hook" — with or without
 * leading env-var prefixes like `PATCHWORK_PRETOOL_FAIL_CLOSED=1`.
 */
const PATCHWORK_HOOK_RE = /\bpatchwork hook\b/;

/** A single hook handler within a matcher group. */
interface HookHandler {
	type: string;
	command: string;
	timeout: number;
}

/** A Claude Code hook matcher group — the format Claude Code actually expects. */
interface HookMatcherGroup {
	matcher: string;
	hooks: HookHandler[];
}

/** Valid policy modes for PreToolUse enforcement. */
export type PolicyMode = "audit" | "fail-closed";

/** Valid telemetry destination values. */
export type TelemetryDest = "stderr" | "file" | "both";

/** Valid lock mode values for telemetry file writes. */
export type TelemetryLockMode = "always" | "rotate-only";

/** Options that control PreToolUse enforcement behavior. */
export interface InstallOptions {
	policyMode?: PolicyMode;
	pretoolFailClosed?: boolean;
	pretoolWarnMs?: number;
	pretoolTelemetryJson?: boolean;
	pretoolTelemetryDest?: TelemetryDest;
	pretoolTelemetryFile?: string;
	pretoolTelemetryMaxBytes?: number;
	pretoolTelemetryMaxFiles?: number;
	pretoolTelemetryLockMode?: TelemetryLockMode;
}

/**
 * Hook definitions that Patchwork installs into Claude Code's settings.json.
 *
 * These call `patchwork hook <event>` which reads JSON on stdin and
 * writes the normalized audit event to ~/.patchwork/events.jsonl.
 */
/**
 * Resolve whether fail-closed is enabled from options.
 * `policyMode` takes precedence over the legacy `pretoolFailClosed` flag.
 * Returns an error string if both are provided and conflict.
 */
export function resolveFailClosed(options?: InstallOptions): { enabled: boolean; error?: string } {
	if (!options) return { enabled: false };

	const modeSet = options.policyMode !== undefined;
	const legacySet = options.pretoolFailClosed !== undefined;

	if (modeSet && legacySet) {
		const modeWants = options.policyMode === "fail-closed";
		const legacyWants = !!options.pretoolFailClosed;
		if (modeWants !== legacyWants) {
			return {
				enabled: false,
				error: "Conflicting options: --policy-mode and --pretool-fail-closed disagree. Use one or the other.",
			};
		}
		// Both agree — policyMode wins (no conflict)
		return { enabled: modeWants };
	}

	if (modeSet) return { enabled: options.policyMode === "fail-closed" };
	if (legacySet) return { enabled: !!options.pretoolFailClosed };
	return { enabled: false };
}

function buildHooks(binPath?: string, options?: InstallOptions) {
	const isWindows = process.platform === "win32";

	// Use explicit "node patchwork" to bypass #!/usr/bin/env node shebang issues
	// on mixed-architecture Macs (Intel machine with ARM homebrew node).
	// process.execPath gives us the node binary that is CURRENTLY running — guaranteed correct arch.
	const nodeExec = process.execPath;
	let patchworkBin = binPath || "";

	if (!patchworkBin) {
		// Resolve patchwork binary from the same directory as the running node
		const nodeDir = dirname(nodeExec);
		// On Windows, check for .cmd wrapper first
		const candidates = isWindows
			? [join(nodeDir, "patchwork.cmd"), join(nodeDir, "patchwork")]
			: [join(nodeDir, "patchwork")];
		for (const candidate of candidates) {
			if (existsSync(candidate)) {
				patchworkBin = candidate;
				break;
			}
		}
		if (!patchworkBin) patchworkBin = "patchwork"; // fallback to PATH
	}

	const cmd = `${nodeExec} ${patchworkBin}`;

	// Build env prefix for PreToolUse command
	const { enabled: failClosed } = resolveFailClosed(options);
	const envParts: string[] = [];
	if (failClosed) {
		envParts.push("PATCHWORK_PRETOOL_FAIL_CLOSED=1");
	}
	if (options?.pretoolWarnMs !== undefined) {
		envParts.push(`PATCHWORK_PRETOOL_WARN_MS=${options.pretoolWarnMs}`);
	}
	if (options?.pretoolTelemetryJson) {
		envParts.push("PATCHWORK_PRETOOL_TELEMETRY_JSON=1");
	}
	if (options?.pretoolTelemetryDest) {
		envParts.push(`PATCHWORK_PRETOOL_TELEMETRY_DEST=${options.pretoolTelemetryDest}`);
	}
	if (options?.pretoolTelemetryFile) {
		envParts.push(`PATCHWORK_PRETOOL_TELEMETRY_FILE=${options.pretoolTelemetryFile}`);
	}
	if (options?.pretoolTelemetryMaxBytes !== undefined) {
		envParts.push(`PATCHWORK_PRETOOL_TELEMETRY_MAX_BYTES=${options.pretoolTelemetryMaxBytes}`);
	}
	if (options?.pretoolTelemetryMaxFiles !== undefined) {
		envParts.push(`PATCHWORK_PRETOOL_TELEMETRY_MAX_FILES=${options.pretoolTelemetryMaxFiles}`);
	}
	if (options?.pretoolTelemetryLockMode) {
		envParts.push(`PATCHWORK_PRETOOL_TELEMETRY_LOCK_MODE=${options.pretoolTelemetryLockMode}`);
	}
	const preToolCmd = envParts.length > 0
		? `${envParts.join(" ")} ${cmd} hook pre-tool`
		: `${cmd} hook pre-tool`;

	// Claude Code expects: event -> [{ matcher, hooks: [{ type, command, timeout }] }]
	// matcher: "" matches all tools/events.
	const wrap = (handler: HookHandler): HookMatcherGroup[] => [
		{ matcher: "", hooks: [handler] },
	];

	return {
		PreToolUse: wrap({ type: "command", command: preToolCmd, timeout: 2000 }),
		PostToolUse: wrap({ type: "command", command: `${cmd} hook post-tool`, timeout: 2000 }),
		PostToolUseFailure: wrap({ type: "command", command: `${cmd} hook post-tool-failure`, timeout: 2000 }),
		SessionStart: wrap({ type: "command", command: `${cmd} hook session-start`, timeout: 3000 }),
		SessionEnd: wrap({ type: "command", command: `${cmd} hook session-end`, timeout: 1500 }),
		UserPromptSubmit: wrap({ type: "command", command: `${cmd} hook prompt-submit`, timeout: 1500 }),
		SubagentStart: wrap({ type: "command", command: `${cmd} hook subagent-start`, timeout: 1500 }),
		SubagentStop: wrap({ type: "command", command: `${cmd} hook subagent-stop`, timeout: 1500 }),
	};
}

export interface InstallResult {
	success: boolean;
	settingsPath: string;
	hooksInstalled: string[];
	hooksUpdated: string[];
	error?: string;
}

/**
 * Installs Patchwork hooks into Claude Code's settings.json.
 *
 * - Creates ~/.claude/ if it doesn't exist
 * - Merges hooks into existing settings (preserving user's other settings)
 * - Appends to existing hook arrays (doesn't overwrite user hooks)
 */
export function installClaudeCodeHooks(
	projectPath?: string,
	binPath?: string,
	options?: InstallOptions,
): InstallResult {
	const settingsPath = projectPath
		? join(projectPath, ".claude", "settings.json")
		: CLAUDE_SETTINGS_PATH;

	const settingsDir = join(settingsPath, "..");

	// Check for conflicting options before any I/O
	const resolved = resolveFailClosed(options);
	if (resolved.error) {
		return {
			success: false,
			settingsPath,
			hooksInstalled: [],
			hooksUpdated: [],
			error: resolved.error,
		};
	}

	try {
		if (!existsSync(settingsDir)) {
			mkdirSync(settingsDir, { recursive: true });
		}

		// Read existing settings
		let settings: Record<string, unknown> = {};
		if (existsSync(settingsPath)) {
			const content = readFileSync(settingsPath, "utf-8");
			settings = JSON.parse(content);
		}

		// Merge hooks
		const existingHooks = (settings.hooks || {}) as Record<string, unknown[]>;
		const hooksInstalled: string[] = [];
		const hooksUpdated: string[] = [];
		const PATCHWORK_HOOKS = buildHooks(binPath, options);

		for (const [eventName, hookDefs] of Object.entries(PATCHWORK_HOOKS)) {
			const existing = existingHooks[eventName] || [];
			const desiredCmd = hookDefs[0].hooks[0].command;

			// Find existing patchwork matcher group (check nested hooks[].command)
			const patchworkIdx = existing.findIndex((entry: any) => {
				// Handle both new nested format and legacy flat format
				if (Array.isArray(entry.hooks)) {
					return entry.hooks.some(
						(h: any) => typeof h.command === "string" && PATCHWORK_HOOK_RE.test(h.command),
					);
				}
				// Legacy flat format: { type, command, timeout }
				return typeof entry.command === "string" && PATCHWORK_HOOK_RE.test(entry.command);
			});

			if (patchworkIdx === -1) {
				// No patchwork hook yet — append
				existingHooks[eventName] = [...existing, ...hookDefs];
				hooksInstalled.push(eventName);
			} else {
				// Patchwork hook exists — replace with correct nested format
				const current = existing[patchworkIdx] as any;
				const currentCmd = Array.isArray(current.hooks)
					? current.hooks[0]?.command
					: current.command;

				// Always replace to ensure correct nested structure
				if (currentCmd !== desiredCmd || !Array.isArray(current.hooks)) {
					existing[patchworkIdx] = hookDefs[0];
					hooksUpdated.push(eventName);
				}
			}
		}

		settings.hooks = existingHooks;

		// Write back
		writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");

		return {
			success: true,
			settingsPath,
			hooksInstalled,
			hooksUpdated,
		};
	} catch (err) {
		return {
			success: false,
			settingsPath,
			hooksInstalled: [],
			hooksUpdated: [],
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Removes Patchwork hooks from Claude Code's settings.json.
 */
export function uninstallClaudeCodeHooks(projectPath?: string): InstallResult {
	const settingsPath = projectPath
		? join(projectPath, ".claude", "settings.json")
		: CLAUDE_SETTINGS_PATH;

	try {
		if (!existsSync(settingsPath)) {
			return { success: true, settingsPath, hooksInstalled: [], hooksUpdated: [] };
		}

		const content = readFileSync(settingsPath, "utf-8");
		const settings = JSON.parse(content);
		const hooks = (settings.hooks || {}) as Record<string, unknown[]>;
		const removed: string[] = [];

		for (const [eventName, hookList] of Object.entries(hooks)) {
			const filtered = hookList.filter((entry: any) => {
				// Handle nested format: { matcher, hooks: [{ command }] }
				if (Array.isArray(entry.hooks)) {
					return !entry.hooks.some(
						(h: any) => typeof h.command === "string" && PATCHWORK_HOOK_RE.test(h.command),
					);
				}
				// Handle legacy flat format: { type, command }
				return !(typeof entry.command === "string" && PATCHWORK_HOOK_RE.test(entry.command));
			});
			if (filtered.length !== hookList.length) {
				removed.push(eventName);
			}
			if (filtered.length === 0) {
				delete hooks[eventName];
			} else {
				hooks[eventName] = filtered;
			}
		}

		settings.hooks = hooks;
		writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");

		return { success: true, settingsPath, hooksInstalled: removed, hooksUpdated: [] };
	} catch (err) {
		return {
			success: false,
			settingsPath,
			hooksInstalled: [],
			hooksUpdated: [],
			error: err instanceof Error ? err.message : String(err),
		};
	}
}
