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
		expect(cmd).toContain("patchwork hook pre-tool");
	});

	it("E: --pretool-telemetry-dest and --pretool-telemetry-file pass through to hook command", async () => {
		await runInit([
			"claude-code",
			"--project", tmpDir,
			"--pretool-telemetry-json",
			"--pretool-telemetry-dest", "both",
			"--pretool-telemetry-file", "/var/log/patchwork/pretool.jsonl",
		]);
		const settingsPath = join(tmpDir, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		const cmd = settings.hooks.PreToolUse[0].command;
		expect(cmd).toContain("PATCHWORK_PRETOOL_TELEMETRY_JSON=1");
		expect(cmd).toContain("PATCHWORK_PRETOOL_TELEMETRY_DEST=both");
		expect(cmd).toContain("PATCHWORK_PRETOOL_TELEMETRY_FILE=/var/log/patchwork/pretool.jsonl");
		expect(cmd).toContain("patchwork hook pre-tool");
	});

	it("F: invalid --pretool-telemetry-dest fails with clear error", async () => {
		const { exitCode, output } = await runInit([
			"claude-code",
			"--project", tmpDir,
			"--pretool-telemetry-dest", "kafka",
		]);
		expect(exitCode).toBe(1);
		const joined = output.join("\n");
		expect(joined).toContain("Invalid --pretool-telemetry-dest");
		expect(joined).toContain("kafka");
	});

	it("F-rot: --pretool-telemetry-max-bytes and --pretool-telemetry-max-files pass through and validate", async () => {
		// Valid values pass through
		await runInit([
			"claude-code",
			"--project", tmpDir,
			"--pretool-telemetry-json",
			"--pretool-telemetry-dest", "file",
			"--pretool-telemetry-max-bytes", "1048576",
			"--pretool-telemetry-max-files", "10",
		]);
		const settingsPath = join(tmpDir, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		const cmd = settings.hooks.PreToolUse[0].command;
		expect(cmd).toContain("PATCHWORK_PRETOOL_TELEMETRY_MAX_BYTES=1048576");
		expect(cmd).toContain("PATCHWORK_PRETOOL_TELEMETRY_MAX_FILES=10");
	});

	it("F-rot: invalid --pretool-telemetry-max-bytes fails clearly", async () => {
		const { exitCode, output } = await runInit([
			"claude-code",
			"--project", tmpDir,
			"--pretool-telemetry-max-bytes", "nope",
		]);
		expect(exitCode).toBe(1);
		const joined = output.join("\n");
		expect(joined).toContain("Invalid --pretool-telemetry-max-bytes");
		expect(joined).toContain("nope");
	});

	it("F-rot: invalid --pretool-telemetry-max-files fails clearly (zero not allowed)", async () => {
		const { exitCode, output } = await runInit([
			"claude-code",
			"--project", tmpDir,
			"--pretool-telemetry-max-files", "0",
		]);
		expect(exitCode).toBe(1);
		const joined = output.join("\n");
		expect(joined).toContain("Invalid --pretool-telemetry-max-files");
	});

	it("G: --pretool-telemetry-lock-mode passes through to hook command", async () => {
		await runInit([
			"claude-code",
			"--project", tmpDir,
			"--pretool-telemetry-lock-mode", "rotate-only",
		]);
		const settingsPath = join(tmpDir, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		const cmd = settings.hooks.PreToolUse[0].command;
		expect(cmd).toContain("PATCHWORK_PRETOOL_TELEMETRY_LOCK_MODE=rotate-only");
		expect(cmd).toContain("patchwork hook pre-tool");
	});

	it("G-invalid: invalid --pretool-telemetry-lock-mode fails with clear error", async () => {
		const { exitCode, output } = await runInit([
			"claude-code",
			"--project", tmpDir,
			"--pretool-telemetry-lock-mode", "yolo",
		]);
		expect(exitCode).toBe(1);
		const joined = output.join("\n");
		expect(joined).toContain("Invalid --pretool-telemetry-lock-mode");
		expect(joined).toContain("yolo");
	});
});

describe("init --strict-profile", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-strict-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("A: strict profile produces fail-closed + telemetry + warn=500", async () => {
		const { output } = await runInit([
			"claude-code",
			"--project", tmpDir,
			"--strict-profile",
		]);
		const settingsPath = join(tmpDir, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		const cmd = settings.hooks.PreToolUse[0].command;
		expect(cmd).toContain("PATCHWORK_PRETOOL_FAIL_CLOSED=1");
		expect(cmd).toContain("PATCHWORK_PRETOOL_WARN_MS=500");
		expect(cmd).toContain("PATCHWORK_PRETOOL_TELEMETRY_JSON=1");
		expect(cmd).toContain("patchwork hook pre-tool");
		// Summary line printed
		const joined = output.join("\n");
		expect(joined).toContain("Strict profile");
		expect(joined).toContain("fail-closed");
	});

	it("B: --strict-profile --pretool-warn-ms 900 uses 900", async () => {
		await runInit([
			"claude-code",
			"--project", tmpDir,
			"--strict-profile",
			"--pretool-warn-ms", "900",
		]);
		const settingsPath = join(tmpDir, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		const cmd = settings.hooks.PreToolUse[0].command;
		expect(cmd).toContain("PATCHWORK_PRETOOL_WARN_MS=900");
		expect(cmd).not.toContain("PATCHWORK_PRETOOL_WARN_MS=500");
		// fail-closed and telemetry still present
		expect(cmd).toContain("PATCHWORK_PRETOOL_FAIL_CLOSED=1");
		expect(cmd).toContain("PATCHWORK_PRETOOL_TELEMETRY_JSON=1");
	});

	it("C: --strict-profile --policy-mode audit results in audit mode, telemetry still on", async () => {
		await runInit([
			"claude-code",
			"--project", tmpDir,
			"--strict-profile",
			"--policy-mode", "audit",
		]);
		const settingsPath = join(tmpDir, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		const cmd = settings.hooks.PreToolUse[0].command;
		// audit mode: no fail-closed prefix
		expect(cmd).not.toContain("PATCHWORK_PRETOOL_FAIL_CLOSED");
		// telemetry and warn still present
		expect(cmd).toContain("PATCHWORK_PRETOOL_WARN_MS=500");
		expect(cmd).toContain("PATCHWORK_PRETOOL_TELEMETRY_JSON=1");
	});

	it("D: no strict profile => defaults unchanged", async () => {
		await runInit([
			"claude-code",
			"--project", tmpDir,
		]);
		const settingsPath = join(tmpDir, ".claude", "settings.json");
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		const cmd = settings.hooks.PreToolUse[0].command;
		expect(cmd).toContain("patchwork hook pre-tool");
	});

	it("E: re-run with strict profile updates existing hook (no duplication)", async () => {
		// First install without strict
		await runInit(["claude-code", "--project", tmpDir]);
		const settingsPath = join(tmpDir, ".claude", "settings.json");
		let settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		expect(settings.hooks.PreToolUse[0].command).toContain("patchwork hook pre-tool");

		// Re-run with strict
		const { output } = await runInit([
			"claude-code",
			"--project", tmpDir,
			"--strict-profile",
		]);
		settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		expect(settings.hooks.PreToolUse).toHaveLength(1);
		expect(settings.hooks.PreToolUse[0].command).toContain("PATCHWORK_PRETOOL_FAIL_CLOSED=1");
		expect(output.join("\n")).toContain("updated");
	});
});
