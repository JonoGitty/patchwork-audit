import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function runInit(
	args: string[],
): Promise<{ exitCode: number | undefined; output: string[] }> {
	vi.resetModules();
	const { initCommand } = await import("../../src/commands/init.js");
	const output: string[] = [];
	const logSpy = vi.spyOn(console, "log").mockImplementation((...a) => {
		output.push(a.map(String).join(" "));
	});
	const previousExitCode = process.exitCode;
	process.exitCode = undefined;
	try {
		initCommand.parse(["node", "init", ...args], { from: "node" });
		return { exitCode: process.exitCode, output };
	} finally {
		process.exitCode = previousExitCode;
		logSpy.mockRestore();
	}
}

describe("init --pretool flags", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-init-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("E: passes --pretool-fail-closed through to installer", async () => {
		await runInit([
			"claude-code",
			"--project", tmpDir,
			"--pretool-fail-closed",
		]);
		const settingsPath = join(tmpDir, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		const cmd = settings.hooks.PreToolUse[0].command;
		expect(cmd).toContain("PATCHWORK_PRETOOL_FAIL_CLOSED=1");
	});

	it("E: passes --pretool-warn-ms through to installer", async () => {
		await runInit([
			"claude-code",
			"--project", tmpDir,
			"--pretool-warn-ms", "600",
		]);
		const settingsPath = join(tmpDir, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		const cmd = settings.hooks.PreToolUse[0].command;
		expect(cmd).toContain("PATCHWORK_PRETOOL_WARN_MS=600");
	});

	it("E: validates bad --pretool-warn-ms with clear error", async () => {
		const { exitCode, output } = await runInit([
			"claude-code",
			"--project", tmpDir,
			"--pretool-warn-ms", "notanumber",
		]);
		expect(exitCode).toBe(1);
		const joined = output.join("\n");
		expect(joined).toContain("Invalid --pretool-warn-ms");
		expect(joined).toContain("notanumber");
	});

	it("E: validates negative --pretool-warn-ms", async () => {
		const { exitCode, output } = await runInit([
			"claude-code",
			"--project", tmpDir,
			"--pretool-warn-ms", "-5",
		]);
		expect(exitCode).toBe(1);
		const joined = output.join("\n");
		expect(joined).toContain("Invalid --pretool-warn-ms");
	});

	it("E: init output reflects updated path on reconfiguration", async () => {
		// First install
		await runInit(["claude-code", "--project", tmpDir]);
		// Reinstall with fail-closed
		const { output } = await runInit([
			"claude-code",
			"--project", tmpDir,
			"--pretool-fail-closed",
		]);
		const joined = output.join("\n");
		expect(joined).toContain("updated");
		expect(joined).toContain("PreToolUse");
	});

	it("B: --policy-mode fail-closed passes through and updates hook command", async () => {
		// First install without options
		await runInit(["claude-code", "--project", tmpDir]);
		// Reinstall with --policy-mode fail-closed
		const { output } = await runInit([
			"claude-code",
			"--project", tmpDir,
			"--policy-mode", "fail-closed",
		]);
		const settingsPath = join(tmpDir, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		const cmd = settings.hooks.PreToolUse[0].command;
		expect(cmd).toContain("PATCHWORK_PRETOOL_FAIL_CLOSED=1");
		expect(output.join("\n")).toContain("updated");
	});

	it("C: invalid --policy-mode fails with clear error", async () => {
		const { exitCode, output } = await runInit([
			"claude-code",
			"--project", tmpDir,
			"--policy-mode", "yolo",
		]);
		expect(exitCode).toBe(1);
		const joined = output.join("\n");
		expect(joined).toContain("Invalid --policy-mode");
		expect(joined).toContain("yolo");
	});

	it("defaults: no env prefix without options", async () => {
		await runInit([
			"claude-code",
			"--project", tmpDir,
		]);
		const settingsPath = join(tmpDir, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		const cmd = settings.hooks.PreToolUse[0].command;
		expect(cmd).toBe("patchwork hook pre-tool");
	});
});
