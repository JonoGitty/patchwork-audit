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
				expect(hook.command).toContain("patchwork hook ");
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
		expect(settings.hooks.PostToolUse[1].command).toContain("patchwork hook");
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
				(h: any) => typeof h.command === "string" && h.command.includes("patchwork hook"),
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
				(h: any) => typeof h.command === "string" && h.command.includes("patchwork hook"),
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

describe("installer PreToolUse options", () => {
	let tmpDir: string;
	let projectPath: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-options-test-"));
		projectPath = tmpDir;
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("A: writes env-prefixed PreToolUse command when options provided", () => {
		installClaudeCodeHooks(projectPath, undefined, {
			pretoolFailClosed: true,
			pretoolWarnMs: 500,
		});
		const settingsPath = join(projectPath, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		const cmd = settings.hooks.PreToolUse[0].command;
		expect(cmd).toContain("PATCHWORK_PRETOOL_FAIL_CLOSED=1");
		expect(cmd).toContain("PATCHWORK_PRETOOL_WARN_MS=500");
		expect(cmd).toContain("patchwork hook pre-tool");

		// Other hooks should not have env prefixes
		const postCmd = settings.hooks.PostToolUse[0].command;
		expect(postCmd).toContain("patchwork hook post-tool");
	});

	it("B: defaults remain unchanged without options", () => {
		installClaudeCodeHooks(projectPath);
		const settingsPath = join(projectPath, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		const cmd = settings.hooks.PreToolUse[0].command;
		expect(cmd).toContain("patchwork hook pre-tool");
		expect(cmd).not.toContain("PATCHWORK_PRETOOL");
	});

	it("A2: writes only fail-closed prefix when warnMs not set", () => {
		installClaudeCodeHooks(projectPath, undefined, { pretoolFailClosed: true });
		const settingsPath = join(projectPath, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		const cmd = settings.hooks.PreToolUse[0].command;
		expect(cmd).toContain("PATCHWORK_PRETOOL_FAIL_CLOSED=1");
		expect(cmd).toContain("patchwork hook pre-tool");
	});

	it("C: re-running install with prefixed command does not duplicate", () => {
		// First install with options
		installClaudeCodeHooks(projectPath, undefined, { pretoolFailClosed: true });
		// Second install without options — should detect existing prefixed hook
		const result2 = installClaudeCodeHooks(projectPath);
		expect(result2.hooksInstalled).not.toContain("PreToolUse");

		const settingsPath = join(projectPath, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		expect(settings.hooks.PreToolUse).toHaveLength(1);
	});

	it("D: uninstall removes prefixed patchwork hooks", () => {
		installClaudeCodeHooks(projectPath, undefined, {
			pretoolFailClosed: true,
			pretoolWarnMs: 200,
		});
		const result = uninstallClaudeCodeHooks(projectPath);
		expect(result.success).toBe(true);
		expect(result.hooksInstalled).toContain("PreToolUse");

		const settingsPath = join(projectPath, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		// PreToolUse should be removed entirely (no hooks left)
		expect(settings.hooks.PreToolUse).toBeUndefined();
	});
});

describe("upgrade-in-place hook reconfiguration", () => {
	let tmpDir: string;
	let projectPath: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-upgrade-test-"));
		projectPath = tmpDir;
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("A: existing unprefixed PreToolUse updates to fail-closed on reinstall", () => {
		// Install without options
		installClaudeCodeHooks(projectPath);
		const settingsPath = join(projectPath, ".claude", "settings.json");
		let settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		expect(settings.hooks.PreToolUse[0].command).toContain("patchwork hook pre-tool");

		// Reinstall with fail-closed
		const result = installClaudeCodeHooks(projectPath, undefined, { pretoolFailClosed: true });
		expect(result.hooksInstalled).not.toContain("PreToolUse");
		expect(result.hooksUpdated).toContain("PreToolUse");

		settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		expect(settings.hooks.PreToolUse).toHaveLength(1);
		expect(settings.hooks.PreToolUse[0].command).toContain("PATCHWORK_PRETOOL_FAIL_CLOSED=1");
		expect(settings.hooks.PreToolUse[0].command).toContain("patchwork hook pre-tool");
	});

	it("B: existing prefixed PreToolUse updates when warn-ms changes", () => {
		installClaudeCodeHooks(projectPath, undefined, {
			pretoolFailClosed: true,
			pretoolWarnMs: 500,
		});
		const settingsPath = join(projectPath, ".claude", "settings.json");

		// Change warn-ms
		const result = installClaudeCodeHooks(projectPath, undefined, {
			pretoolFailClosed: true,
			pretoolWarnMs: 200,
		});
		expect(result.hooksUpdated).toContain("PreToolUse");
		expect(result.hooksInstalled).not.toContain("PreToolUse");

		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		expect(settings.hooks.PreToolUse).toHaveLength(1);
		expect(settings.hooks.PreToolUse[0].command).toContain("PATCHWORK_PRETOOL_WARN_MS=200");
		expect(settings.hooks.PreToolUse[0].command).not.toContain("500");
	});

	it("C: reinstall with identical options does not modify or duplicate", () => {
		installClaudeCodeHooks(projectPath, undefined, { pretoolFailClosed: true });
		const result2 = installClaudeCodeHooks(projectPath, undefined, { pretoolFailClosed: true });

		expect(result2.hooksInstalled).toHaveLength(0);
		expect(result2.hooksUpdated).toHaveLength(0);

		const settingsPath = join(projectPath, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		expect(settings.hooks.PreToolUse).toHaveLength(1);
	});

	it("D: other event hooks remain unchanged during PreToolUse update", () => {
		installClaudeCodeHooks(projectPath);
		const settingsPath = join(projectPath, ".claude", "settings.json");
		const before = JSON.parse(readFileSync(settingsPath, "utf-8"));
		const postCmdBefore = before.hooks.PostToolUse[0].command;
		const sessionCmdBefore = before.hooks.SessionStart[0].command;

		// Update PreToolUse only
		const result = installClaudeCodeHooks(projectPath, undefined, { pretoolFailClosed: true });
		expect(result.hooksUpdated).toEqual(["PreToolUse"]);

		const after = JSON.parse(readFileSync(settingsPath, "utf-8"));
		expect(after.hooks.PostToolUse[0].command).toBe(postCmdBefore);
		expect(after.hooks.SessionStart[0].command).toBe(sessionCmdBefore);
	});

	it("downgrade: removing options reverts to plain command", () => {
		installClaudeCodeHooks(projectPath, undefined, {
			pretoolFailClosed: true,
			pretoolWarnMs: 300,
		});

		const result = installClaudeCodeHooks(projectPath);
		expect(result.hooksUpdated).toContain("PreToolUse");

		const settingsPath = join(projectPath, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		const cmd = settings.hooks.PreToolUse[0].command;
		expect(cmd).toContain("patchwork hook pre-tool");
		expect(cmd).not.toContain("PATCHWORK_PRETOOL");
	});

	it("preserves user hooks in same event during update", () => {
		const claudeDir = join(projectPath, ".claude");
		mkdirSync(claudeDir, { recursive: true });
		writeFileSync(
			join(claudeDir, "settings.json"),
			JSON.stringify({
				hooks: {
					PreToolUse: [
						{ type: "command", command: "other-tool check", timeout: 500 },
						{ type: "command", command: "patchwork hook pre-tool", timeout: 1500 },
					],
				},
			}),
		);

		const result = installClaudeCodeHooks(projectPath, undefined, { pretoolFailClosed: true });
		expect(result.hooksUpdated).toContain("PreToolUse");

		const settings = JSON.parse(readFileSync(join(claudeDir, "settings.json"), "utf-8"));
		expect(settings.hooks.PreToolUse).toHaveLength(2);
		expect(settings.hooks.PreToolUse[0].command).toBe("other-tool check");
		expect(settings.hooks.PreToolUse[1].command).toContain("PATCHWORK_PRETOOL_FAIL_CLOSED=1");
	});
});

describe("installer policyMode option", () => {
	let tmpDir: string;
	let projectPath: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-policymode-test-"));
		projectPath = tmpDir;
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("A: policyMode=fail-closed sets PATCHWORK_PRETOOL_FAIL_CLOSED=1 prefix", () => {
		installClaudeCodeHooks(projectPath, undefined, { policyMode: "fail-closed" });
		const settingsPath = join(projectPath, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		const cmd = settings.hooks.PreToolUse[0].command;
		expect(cmd).toContain("PATCHWORK_PRETOOL_FAIL_CLOSED=1");
		expect(cmd).toContain("patchwork hook pre-tool");
	});

	it("A: policyMode=audit does not set fail-closed prefix", () => {
		installClaudeCodeHooks(projectPath, undefined, { policyMode: "audit" });
		const settingsPath = join(projectPath, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		const cmd = settings.hooks.PreToolUse[0].command;
		expect(cmd).toContain("patchwork hook pre-tool");
	});

	it("conflicting policyMode and pretoolFailClosed returns error", () => {
		const result = installClaudeCodeHooks(projectPath, undefined, {
			policyMode: "audit",
			pretoolFailClosed: true,
		});
		expect(result.success).toBe(false);
		expect(result.error).toContain("Conflicting");
	});

	it("agreeing policyMode and pretoolFailClosed succeeds", () => {
		const result = installClaudeCodeHooks(projectPath, undefined, {
			policyMode: "fail-closed",
			pretoolFailClosed: true,
		});
		expect(result.success).toBe(true);
		const settingsPath = join(projectPath, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		expect(settings.hooks.PreToolUse[0].command).toContain("PATCHWORK_PRETOOL_FAIL_CLOSED=1");
	});

	it("pretoolTelemetryJson adds PATCHWORK_PRETOOL_TELEMETRY_JSON=1 prefix", () => {
		installClaudeCodeHooks(projectPath, undefined, { pretoolTelemetryJson: true });
		const settingsPath = join(projectPath, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		const cmd = settings.hooks.PreToolUse[0].command;
		expect(cmd).toContain("PATCHWORK_PRETOOL_TELEMETRY_JSON=1");
	});
});

describe("installer hook timeouts", () => {
	let tmpDir: string;
	let projectPath: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-timeout-test-"));
		projectPath = tmpDir;
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("E: PreToolUse timeout is 2000ms, PostToolUse 2000ms, others 1500ms+", () => {
		installClaudeCodeHooks(projectPath);
		const settingsPath = join(projectPath, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));

		// PreToolUse should be 2000ms
		const preToolHook = settings.hooks.PreToolUse[0];
		expect(preToolHook.timeout).toBe(2000);

		// PostToolUse should be 2000ms
		const postToolHook = settings.hooks.PostToolUse[0];
		expect(postToolHook.timeout).toBe(2000);

		// SessionStart should be 3000ms
		const sessionStartHook = settings.hooks.SessionStart[0];
		expect(sessionStartHook.timeout).toBe(3000);

		// SessionEnd should be 1500ms
		const sessionEndHook = settings.hooks.SessionEnd[0];
		expect(sessionEndHook.timeout).toBe(1500);

		// UserPromptSubmit should be 1500ms
		const promptHook = settings.hooks.UserPromptSubmit[0];
		expect(promptHook.timeout).toBe(1500);
	});
});
