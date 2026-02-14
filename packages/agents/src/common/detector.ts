import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getHomeDir } from "@patchwork/core";

export interface DetectedAgent {
	name: string;
	type: "claude-code" | "codex" | "cursor";
	version: string | null;
	binaryPath: string | null;
	configDir: string | null;
	installed: boolean;
}

/**
 * Auto-detect which AI coding agents are installed on this machine.
 */
export function detectInstalledAgents(): DetectedAgent[] {
	const agents: DetectedAgent[] = [];
	const homeDir = getHomeDir();

	// Claude Code
	const claudePath = findBinary("claude");
	agents.push({
		name: "Claude Code",
		type: "claude-code",
		version: claudePath ? getVersion(claudePath, "--version") : null,
		binaryPath: claudePath,
		configDir: existsSync(join(homeDir, ".claude"))
			? join(homeDir, ".claude")
			: null,
		installed: claudePath !== null,
	});

	// Codex CLI
	const codexPath = findBinary("codex");
	agents.push({
		name: "Codex CLI",
		type: "codex",
		version: codexPath ? getVersion(codexPath, "--version") : null,
		binaryPath: codexPath,
		configDir: existsSync(join(homeDir, ".codex"))
			? join(homeDir, ".codex")
			: null,
		installed: codexPath !== null,
	});

	// Cursor
	const cursorPath = findBinary("cursor");
	agents.push({
		name: "Cursor",
		type: "cursor",
		version: cursorPath ? getVersion(cursorPath, "--version") : null,
		binaryPath: cursorPath,
		configDir: null,
		installed: cursorPath !== null,
	});

	return agents;
}

function findBinary(name: string): string | null {
	try {
		const cmd = process.platform === "win32" ? `where ${name}` : `which ${name}`;
		const result = execSync(cmd, { encoding: "utf-8", timeout: 3000 }).trim();
		if (!result) return null;
		return result.split(/\r?\n/)[0]?.trim() || null;
	} catch {
		return null;
	}
}

function getVersion(binaryPath: string, flag: string): string | null {
	try {
		const result = execSync(`"${binaryPath}" ${flag}`, {
			encoding: "utf-8",
			timeout: 5000,
		}).trim();
		// Extract version number from output
		const match = result.match(/(\d+\.\d+\.?\d*)/);
		return match ? match[1] : result.slice(0, 50);
	} catch {
		return null;
	}
}
