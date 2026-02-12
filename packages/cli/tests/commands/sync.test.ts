import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
	mkdtempSync,
	mkdirSync,
	rmSync,
	writeFileSync,
	readFileSync,
	existsSync,
	statSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readDivergenceMarker, type DivergenceMarker } from "@patchwork/agents";

function writeMarker(markerPath: string, overrides: Partial<DivergenceMarker> = {}): void {
	const dir = join(markerPath, "..");
	mkdirSync(dir, { recursive: true, mode: 0o700 });
	const marker: DivergenceMarker = {
		schema_version: 1,
		failure_count: 3,
		first_failure_at: "2026-01-01T00:00:00.000Z",
		last_failure_at: "2026-01-01T00:01:00.000Z",
		last_error: "SQLITE_IOERR: disk full",
		...overrides,
	};
	writeFileSync(markerPath, JSON.stringify(marker, null, 2) + "\n", { mode: 0o600 });
}

async function runSyncDbStatus(
	args: string[],
): Promise<{ exitCode: number | undefined; output: string[] }> {
	vi.resetModules();
	const { syncCommand } = await import("../../src/commands/sync.js");
	const output: string[] = [];
	const logSpy = vi.spyOn(console, "log").mockImplementation((...a) => {
		output.push(a.map(String).join(" "));
	});
	const previousExitCode = process.exitCode;
	process.exitCode = undefined;
	try {
		syncCommand.parse(["node", "sync", "db-status", ...args], { from: "node" });
		return { exitCode: process.exitCode, output };
	} finally {
		process.exitCode = previousExitCode;
		logSpy.mockRestore();
	}
}

describe("sync db-status", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-sync-status-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("reports no divergence when marker is absent", async () => {
		const markerPath = join(tmpDir, "state", "sqlite-divergence.json");

		const { exitCode, output } = await runSyncDbStatus([
			"--marker-file", markerPath,
		]);
		expect(exitCode).toBeUndefined(); // exit code 0
		const joined = output.join("\n");
		expect(joined).toContain("No SQLite divergence");
	});

	it("reports divergence when marker is present", async () => {
		const markerPath = join(tmpDir, "state", "sqlite-divergence.json");
		writeMarker(markerPath, { failure_count: 7 });

		const { exitCode, output } = await runSyncDbStatus([
			"--marker-file", markerPath,
		]);
		expect(exitCode).toBeUndefined(); // exit code 0 (informational)
		const joined = output.join("\n");
		expect(joined).toContain("divergence");
		expect(joined).toContain("7");
	});

	it("JSON output includes diverged flag and marker details when present", async () => {
		const markerPath = join(tmpDir, "state", "sqlite-divergence.json");
		writeMarker(markerPath, {
			failure_count: 5,
			last_error: "test error",
		});

		const { output } = await runSyncDbStatus([
			"--marker-file", markerPath,
			"--json",
		]);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.diverged).toBe(true);
		expect(parsed.failure_count).toBe(5);
		expect(parsed.last_error).toBe("test error");
	});

	it("JSON output reports diverged=false when absent", async () => {
		const markerPath = join(tmpDir, "state", "nonexistent.json");

		const { output } = await runSyncDbStatus([
			"--marker-file", markerPath,
			"--json",
		]);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.diverged).toBe(false);
	});

	it("handles corrupt marker file gracefully (reports absent)", async () => {
		const markerPath = join(tmpDir, "state", "sqlite-divergence.json");
		mkdirSync(join(tmpDir, "state"), { recursive: true });
		writeFileSync(markerPath, "NOT_JSON", { mode: 0o600 });

		const { exitCode, output } = await runSyncDbStatus([
			"--marker-file", markerPath,
			"--json",
		]);
		expect(exitCode).toBeUndefined();
		const parsed = JSON.parse(output.join(""));
		expect(parsed.diverged).toBe(false);
	});
});

