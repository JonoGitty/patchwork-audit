import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { computeEventHash } from "@patchwork/core";

function makeLegacyEvent(id: string): Record<string, unknown> {
	return {
		id,
		session_id: "ses_test",
		timestamp: "2026-01-01T00:00:00.000Z",
		agent: "claude-code",
		action: "file_read",
		status: "completed",
		risk: { level: "low", flags: [] },
	};
}

function makeChainedEvents(count: number): Record<string, unknown>[] {
	const events: Record<string, unknown>[] = [];
	for (let i = 0; i < count; i++) {
		const e: Record<string, unknown> = {
			id: `evt_${i}`,
			session_id: "ses_test",
			timestamp: `2026-01-01T00:00:0${i}.000Z`,
			agent: "claude-code",
			action: "file_read",
			status: "completed",
			risk: { level: "low", flags: [] },
			prev_hash: i === 0 ? null : (events[i - 1].event_hash as string),
		};
		e.event_hash = computeEventHash(e);
		events.push(e);
	}
	return events;
}

function writeJsonl(filePath: string, lines: string[]): void {
	writeFileSync(filePath, lines.join("\n") + "\n", "utf-8");
}

async function runVerify(args: string[]): Promise<{ exitCode: number | undefined; output: string[] }> {
	vi.resetModules();
	const { verifyCommand } = await import("../../src/commands/verify.js");
	const output: string[] = [];
	const logSpy = vi.spyOn(console, "log").mockImplementation((...a) => {
		output.push(a.map(String).join(" "));
	});
	const previousExitCode = process.exitCode;
	process.exitCode = undefined;
	try {
		verifyCommand.parse(["node", "verify", ...args], { from: "node" });
		return { exitCode: process.exitCode, output };
	} finally {
		process.exitCode = previousExitCode;
		logSpy.mockRestore();
	}
}

describe("verify command", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-verify-cmd-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("passes for a valid chain", async () => {
		const events = makeChainedEvents(5);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const { exitCode } = await runVerify(["--file", filePath, "--no-seal-check"]);
		expect(exitCode).toBeUndefined();
	});

	it("exits non-zero when JSON parse errors are present", async () => {
		const events = makeChainedEvents(1);
		const filePath = join(tmpDir, "parse-error.jsonl");
		writeJsonl(filePath, [JSON.stringify(events[0]), "NOT_VALID_JSON"]);

		const { exitCode } = await runVerify(["--file", filePath, "--no-seal-check"]);
		expect(exitCode).toBe(1);
	});

	it("exits non-zero when schema-invalid events are present", async () => {
		const events = makeChainedEvents(1);
		const filePath = join(tmpDir, "schema-invalid.jsonl");
		writeJsonl(filePath, [JSON.stringify(events[0]), JSON.stringify({ id: "evt_bad" })]);

		const { exitCode } = await runVerify(["--file", filePath, "--no-seal-check"]);
		expect(exitCode).toBe(1);
	});

	it("allows invalid/corrupt events when --allow-invalid is set", async () => {
		const events = makeChainedEvents(1);
		const filePath = join(tmpDir, "allow-invalid.jsonl");
		writeJsonl(filePath, [
			JSON.stringify(events[0]),
			JSON.stringify({ id: "evt_bad" }),
			"NOT_VALID_JSON",
		]);

		const { exitCode } = await runVerify(["--file", filePath, "--allow-invalid", "--no-seal-check"]);
		expect(exitCode).toBeUndefined();
	});

	it("strict mode fails when legacy events are present", async () => {
		const legacy = makeLegacyEvent("evt_legacy");
		const chained = makeChainedEvents(1)[0];
		const filePath = join(tmpDir, "strict.jsonl");
		writeJsonl(filePath, [JSON.stringify(legacy), JSON.stringify(chained)]);

		const { exitCode: looseExitCode } = await runVerify(["--file", filePath, "--no-seal-check"]);
		expect(looseExitCode).toBeUndefined();

		const { exitCode: strictExitCode } = await runVerify(["--file", filePath, "--strict", "--no-seal-check"]);
		expect(strictExitCode).toBe(1);
	});

	it("--json output includes seal status fields", async () => {
		const events = makeChainedEvents(2);
		const filePath = join(tmpDir, "events.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const { output } = await runVerify(["--file", filePath, "--json", "--no-seal-check"]);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.seal).toBeDefined();
		expect(parsed.seal.seal_checked).toBe(false);
		expect(parsed.seal.seal_failure_reason).toBeNull();
	});

	it("--json with seal check includes all structured fields", async () => {
		const events = makeChainedEvents(2);
		const filePath = join(tmpDir, "events.jsonl");
		const sealPath = join(tmpDir, "nonexistent-seals.jsonl");
		writeJsonl(filePath, events.map((e) => JSON.stringify(e)));

		const { output } = await runVerify(["--file", filePath, "--json", "--seal-file", sealPath]);
		const parsed = JSON.parse(output.join(""));
		expect(parsed.seal.seal_checked).toBe(true);
		expect(parsed.seal.seal_present).toBe(false);
		expect(parsed.seal.seal_valid).toBe(false);
		expect(parsed.seal.seal_tip_match).toBe(false);
		expect(parsed.seal.seal_age_seconds).toBeNull();
		// No failure reason since --require-seal not set
		expect(parsed.seal.seal_failure_reason).toBeNull();
	});
});
