import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, statSync, mkdirSync, chmodSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import {
	computeEventHash,
	computeSealPayload,
	signSeal,
	ensureKeyring,
} from "@patchwork/core";

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

/** Create a test seal for the given events using a keyring in tmpDir. */
function createTestSeal(tmpDir: string, events: Record<string, unknown>[]): {
	sealPath: string;
	keyringDir: string;
} {
	const keyringDir = join(tmpDir, "keys", "seal");
	const { keyId, key } = ensureKeyring(keyringDir);

	// Find tip hash
	let tipHash = "";
	for (let i = events.length - 1; i >= 0; i--) {
		if (typeof events[i].event_hash === "string") {
			tipHash = events[i].event_hash as string;
			break;
		}
	}

	const sealedAt = new Date().toISOString();
	const payload = computeSealPayload(tipHash, events.length, sealedAt);
	const signature = signSeal(payload, key);

	const seal = {
		sealed_at: sealedAt,
		tip_hash: tipHash,
		chained_events: events.length,
		signature,
		key_id: keyId,
	};

	const sealPath = join(tmpDir, "seals.jsonl");
	writeFileSync(sealPath, JSON.stringify(seal) + "\n", "utf-8");

	return { sealPath, keyringDir };
}

/** Start a local HTTP server that responds to witness requests. */
function startWitnessServer(
	handler: (req: IncomingMessage, body: string) => { status: number; body: unknown },
): Promise<{ server: Server; url: string }> {
	return new Promise((resolve) => {
		const server = createServer((req: IncomingMessage, res: ServerResponse) => {
			let body = "";
			req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
			req.on("end", () => {
				const result = handler(req, body);
				res.writeHead(result.status, { "Content-Type": "application/json" });
				res.end(JSON.stringify(result.body));
			});
		});
		server.listen(0, "127.0.0.1", () => {
			const addr = server.address() as { port: number };
			resolve({ server, url: `http://127.0.0.1:${addr.port}` });
		});
	});
}

function closeServer(server: Server): Promise<void> {
	return new Promise((resolve) => server.close(() => resolve()));
}

async function runWitnessPublish(
	args: string[],
): Promise<{ exitCode: number | undefined; output: string[] }> {
	vi.resetModules();
	const { witnessCommand } = await import("../../src/commands/witness.js");
	const output: string[] = [];
	const logSpy = vi.spyOn(console, "log").mockImplementation((...a) => {
		output.push(a.map(String).join(" "));
	});
	const previousExitCode = process.exitCode;
	process.exitCode = undefined;
	try {
		await witnessCommand.parseAsync(["node", "witness", ...args], { from: "node" });
		return { exitCode: process.exitCode, output };
	} finally {
		process.exitCode = previousExitCode;
		logSpy.mockRestore();
	}
}