describe("sync db clears marker", () => {
	let tmpDir: string;
	let originalHome: string | undefined;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-sync-db-clear-test-"));
		originalHome = process.env.HOME;
		process.env.HOME = tmpDir;
	});

	afterEach(() => {
		process.env.HOME = originalHome;
		rmSync(tmpDir, { recursive: true, force: true });
	});

	async function runSyncDb(): Promise<{ exitCode: number | undefined; output: string[] }> {
		vi.resetModules();
		const { syncCommand } = await import("../../src/commands/sync.js");
		const output: string[] = [];
		const logSpy = vi.spyOn(console, "log").mockImplementation((...a) => {
			output.push(a.map(String).join(" "));
		});
		const previousExitCode = process.exitCode;
		process.exitCode = undefined;
		try {
			syncCommand.parse(["node", "sync", "db"], { from: "node" });
			return { exitCode: process.exitCode, output };
		} finally {
			process.exitCode = previousExitCode;
			logSpy.mockRestore();
		}
	}

	it("clears divergence marker after successful sync", async () => {
		// Set up events file
		const patchworkDir = join(tmpDir, ".patchwork");
		mkdirSync(patchworkDir, { recursive: true, mode: 0o700 });
		const eventsPath = join(patchworkDir, "events.jsonl");
		const event = {
			id: "evt_sync1",
			schema_version: 1,
			session_id: "ses_sync",
			timestamp: "2026-01-01T00:00:00.000Z",
			agent: "claude-code",
			action: "file_read",
			status: "completed",
			risk: { level: "low", flags: [] },
		};
		writeFileSync(eventsPath, JSON.stringify(event) + "\n", "utf-8");

		// Create divergence marker
		const markerPath = join(patchworkDir, "state", "sqlite-divergence.json");
		writeMarker(markerPath);

		expect(existsSync(markerPath)).toBe(true);

		const { exitCode, output } = await runSyncDb();
		expect(exitCode).toBeUndefined();

		// Marker should be cleared
		expect(existsSync(markerPath)).toBe(false);
		const joined = output.join("\n");
		expect(joined).toContain("Cleared divergence marker");
	});

	it("warns about existing divergence before syncing", async () => {
		const patchworkDir = join(tmpDir, ".patchwork");
		mkdirSync(patchworkDir, { recursive: true, mode: 0o700 });
		const eventsPath = join(patchworkDir, "events.jsonl");
		const event = {
			id: "evt_sync2",
			schema_version: 1,
			session_id: "ses_sync",
			timestamp: "2026-01-01T00:00:00.000Z",
			agent: "claude-code",
			action: "file_read",
			status: "completed",
			risk: { level: "low", flags: [] },
		};
		writeFileSync(eventsPath, JSON.stringify(event) + "\n", "utf-8");

		// Create divergence marker with specific count
		const markerPath = join(patchworkDir, "state", "sqlite-divergence.json");
		writeMarker(markerPath, { failure_count: 42 });

		const { output } = await runSyncDb();
		const joined = output.join("\n");
		expect(joined).toContain("42");
		expect(joined).toContain("Divergence");
	});

	it("does not clear marker when no events to sync", async () => {
		const patchworkDir = join(tmpDir, ".patchwork");
		mkdirSync(patchworkDir, { recursive: true, mode: 0o700 });
		// Empty events file
		writeFileSync(join(patchworkDir, "events.jsonl"), "", "utf-8");

		const markerPath = join(patchworkDir, "state", "sqlite-divergence.json");
		writeMarker(markerPath);

		await runSyncDb();

		// Marker should still exist — sync did not complete (no events)
		expect(existsSync(markerPath)).toBe(true);
	});

	it("C: successful sync clears stale failure report", async () => {
		const patchworkDir = join(tmpDir, ".patchwork");
		mkdirSync(patchworkDir, { recursive: true, mode: 0o700 });
		const eventsPath = join(patchworkDir, "events.jsonl");
		const event = {
			id: "evt_report_clear",
			schema_version: 1,
			session_id: "ses_report",
			timestamp: "2026-01-01T00:00:00.000Z",
			agent: "claude-code",
			action: "file_read",
			status: "completed",
			risk: { level: "low", flags: [] },
		};
		writeFileSync(eventsPath, JSON.stringify(event) + "\n", "utf-8");

		// Plant a stale failure report from a previous failed sync
		const reportPath = join(patchworkDir, "state", "sync-db-last-failures.json");
		mkdirSync(join(patchworkDir, "state"), { recursive: true, mode: 0o700 });
		writeFileSync(reportPath, JSON.stringify({ schema_version: 1, stale: true }), { mode: 0o600 });
		expect(existsSync(reportPath)).toBe(true);

		const { exitCode } = await runSyncDb();
		expect(exitCode).toBeUndefined();

		// Stale report should be cleaned up on successful sync
		expect(existsSync(reportPath)).toBe(false);
	});

	it("D: divergence marker only cleared on full success (zero append failures)", async () => {
		const patchworkDir = join(tmpDir, ".patchwork");
		mkdirSync(patchworkDir, { recursive: true, mode: 0o700 });
		const eventsPath = join(patchworkDir, "events.jsonl");
		const event = {
			id: "evt_full_success",
			schema_version: 1,
			session_id: "ses_full",
			timestamp: "2026-01-01T00:00:00.000Z",
			agent: "claude-code",
			action: "file_read",
			status: "completed",
			risk: { level: "low", flags: [] },
		};
		writeFileSync(eventsPath, JSON.stringify(event) + "\n", "utf-8");

		// Marker present before sync
		const markerPath = join(patchworkDir, "state", "sqlite-divergence.json");
		writeMarker(markerPath);
		expect(existsSync(markerPath)).toBe(true);

		const { exitCode, output } = await runSyncDb();
		expect(exitCode).toBeUndefined();

		// Marker cleared only because zero append failures
		expect(existsSync(markerPath)).toBe(false);
		const joined = output.join("\n");
		expect(joined).toContain("Cleared divergence marker");
		expect(joined).not.toContain("Divergence marker preserved");
	});
});

