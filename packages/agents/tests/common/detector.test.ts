import { describe, it, expect, vi, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

vi.mock("node:child_process", () => ({
	execSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
	existsSync: vi.fn(() => false),
}));

const mockedExecSync = vi.mocked(execSync);
const mockedExistsSync = vi.mocked(existsSync);

describe("detectInstalledAgents", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mockedExistsSync.mockReturnValue(false);
	});

	async function loadDetector() {
		// Re-import to get fresh module
		const mod = await import("../../src/common/detector.js");
		return mod.detectInstalledAgents;
	}

	it("detects claude-code when which claude succeeds", async () => {
		mockedExecSync.mockImplementation((cmd: string) => {
			if (cmd === "which claude") return "/usr/local/bin/claude" as any;
			if (cmd.includes("--version")) return "1.2.3" as any;
			throw new Error("not found");
		});

		const detectInstalledAgents = await loadDetector();
		const agents = detectInstalledAgents();
		const claude = agents.find((a) => a.type === "claude-code");
		expect(claude).toBeDefined();
		expect(claude!.installed).toBe(true);
		expect(claude!.binaryPath).toBe("/usr/local/bin/claude");
	});

	it("detects codex when which codex succeeds", async () => {
		mockedExecSync.mockImplementation((cmd: string) => {
			if (cmd === "which codex") return "/usr/local/bin/codex" as any;
			if (cmd.includes("--version")) return "0.5.0" as any;
			throw new Error("not found");
		});

		const detectInstalledAgents = await loadDetector();
		const agents = detectInstalledAgents();
		const codex = agents.find((a) => a.type === "codex");
		expect(codex).toBeDefined();
		expect(codex!.installed).toBe(true);
	});

	it("reports installed: false when which throws", async () => {
		mockedExecSync.mockImplementation(() => {
			throw new Error("not found");
		});

		const detectInstalledAgents = await loadDetector();
		const agents = detectInstalledAgents();
		for (const agent of agents) {
			expect(agent.installed).toBe(false);
			expect(agent.binaryPath).toBeNull();
		}
	});

	it("extracts semver from version output", async () => {
		mockedExecSync.mockImplementation((cmd: string) => {
			if (cmd === "which claude") return "/usr/bin/claude" as any;
			if (cmd.includes("--version")) return "Claude Code v2.11.3 (build abc123)" as any;
			throw new Error("not found");
		});

		const detectInstalledAgents = await loadDetector();
		const agents = detectInstalledAgents();
		const claude = agents.find((a) => a.type === "claude-code");
		expect(claude!.version).toBe("2.11.3");
	});

	it("returns null version when --version throws", async () => {
		mockedExecSync.mockImplementation((cmd: string) => {
			if (cmd === "which claude") return "/usr/bin/claude" as any;
			// --version throws
			if (cmd.includes("--version")) throw new Error("timeout");
			throw new Error("not found");
		});

		const detectInstalledAgents = await loadDetector();
		const agents = detectInstalledAgents();
		const claude = agents.find((a) => a.type === "claude-code");
		expect(claude!.installed).toBe(true);
		expect(claude!.version).toBeNull();
	});

	it("checks config dir existence", async () => {
		mockedExecSync.mockImplementation((cmd: string) => {
			if (cmd === "which claude") return "/usr/bin/claude" as any;
			if (cmd.includes("--version")) return "1.0.0" as any;
			throw new Error("not found");
		});
		mockedExistsSync.mockImplementation((p: any) => {
			return String(p).includes(".claude");
		});

		const detectInstalledAgents = await loadDetector();
		const agents = detectInstalledAgents();
		const claude = agents.find((a) => a.type === "claude-code");
		expect(claude!.configDir).toBeTruthy();
		expect(claude!.configDir).toContain(".claude");
	});

	it("returns all 3 agents in array regardless of install status", async () => {
		mockedExecSync.mockImplementation(() => {
			throw new Error("not found");
		});

		const detectInstalledAgents = await loadDetector();
		const agents = detectInstalledAgents();
		expect(agents).toHaveLength(3);
		const types = agents.map((a) => a.type);
		expect(types).toContain("claude-code");
		expect(types).toContain("codex");
		expect(types).toContain("cursor");
	});
});
