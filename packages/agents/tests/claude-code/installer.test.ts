import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { installClaudeCodeHooks, uninstallClaudeCodeHooks } from "../../src/claude-code/installer.js";

describe("installClaudeCodeHooks", () => {
	let tmpDir: string;
	let projectPath: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-installer-test-"));
		projectPath = tmpDir;
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("creates .claude directory and settings.json", () => {
		const result = installClaudeCodeHooks(projectPath);
		expect(result.success).toBe(true);
		expect(result.hooksInstalled.length).toBeGreaterThan(0);

		const settings = JSON.parse(readFileSync(result.settingsPath, "utf-8"));
		expect(settings.hooks).toBeDefined();
		expect(settings.hooks.PostToolUse).toBeDefined();
		expect(settings.hooks.SessionStart).toBeDefined();
	});

	it("installs hooks for expected events", () => {
		const result = installClaudeCodeHooks(projectPath);
		expect(result.hooksInstalled).toContain("PreToolUse");
		expect(result.hooksInstalled).toContain("PostToolUse");
		expect(result.hooksInstalled).toContain("SessionStart");
		expect(result.hooksInstalled).toContain("SessionEnd");
		expect(result.hooksInstalled).toContain("UserPromptSubmit");
	});

	it("hooks use patchwork hook commands", () => {
		installClaudeCodeHooks(projectPath);
		const settingsPath = join(projectPath, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));

		for (const hookList of Object.values(settings.hooks) as any[]) {
			for (const hook of hookList) {
				expect(hook.command).toMatch(/^patchwork hook /);
				expect(hook.type).toBe("command");
				expect(hook.timeout).toBeGreaterThan(0);
			}
		}
	});

	it("preserves existing settings", () => {
		const claudeDir = join(projectPath, ".claude");
		mkdirSync(claudeDir, { recursive: true });
		writeFileSync(
			join(claudeDir, "settings.json"),
			JSON.stringify({ existingKey: "preserved", hooks: {} }),
		);

		installClaudeCodeHooks(projectPath);
		const settings = JSON.parse(readFileSync(join(claudeDir, "settings.json"), "utf-8"));
		expect(settings.existingKey).toBe("preserved");
		expect(settings.hooks.PostToolUse).toBeDefined();
	});

	it("preserves existing hooks from other tools", () => {
		const claudeDir = join(projectPath, ".claude");
		mkdirSync(claudeDir, { recursive: true });
		writeFileSync(
			join(claudeDir, "settings.json"),
			JSON.stringify({
				hooks: {
					PostToolUse: [{ type: "command", command: "other-tool log", timeout: 500 }],
				},
			}),
		);

		installClaudeCodeHooks(projectPath);
		const settings = JSON.parse(readFileSync(join(claudeDir, "settings.json"), "utf-8"));

		// Should have both the existing hook and our new hook
		expect(settings.hooks.PostToolUse).toHaveLength(2);
		expect(settings.hooks.PostToolUse[0].command).toBe("other-tool log");
		expect(settings.hooks.PostToolUse[1].command).toMatch(/^patchwork hook/);
	});

	it("does not duplicate hooks on repeated install", () => {
		installClaudeCodeHooks(projectPath);
		const result2 = installClaudeCodeHooks(projectPath);

		expect(result2.hooksInstalled).toHaveLength(0); // Already installed

		const settingsPath = join(projectPath, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		// Each event should have exactly 1 patchwork hook
		for (const hookList of Object.values(settings.hooks) as any[]) {
			const patchworkHooks = hookList.filter(
				(h: any) => typeof h.command === "string" && h.command.startsWith("patchwork hook"),
			);
			expect(patchworkHooks).toHaveLength(1);
		}
	});
});

describe("uninstallClaudeCodeHooks", () => {
	let tmpDir: string;
	let projectPath: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-uninstall-test-"));
		projectPath = tmpDir;
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("removes patchwork hooks", () => {
		installClaudeCodeHooks(projectPath);
		const result = uninstallClaudeCodeHooks(projectPath);
		expect(result.success).toBe(true);
		expect(result.hooksInstalled.length).toBeGreaterThan(0); // "hooksInstalled" = removed hooks

		const settingsPath = join(projectPath, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));

		// All hook arrays should be empty or removed
		for (const hookList of Object.values(settings.hooks) as any[]) {
			const patchworkHooks = hookList.filter(
				(h: any) => typeof h.command === "string" && h.command.startsWith("patchwork hook"),
			);
			expect(patchworkHooks).toHaveLength(0);
		}
	});

	it("preserves other tools' hooks", () => {
		const claudeDir = join(projectPath, ".claude");
		mkdirSync(claudeDir, { recursive: true });
		writeFileSync(
			join(claudeDir, "settings.json"),
			JSON.stringify({
				hooks: {
					PostToolUse: [
						{ type: "command", command: "other-tool log", timeout: 500 },
						{ type: "command", command: "patchwork hook post-tool", timeout: 1000 },
					],
				},
			}),
		);

		uninstallClaudeCodeHooks(projectPath);
		const settings = JSON.parse(readFileSync(join(claudeDir, "settings.json"), "utf-8"));
		expect(settings.hooks.PostToolUse).toHaveLength(1);
		expect(settings.hooks.PostToolUse[0].command).toBe("other-tool log");
	});

	it("handles missing settings file gracefully", () => {
		const result = uninstallClaudeCodeHooks(projectPath);
		expect(result.success).toBe(true);
	});
});