describe("sync db partial rebuild failure", () => {
	let tmpDir: string;
	let originalHome: string | undefined;
	let appendSpy: ReturnType<typeof vi.spyOn> | null = null;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-sync-db-fail-test-"));
		originalHome = process.env.HOME;
		process.env.HOME = tmpDir;
	});

	afterEach(() => {
		process.env.HOME = originalHome;
		if (appendSpy) {
			appendSpy.mockRestore();
			appendSpy = null;
		}
		rmSync(tmpDir, { recursive: true, force: true });
	});

	function setupEventsFile(): void {
		const patchworkDir = join(tmpDir, ".patchwork");
		mkdirSync(patchworkDir, { recursive: true, mode: 0o700 });
		const events = [
			{
				id: "evt_f1",
				schema_version: 1,
				session_id: "ses_fail",
				timestamp: "2026-01-01T00:00:00.000Z",
				agent: "claude-code",
				action: "file_read",
				status: "completed",
				risk: { level: "low", flags: [] },
			},
			{
				id: "evt_f2",
				schema_version: 1,
				session_id: "ses_fail",
				timestamp: "2026-01-01T00:00:01.000Z",
				agent: "claude-code",
				action: "file_write",
				status: "completed",
				risk: { level: "medium", flags: [] },
			},
		];
		writeFileSync(
			join(patchworkDir, "events.jsonl"),
			events.map((e) => JSON.stringify(e)).join("\n") + "\n",
			"utf-8",
		);
	}

	async function runSyncDbWithFailingAppend(): Promise<{ exitCode: number | undefined; output: string[] }> {
		vi.resetModules();
		// Import SqliteStore from the SAME fresh module graph so the spy
		// targets the exact prototype the sync command will use.
		const { SqliteStore } = await import("@patchwork/core");
		appendSpy = vi.spyOn(SqliteStore.prototype, "append").mockImplementation(() => {
			throw new Error("SQLITE_IOERR: disk I/O error");
		});
		const { syncCommand } = await import("../../src/commands/sync.js");
		const output: string[] = [];
		const logSpy = vi.spyOn(console, "log").mockImplementation((...a) => {
			output.push(a.map(String).join(" "));
		});
		const previousExitCode = process.exitCode;
		process.exitCode = undefined;
		try {
			syncCommand.parse(["node", "sync", "db"], { from: "node" });
			return { exitCode: process.exitCode, output };
		} finally {
			process.exitCode = previousExitCode;
			logSpy.mockRestore();
		}
	}

	it("keeps marker and exits non-zero when append fails", async () => {
		setupEventsFile();
		const markerPath = join(tmpDir, ".patchwork", "state", "sqlite-divergence.json");
		writeMarker(markerPath);

		const { exitCode } = await runSyncDbWithFailingAppend();
		expect(exitCode).toBe(1);

		// Marker must remain
		expect(existsSync(markerPath)).toBe(true);
	});

	it("prints explicit partial-rebuild warning on append failure", async () => {
		setupEventsFile();
		const markerPath = join(tmpDir, ".patchwork", "state", "sqlite-divergence.json");
		writeMarker(markerPath);

		const { output } = await runSyncDbWithFailingAppend();
		const joined = output.join("\n");
		expect(joined).toContain("Failed:");
		expect(joined).toContain("could not be written");
		expect(joined).toContain("Divergence marker preserved");
		expect(joined).not.toContain("Cleared divergence marker");
	});

	it("does not clear marker even without prior marker when append fails", async () => {
		setupEventsFile();

		// No marker present — but failures should still set exitCode=1
		const { exitCode } = await runSyncDbWithFailingAppend();
		expect(exitCode).toBe(1);
	});

	it("A: persists failure report with expected schema on append failure", async () => {
		setupEventsFile();
		const reportPath = join(tmpDir, ".patchwork", "state", "sync-db-last-failures.json");

		await runSyncDbWithFailingAppend();

		expect(existsSync(reportPath)).toBe(true);
		const report = JSON.parse(readFileSync(reportPath, "utf-8"));
		expect(report.schema_version).toBe(1);
		expect(report.created_at).toBeTruthy();
		expect(report.total_events).toBe(2);
		expect(report.inserted).toBe(0);
		expect(report.append_failures).toBe(2);
		expect(report.failures).toHaveLength(2);
		// Check first failure diagnostic
		expect(report.failures[0].event_id).toBe("evt_f1");
		expect(report.failures[0].error_class).toBe("SQLITE_IOERR");
		expect(report.failures[0].error_message).toContain("disk I/O error");
		expect(report.failures[0].action).toBe("file_read");
		expect(report.failures[0].timestamp).toBeTruthy();
	});

	it("B: failure report has secure permissions (0o600 file, 0o700 dir)", async () => {
		setupEventsFile();
		const stateDir = join(tmpDir, ".patchwork", "state");
		const reportPath = join(stateDir, "sync-db-last-failures.json");

		await runSyncDbWithFailingAppend();

		expect(existsSync(reportPath)).toBe(true);
		const fileStat = statSync(reportPath);
		expect(fileStat.mode & 0o777).toBe(0o600);
		const dirStat = statSync(stateDir);
		expect(dirStat.mode & 0o777).toBe(0o700);
	});
});
