import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CLAUDE_SETTINGS_DIR = join(process.env.HOME || "~", ".claude");
const CLAUDE_SETTINGS_PATH = join(CLAUDE_SETTINGS_DIR, "settings.json");

/**
 * Hook definitions that Patchwork installs into Claude Code's settings.json.
 *
 * These call `patchwork hook <event>` which reads JSON on stdin and
 * writes the normalized audit event to ~/.patchwork/events.jsonl.
 */
function buildHooks(binPath?: string) {
	const cmd = binPath || "patchwork";
	return {
		PreToolUse: [
			{
				type: "command",
				command: `${cmd} hook pre-tool`,
				timeout: 1000,
			},
		],
		PostToolUse: [
			{
				type: "command",
				command: `${cmd} hook post-tool`,
				timeout: 1000,
			},
		],
		PostToolUseFailure: [
			{
				type: "command",
				command: `${cmd} hook post-tool-failure`,
				timeout: 1000,
			},
		],
		SessionStart: [
			{
				type: "command",
				command: `${cmd} hook session-start`,
				timeout: 500,
			},
		],
		SessionEnd: [
			{
				type: "command",
				command: `${cmd} hook session-end`,
				timeout: 500,
			},
		],
		UserPromptSubmit: [
			{
				type: "command",
				command: `${cmd} hook prompt-submit`,
				timeout: 500,
			},
		],
		SubagentStart: [
			{
				type: "command",
				command: `${cmd} hook subagent-start`,
				timeout: 500,
			},
		],
		SubagentStop: [
			{
				type: "command",
				command: `${cmd} hook subagent-stop`,
				timeout: 500,
			},
		],
	};
}

export interface InstallResult {
	success: boolean;
	settingsPath: string;
	hooksInstalled: string[];
	error?: string;
}

/**
 * Installs Patchwork hooks into Claude Code's settings.json.
 *
 * - Creates ~/.claude/ if it doesn't exist
 * - Merges hooks into existing settings (preserving user's other settings)
 * - Appends to existing hook arrays (doesn't overwrite user hooks)
 */
export function installClaudeCodeHooks(projectPath?: string, binPath?: string): InstallResult {
	const settingsPath = projectPath
		? join(projectPath, ".claude", "settings.json")
		: CLAUDE_SETTINGS_PATH;

	const settingsDir = join(settingsPath, "..");

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
		const PATCHWORK_HOOKS = buildHooks(binPath);

		for (const [eventName, hookDefs] of Object.entries(PATCHWORK_HOOKS)) {
			const existing = existingHooks[eventName] || [];

			// Check if patchwork hooks already installed
			const alreadyInstalled = existing.some(
				(h: any) => typeof h.command === "string" && h.command.startsWith("patchwork hook"),
			);

			if (!alreadyInstalled) {
				existingHooks[eventName] = [...existing, ...hookDefs];
				hooksInstalled.push(eventName);
			}
		}

		settings.hooks = existingHooks;

		// Write back
		writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");

		return {
			success: true,
			settingsPath,
			hooksInstalled,
		};
	} catch (err) {
		return {
			success: false,
			settingsPath,
			hooksInstalled: [],
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
			return { success: true, settingsPath, hooksInstalled: [] };
		}

		const content = readFileSync(settingsPath, "utf-8");
		const settings = JSON.parse(content);
		const hooks = (settings.hooks || {}) as Record<string, unknown[]>;
		const removed: string[] = [];

		for (const [eventName, hookList] of Object.entries(hooks)) {
			const filtered = hookList.filter(
				(h: any) => !(typeof h.command === "string" && h.command.startsWith("patchwork hook")),
			);
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

		return { success: true, settingsPath, hooksInstalled: removed };
	} catch (err) {
		return {
			success: false,
			settingsPath,
			hooksInstalled: [],
			error: err instanceof Error ? err.message : String(err),
		};
	}
}
