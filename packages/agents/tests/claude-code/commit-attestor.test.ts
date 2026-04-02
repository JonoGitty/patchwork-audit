import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	generateCommitAttestation,
	writeCommitAttestation,
	readCommitAttestation,
} from "../../src/claude-code/commit-attestor.js";
import {
	JsonlStore,
	generateEventId,
	generateSessionId,
	CURRENT_SCHEMA_VERSION,
	verifyAttestation,
	buildAttestationPayload,
	ensureKeyring,
} from "@patchwork/core";
import type { AuditEvent } from "@patchwork/core";

describe("generateCommitAttestation", () => {
	let originalHome: string | undefined;
	let tmpDir: string;
	let store: JsonlStore;
	const sessionId = "ses_commit_test";

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-commit-attest-"));
		originalHome = process.env.HOME;
		process.env.HOME = tmpDir;

		const eventsPath = join(tmpDir, ".patchwork", "events.jsonl");
		mkdirSync(join(tmpDir, ".patchwork"), { recursive: true });
		store = new JsonlStore(eventsPath);
	});

	afterEach(() => {
		process.env.HOME = originalHome;
		rmSync(tmpDir, { recursive: true, force: true });
	});

	function appendTestEvent(overrides: Partial<AuditEvent> = {}): void {
		const event: AuditEvent = {
			schema_version: CURRENT_SCHEMA_VERSION,
			id: generateEventId(),
			session_id: sessionId,
			timestamp: new Date().toISOString(),
			agent: "claude-code",
			action: "file_edit",
			status: "completed",
			risk: { level: "low", flags: [] },
			...overrides,
		};
		store.append(event);
	}

	it("generates a valid attestation", async () => {
		appendTestEvent();
		appendTestEvent({ action: "command_execute", risk: { level: "medium", flags: [] } });

		const attestation = await generateCommitAttestation({
			commitSha: "abc1234",
			branch: "main",
			sessionId,
			projectRoot: "/tmp/project",
			store,
			toolVersion: "0.5.0-test",
		});

		expect(attestation.schema_version).toBe(1);
		expect(attestation.type).toBe("commit-attestation");
		expect(attestation.commit_sha).toBe("abc1234");
		expect(attestation.branch).toBe("main");
		expect(attestation.session_id).toBe(sessionId);
		expect(attestation.session_events_count).toBe(2);
		expect(attestation.pass).toBe(true);
		expect(attestation.failure_reasons).toEqual([]);
		expect(attestation.risk_summary.low).toBe(1);
		expect(attestation.risk_summary.medium).toBe(1);
		expect(attestation.payload_hash).toMatch(/^sha256:/);
		expect(attestation.signature).toMatch(/^hmac-sha256:|^unsigned$/);
	});

	it("reports pass:false when no events exist", async () => {
		const attestation = await generateCommitAttestation({
			commitSha: "def5678",
			branch: "main",
			sessionId: "ses_nonexistent",
			projectRoot: "/tmp/project",
			store,
			toolVersion: "0.5.0-test",
		});

		expect(attestation.pass).toBe(false);
		expect(attestation.failure_reasons).toContain("no_session_events");
	});

	it("counts denials in risk summary", async () => {
		appendTestEvent({ status: "denied", risk: { level: "high", flags: ["sensitive_file"] } });
		appendTestEvent();

		const attestation = await generateCommitAttestation({
			commitSha: "ghi9012",
			branch: "main",
			sessionId,
			projectRoot: "/tmp/project",
			store,
			toolVersion: "0.5.0-test",
		});

		expect(attestation.risk_summary.denials).toBe(1);
		expect(attestation.risk_summary.high).toBe(1);
		expect(attestation.pass).toBe(false);
		expect(attestation.failure_reasons).toContain("policy_denials_present");
	});

	it("signs attestation when keyring exists", async () => {
		appendTestEvent();

		// Ensure keyring exists
		const keyringDir = join(tmpDir, ".patchwork", "keys", "seal");
		const kr = ensureKeyring(keyringDir);

		const attestation = await generateCommitAttestation({
			commitSha: "jkl3456",
			branch: "main",
			sessionId,
			projectRoot: "/tmp/project",
			store,
			toolVersion: "0.5.0-test",
			// Skip relay so it uses the local test keyring
			relaySocketPath: "/tmp/nonexistent-relay.sock",
		});

		expect(attestation.signature).toMatch(/^hmac-sha256:/);

		// Verify the signature
		const artifact = attestation as unknown as Record<string, unknown>;
		const payloadStr = buildAttestationPayload(artifact);
		expect(verifyAttestation(payloadStr, attestation.signature, kr.key)).toBe(true);
	});
});

describe("writeCommitAttestation / readCommitAttestation", () => {
	let originalHome: string | undefined;
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-commit-write-"));
		originalHome = process.env.HOME;
		process.env.HOME = tmpDir;
	});

	afterEach(() => {
		process.env.HOME = originalHome;
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("writes attestation file and appends to index", () => {
		const attestation = {
			schema_version: 1 as const,
			type: "commit-attestation" as const,
			generated_at: new Date().toISOString(),
			tool_version: "0.5.0-test",
			commit_sha: "abc1234",
			branch: "main",
			project_root: "/tmp/project",
			session_id: "ses_test",
			session_events_count: 5,
			session_events_since_last_commit: 3,
			chain_tip_hash: "sha256:abc",
			chain_valid: true,
			chain_chained_events: 5,
			risk_summary: { critical: 0, high: 0, medium: 1, low: 2, none: 2, denials: 0 },
			policy_source: "default",
			pass: true,
			failure_reasons: [],
			payload_hash: "sha256:def",
			signature: "unsigned",
		};

		const path = writeCommitAttestation(attestation);
		expect(existsSync(path)).toBe(true);

		// Index file should exist
		const indexPath = join(tmpDir, ".patchwork", "commit-attestations", "index.jsonl");
		expect(existsSync(indexPath)).toBe(true);
		const indexContent = readFileSync(indexPath, "utf-8");
		const indexEntry = JSON.parse(indexContent.trim());
		expect(indexEntry.commit_sha).toBe("abc1234");
		expect(indexEntry.pass).toBe(true);
	});

	it("round-trips through read", () => {
		const attestation = {
			schema_version: 1 as const,
			type: "commit-attestation" as const,
			generated_at: new Date().toISOString(),
			tool_version: "0.5.0-test",
			commit_sha: "xyz7890",
			branch: "feature",
			project_root: "/tmp/project",
			session_id: "ses_test2",
			session_events_count: 1,
			session_events_since_last_commit: 1,
			chain_tip_hash: null,
			chain_valid: true,
			chain_chained_events: 0,
			risk_summary: { critical: 0, high: 0, medium: 0, low: 0, none: 1, denials: 0 },
			policy_source: "default",
			pass: true,
			failure_reasons: [],
			payload_hash: "sha256:ghi",
			signature: "unsigned",
		};

		writeCommitAttestation(attestation);
		const read = readCommitAttestation("xyz7890");
		expect(read).not.toBeNull();
		expect(read!.commit_sha).toBe("xyz7890");
		expect(read!.branch).toBe("feature");
	});

	it("returns null for nonexistent SHA", () => {
		expect(readCommitAttestation("nonexistent")).toBeNull();
	});
});