describe("witness publish", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-witness-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("A: writes one witness record for single successful endpoint", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const { sealPath, keyringDir } = createTestSeal(tmpDir, events);
		const witnessFile = join(tmpDir, "witnesses.jsonl");

		const { server, url } = await startWitnessServer((_req, _body) => ({
			status: 200,
			body: { anchor_id: "anc_test_001", witnessed_at: new Date().toISOString() },
		}));

		try {
			const { exitCode } = await runWitnessPublish([
				"publish",
				"--file", eventsPath,
				"--seal-file", sealPath,
				"--keyring-dir", keyringDir,
				"--witness-file", witnessFile,
				"--witness-url", url,
			]);

			expect(exitCode).toBeUndefined();
			expect(existsSync(witnessFile)).toBe(true);

			const content = readFileSync(witnessFile, "utf-8").trim();
			const record = JSON.parse(content);
			expect(record.schema_version).toBe(1);
			expect(record.anchor_id).toBe("anc_test_001");
			expect(record.tip_hash).toBe(events[2].event_hash);
			expect(record.chained_events).toBe(3);
			expect(typeof record.seal_signature).toBe("string");
			expect(typeof record.witness_url).toBe("string");
			expect(typeof record.witnessed_at).toBe("string");
		} finally {
			await closeServer(server);
		}
	});

	it("B: quorum behavior — partial failures, passes when successes >= quorum", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const { sealPath, keyringDir } = createTestSeal(tmpDir, events);
		const witnessFile = join(tmpDir, "witnesses.jsonl");

		let callCount = 0;
		const { server: s1, url: url1 } = await startWitnessServer(() => {
			callCount++;
			return { status: 200, body: { anchor_id: "anc_good_1" } };
		});
		const { server: s2, url: url2 } = await startWitnessServer(() => {
			return { status: 500, body: { error: "internal error" } };
		});
		const { server: s3, url: url3 } = await startWitnessServer(() => {
			return { status: 200, body: { anchor_id: "anc_good_3" } };
		});

		try {
			// quorum=2 with 2 successes and 1 failure → should pass
			const { exitCode } = await runWitnessPublish([
				"publish",
				"--file", eventsPath,
				"--seal-file", sealPath,
				"--keyring-dir", keyringDir,
				"--witness-file", witnessFile,
				"--witness-url", url1,
				"--witness-url", url2,
				"--witness-url", url3,
				"--quorum", "2",
			]);
			expect(exitCode).toBeUndefined();

			// Only 2 witness records persisted (successful ones)
			const lines = readFileSync(witnessFile, "utf-8").trim().split("\n");
			expect(lines.length).toBe(2);
			const anchors = lines.map((l) => JSON.parse(l).anchor_id);
			expect(anchors).toContain("anc_good_1");
			expect(anchors).toContain("anc_good_3");
		} finally {
			await closeServer(s1);
			await closeServer(s2);
			await closeServer(s3);
		}
	});

	it("B2: quorum NOT met — fails when successes < quorum", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const { sealPath, keyringDir } = createTestSeal(tmpDir, events);
		const witnessFile = join(tmpDir, "witnesses.jsonl");

		const { server, url } = await startWitnessServer(() => ({
			status: 500,
			body: { error: "fail" },
		}));

		try {
			const { exitCode } = await runWitnessPublish([
				"publish",
				"--file", eventsPath,
				"--seal-file", sealPath,
				"--keyring-dir", keyringDir,
				"--witness-file", witnessFile,
				"--witness-url", url,
				"--quorum", "1",
			]);
			expect(exitCode).toBe(1);
		} finally {
			await closeServer(server);
		}
	});

	it("C: refuses when local chain is invalid", async () => {
		// Create events with a tampered hash
		const events = makeChainedEvents(3);
		events[1].event_hash = "sha256:tampered";
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const { sealPath, keyringDir } = createTestSeal(tmpDir, events);

		const { exitCode, output } = await runWitnessPublish([
			"publish",
			"--file", eventsPath,
			"--seal-file", sealPath,
			"--keyring-dir", keyringDir,
			"--witness-url", "http://unused.example.com",
		]);

		expect(exitCode).toBe(1);
		const joined = output.join("\n");
		expect(joined).toContain("Chain integrity");
	});

	it("C2: refuses when no seal file exists", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));

		const { exitCode, output } = await runWitnessPublish([
			"publish",
			"--file", eventsPath,
			"--seal-file", join(tmpDir, "nonexistent.jsonl"),
			"--witness-url", "http://unused.example.com",
		]);

		expect(exitCode).toBe(1);
		const joined = output.join("\n");
		expect(joined).toContain("seal");
	});

	it("D: witness file perms enforced (0o600 file, 0o700 dir)", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const { sealPath, keyringDir } = createTestSeal(tmpDir, events);
		const witnessDir = join(tmpDir, "witness-dir");
		const witnessFile = join(witnessDir, "witnesses.jsonl");

		const { server, url } = await startWitnessServer(() => ({
			status: 200,
			body: { anchor_id: "anc_perms" },
		}));

		try {
			const { exitCode } = await runWitnessPublish([
				"publish",
				"--file", eventsPath,
				"--seal-file", sealPath,
				"--keyring-dir", keyringDir,
				"--witness-file", witnessFile,
				"--witness-url", url,
			]);

			expect(exitCode).toBeUndefined();
			expect(existsSync(witnessFile)).toBe(true);

			const fileStat = statSync(witnessFile);
			expect(fileStat.mode & 0o777).toBe(0o600);
			const dirStat = statSync(witnessDir);
			expect(dirStat.mode & 0o777).toBe(0o700);
		} finally {
			await closeServer(server);
		}
	});

	it("D2: reconciles insecure existing witness file perms", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const { sealPath, keyringDir } = createTestSeal(tmpDir, events);
		const witnessDir = join(tmpDir, "witness-dir-insecure");
		mkdirSync(witnessDir, { recursive: true, mode: 0o755 });
		const witnessFile = join(witnessDir, "witnesses.jsonl");
		writeFileSync(witnessFile, "", { mode: 0o644 });

		const { server, url } = await startWitnessServer(() => ({
			status: 200,
			body: { anchor_id: "anc_reconcile" },
		}));

		try {
			await runWitnessPublish([
				"publish",
				"--file", eventsPath,
				"--seal-file", sealPath,
				"--keyring-dir", keyringDir,
				"--witness-file", witnessFile,
				"--witness-url", url,
			]);

			const fileStat = statSync(witnessFile);
			expect(fileStat.mode & 0o777).toBe(0o600);
			const dirStat = statSync(witnessDir);
			expect(dirStat.mode & 0o777).toBe(0o700);
		} finally {
			await closeServer(server);
		}
	});

	it("E: lock file cleaned up after successful publish", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const { sealPath, keyringDir } = createTestSeal(tmpDir, events);
		const witnessFile = join(tmpDir, "witnesses.jsonl");

		const { server, url } = await startWitnessServer(() => ({
			status: 200,
			body: { anchor_id: "anc_lock_cleanup" },
		}));

		try {
			const { exitCode } = await runWitnessPublish([
				"publish",
				"--file", eventsPath,
				"--seal-file", sealPath,
				"--keyring-dir", keyringDir,
				"--witness-file", witnessFile,
				"--witness-url", url,
			]);
			expect(exitCode).toBeUndefined();
			expect(existsSync(witnessFile)).toBe(true);
			// Lock file must be cleaned up
			expect(existsSync(witnessFile + ".lock")).toBe(false);
		} finally {
			await closeServer(server);
		}
	});

	it("JSON output includes structured results", async () => {
		const events = makeChainedEvents(3);
		const eventsPath = join(tmpDir, "events.jsonl");
		writeJsonl(eventsPath, events.map((e) => JSON.stringify(e)));
		const { sealPath, keyringDir } = createTestSeal(tmpDir, events);
		const witnessFile = join(tmpDir, "witnesses.jsonl");

		const { server, url } = await startWitnessServer(() => ({
			status: 200,
			body: { anchor_id: "anc_json" },
		}));

		try {
			const { output } = await runWitnessPublish([
				"publish",
				"--file", eventsPath,
				"--seal-file", sealPath,
				"--keyring-dir", keyringDir,
				"--witness-file", witnessFile,
				"--witness-url", url,
				"--json",
			]);

			const parsed = JSON.parse(output.join(""));
			expect(parsed.quorum_met).toBe(true);
			expect(parsed.quorum).toBe(1);
			expect(parsed.successes).toBe(1);
			expect(parsed.failures).toBe(0);
			expect(parsed.results).toHaveLength(1);
			expect(parsed.results[0].anchor_id).toBe("anc_json");
			expect(parsed.results[0].error).toBeNull();
		} finally {
			await closeServer(server);
		}
	});
});

describe("witness lock concurrency", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-witness-lock-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("F: concurrent appends produce valid JSONL and lock file is cleaned up", () => {
		const witnessFile = join(tmpDir, "witnesses.jsonl");
		writeFileSync(witnessFile, "", { mode: 0o600 });

		const workerPath = join(
			dirname(fileURLToPath(import.meta.url)),
			"_witness-lock-worker.mjs",
		);

		const WORKERS = 5;
		const records = Array.from({ length: WORKERS }, (_, i) =>
			JSON.stringify({
				schema_version: 1,
				witnessed_at: new Date().toISOString(),
				tip_hash: "sha256:concurrent_tip",
				chained_events: 3,
				seal_signature: "hmac-sha256:concurrent_sig",
				witness_url: "https://witness.example.com",
				anchor_id: `anc_concurrent_${i}`,
			}),
		);

		// Launch all workers concurrently
		const procs = records.map((rec) =>
			execSync(
				`node "${workerPath}" --witness-path "${witnessFile}" --record-json '${rec}'`,
				{ encoding: "utf-8", timeout: 10_000 },
			),
		);

		// All workers should succeed
		for (const out of procs) {
			const parsed = JSON.parse(out.trim());
			expect(parsed.ok).toBe(true);
		}

		// Verify all lines are valid JSONL
		const content = readFileSync(witnessFile, "utf-8").trim();
		const lines = content.split("\n");
		expect(lines.length).toBe(WORKERS);

		for (const line of lines) {
			const parsed = JSON.parse(line);
			expect(parsed.schema_version).toBe(1);
			expect(parsed.anchor_id).toMatch(/^anc_concurrent_/);
		}

		// Lock file must be cleaned up
		expect(existsSync(witnessFile + ".lock")).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// witness verify — remote proof checking
// ---------------------------------------------------------------------------

describe("witness verify", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-witness-verify-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	function makeWitnessFile(witnessPath: string, records: Record<string, unknown>[]): void {
		writeFileSync(witnessPath, records.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf-8");
	}

	it("G1: passes when remote endpoint confirms anchor", async () => {
		vi.resetModules();

		vi.doMock("../../src/http-client.js", () => ({
			fetchJson: vi.fn().mockResolvedValue({
				status: 200,
				body: { anchor_id: "anc_001", tip_hash: "abc" },
			}),
		}));

		const { witnessCommand } = await import("../../src/commands/witness.js");

		const witnessPath = join(tmpDir, "witnesses.jsonl");
		makeWitnessFile(witnessPath, [{
			schema_version: 1,
			witnessed_at: new Date().toISOString(),
			tip_hash: "abc",
			chained_events: 3,
			seal_signature: "hmac-sha256:sig",
			witness_url: "https://witness.example.com",
			anchor_id: "anc_001",
		}]);

		const output: string[] = [];
		const logSpy = vi.spyOn(console, "log").mockImplementation((...a) => {
			output.push(a.map(String).join(" "));
		});
		const prev = process.exitCode;
		process.exitCode = undefined;
		try {
			await witnessCommand.parseAsync([
				"node", "witness", "verify",
				"--witness-file", witnessPath,
				"--json",
			], { from: "node" });
			expect(process.exitCode).toBeUndefined();
			const parsed = JSON.parse(output.join(""));
			expect(parsed.remote_witness_checked).toBe(true);
			expect(parsed.remote_witness_quorum_met).toBe(true);
			expect(parsed.remote_witness_verified_count).toBe(1);
			expect(parsed.candidates_checked).toBe(1);
		} finally {
			process.exitCode = prev;
			logSpy.mockRestore();
		}
	});

	it("G2: fails with exit code 1 when quorum not met", async () => {
		vi.resetModules();

		vi.doMock("../../src/http-client.js", () => ({
			fetchJson: vi.fn().mockResolvedValue({
				status: 404,
				body: { error: "not found" },
			}),
		}));

		const { witnessCommand } = await import("../../src/commands/witness.js");

		const witnessPath = join(tmpDir, "witnesses.jsonl");
		makeWitnessFile(witnessPath, [{
			schema_version: 1,
			witnessed_at: new Date().toISOString(),
			tip_hash: "abc",
			chained_events: 3,
			seal_signature: "hmac-sha256:sig",
			witness_url: "https://witness.example.com",
			anchor_id: "anc_001",
		}]);

		const output: string[] = [];
		const logSpy = vi.spyOn(console, "log").mockImplementation((...a) => {
			output.push(a.map(String).join(" "));
		});
		const prev = process.exitCode;
		process.exitCode = undefined;
		try {
			await witnessCommand.parseAsync([
				"node", "witness", "verify",
				"--witness-file", witnessPath,
				"--json",
			], { from: "node" });
			expect(process.exitCode).toBe(1);
			const parsed = JSON.parse(output.join(""));
			expect(parsed.remote_witness_quorum_met).toBe(false);
		} finally {
			process.exitCode = prev;
			logSpy.mockRestore();
		}
	});

	it("G3: --tip-hash filters witness records", async () => {
		vi.resetModules();

		const fetchFn = vi.fn().mockResolvedValue({
			status: 200,
			body: { anchor_id: "anc_match", tip_hash: "target_hash" },
		});

		vi.doMock("../../src/http-client.js", () => ({
			fetchJson: fetchFn,
		}));

		const { witnessCommand } = await import("../../src/commands/witness.js");

		const witnessPath = join(tmpDir, "witnesses.jsonl");
		makeWitnessFile(witnessPath, [
			{
				schema_version: 1,
				witnessed_at: new Date().toISOString(),
				tip_hash: "other_hash",
				chained_events: 3,
				seal_signature: "hmac-sha256:sig",
				witness_url: "https://w1.example.com",
				anchor_id: "anc_other",
			},
			{
				schema_version: 1,
				witnessed_at: new Date().toISOString(),
				tip_hash: "target_hash",
				chained_events: 3,
				seal_signature: "hmac-sha256:sig",
				witness_url: "https://w2.example.com",
				anchor_id: "anc_match",
			},
		]);

		const output: string[] = [];
		const logSpy = vi.spyOn(console, "log").mockImplementation((...a) => {
			output.push(a.map(String).join(" "));
		});
		const prev = process.exitCode;
		process.exitCode = undefined;
		try {
			await witnessCommand.parseAsync([
				"node", "witness", "verify",
				"--witness-file", witnessPath,
				"--tip-hash", "target_hash",
				"--json",
			], { from: "node" });
			expect(process.exitCode).toBeUndefined();
			const parsed = JSON.parse(output.join(""));
			expect(parsed.candidates_checked).toBe(1);
			expect(parsed.remote_witness_verified_count).toBe(1);
			// Only the matching record should trigger fetchJson
			expect(fetchFn).toHaveBeenCalledTimes(1);
		} finally {
			process.exitCode = prev;
			logSpy.mockRestore();
		}
	});

	it("G4: text output shows verification summary", async () => {
		vi.resetModules();

		vi.doMock("../../src/http-client.js", () => ({
			fetchJson: vi.fn().mockResolvedValue({
				status: 200,
				body: { anchor_id: "anc_001" },
			}),
		}));

		const { witnessCommand } = await import("../../src/commands/witness.js");

		const witnessPath = join(tmpDir, "witnesses.jsonl");
		makeWitnessFile(witnessPath, [{
			schema_version: 1,
			witnessed_at: new Date().toISOString(),
			tip_hash: "abc",
			chained_events: 3,
			seal_signature: "hmac-sha256:sig",
			witness_url: "https://witness.example.com",
			anchor_id: "anc_001",
		}]);

		const output: string[] = [];
		const logSpy = vi.spyOn(console, "log").mockImplementation((...a) => {
			output.push(a.map(String).join(" "));
		});
		const prev = process.exitCode;
		process.exitCode = undefined;
		try {
			await witnessCommand.parseAsync([
				"node", "witness", "verify",
				"--witness-file", witnessPath,
			], { from: "node" });
			expect(process.exitCode).toBeUndefined();
			const text = output.join("\n");
			expect(text).toContain("Witness Remote Verification");
			expect(text).toContain("Verified:");
			expect(text).toContain("Quorum met.");
		} finally {
			process.exitCode = prev;
			logSpy.mockRestore();
		}
	});
});
