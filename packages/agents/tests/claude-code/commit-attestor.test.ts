import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	generateCommitAttestation,
	writeCommitAttestation,
	readCommitAttestation,
	writeAttestationFailure,
	buildIntotoEnvelope,
	writeIntotoEnvelope,
	readIntotoEnvelope,
} from "../../src/claude-code/commit-attestor.js";
import {
	JsonlStore,
	generateEventId,
	generateSessionId,
	CURRENT_SCHEMA_VERSION,
	verifyAttestation,
	buildAttestationPayload,
	ensureKeyring,
	verifyDsseEnvelope,
	decodeStatement,
	digestStatement,
	IN_TOTO_STATEMENT_TYPE,
	PATCHWORK_PREDICATE_TYPE,
	DSSE_PAYLOAD_TYPE,
} from "@patchwork/core";
import { createHmac, timingSafeEqual } from "node:crypto";
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

	it("fails when a high-risk denial occurs since the last commit", async () => {
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
		expect(attestation.risk_summary.denials_high_risk_since_last_commit).toBe(1);
		expect(attestation.risk_summary.high).toBe(1);
		expect(attestation.pass).toBe(false);
		expect(attestation.failure_reasons).toContain("high_risk_denials_since_last_commit");
	});

	it("passes when only low/medium-risk denials occurred (policy working as intended)", async () => {
		appendTestEvent({ status: "denied", risk: { level: "medium", flags: ["dev_policy"] } });
		appendTestEvent({ status: "denied", risk: { level: "low", flags: ["routine"] } });
		appendTestEvent();

		const attestation = await generateCommitAttestation({
			commitSha: "pass1234",
			branch: "main",
			sessionId,
			projectRoot: "/tmp/project",
			store,
			toolVersion: "0.5.0-test",
		});

		expect(attestation.risk_summary.denials).toBe(2);
		expect(attestation.risk_summary.denials_high_risk_since_last_commit).toBe(0);
		expect(attestation.failure_reasons).not.toContain("high_risk_denials_since_last_commit");
		expect(attestation.pass).toBe(true);
	});

	it("marks chain_valid=true when session events have prev_hashes pointing outside the session (interleaved with other sessions)", async () => {
		// Simulates real-world state: two sessions are active, events interleave
		// in the global log, so session X's events have prev_hash fields pointing
		// at events from session Y. Per-event hashes self-verify; verifyChain
		// would have flagged this as a chain break. verifyEventHashes should not.
		appendTestEvent({ prev_hash: "sha256:from-other-session-a" } as Partial<AuditEvent>);
		appendTestEvent({ prev_hash: "sha256:from-other-session-b" } as Partial<AuditEvent>);

		const attestation = await generateCommitAttestation({
			commitSha: "interleaved",
			branch: "main",
			sessionId,
			projectRoot: "/tmp/project",
			store,
			toolVersion: "0.5.0-test",
		});

		expect(attestation.chain_valid).toBe(true);
		expect(attestation.failure_reasons).not.toContain("chain_integrity_failure");
		expect(attestation.pass).toBe(true);
	});

	it("catches tampering with a session event (per-event hash mismatch)", async () => {
		// Write a valid event, then tamper with it directly in the file.
		// Store.append always recomputes hashes, so we bypass it here.
		appendTestEvent();
		const eventsPath = join(tmpDir, ".patchwork", "events.jsonl");
		const line = readFileSync(eventsPath, "utf-8").trim();
		const parsed = JSON.parse(line);
		parsed.action = "command_execute"; // changed from file_edit — hash won't match
		const { writeFileSync } = await import("node:fs");
		writeFileSync(eventsPath, JSON.stringify(parsed) + "\n", "utf-8");

		// Use a fresh store to force re-reading the tampered file
		const { JsonlStore: FreshStore } = await import("@patchwork/core");
		const freshStore = new FreshStore(eventsPath);

		const attestation = await generateCommitAttestation({
			commitSha: "tampered",
			branch: "main",
			sessionId,
			projectRoot: "/tmp/project",
			store: freshStore,
			toolVersion: "0.5.0-test",
		});

		expect(attestation.chain_valid).toBe(false);
		expect(attestation.failure_reasons).toContain("chain_integrity_failure");
		expect(attestation.pass).toBe(false);
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

describe("writeAttestationFailure", () => {
	let originalHome: string | undefined;
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-attest-fail-"));
		originalHome = process.env.HOME;
		process.env.HOME = tmpDir;
	});

	afterEach(() => {
		process.env.HOME = originalHome;
		rmSync(tmpDir, { recursive: true, force: true });
	});

	function readFailures(): any[] {
		const path = join(tmpDir, ".patchwork", "commit-attestations", "_failures.jsonl");
		if (!existsSync(path)) return [];
		return readFileSync(path, "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
	}

	it("records an Error with stack", () => {
		writeAttestationFailure({
			commitSha: "abc1234",
			branch: "main",
			sessionId: "ses_x",
			stage: "generate",
			error: new Error("boom"),
		});

		const lines = readFailures();
		expect(lines).toHaveLength(1);
		expect(lines[0].commit_sha).toBe("abc1234");
		expect(lines[0].branch).toBe("main");
		expect(lines[0].session_id).toBe("ses_x");
		expect(lines[0].stage).toBe("generate");
		expect(lines[0].error_message).toBe("boom");
		expect(lines[0].error_stack).toMatch(/Error: boom/);
		expect(lines[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	it("records non-Error throws as string", () => {
		writeAttestationFailure({
			sessionId: "ses_y",
			stage: "extract",
			error: "raw string failure",
		});

		const lines = readFailures();
		expect(lines).toHaveLength(1);
		expect(lines[0].commit_sha).toBeNull();
		expect(lines[0].branch).toBeNull();
		expect(lines[0].error_message).toBe("raw string failure");
		expect(lines[0].error_stack).toBeUndefined();
	});

	it("appends rather than overwrites", () => {
		writeAttestationFailure({ sessionId: "s1", stage: "generate", error: new Error("first") });
		writeAttestationFailure({ sessionId: "s2", stage: "write", error: new Error("second") });

		const lines = readFailures();
		expect(lines).toHaveLength(2);
		expect(lines[0].error_message).toBe("first");
		expect(lines[1].error_message).toBe("second");
	});

	it("creates the directory if missing", () => {
		writeAttestationFailure({ sessionId: "s", stage: "note", error: new Error("x") });
		expect(existsSync(join(tmpDir, ".patchwork", "commit-attestations"))).toBe(true);
	});
});

describe("in-toto/DSSE envelope (v0.6.9 opt-in)", () => {
	let originalHome: string | undefined;
	let tmpDir: string;
	let store: JsonlStore;
	const sessionId = "ses_intoto_test";
	// Force local-only signing — this dev machine has a real Patchwork relay
	// running at the default socket path, which would otherwise sign with the
	// root keyring and produce a different key_id than the test's tmp keyring.
	const noRelay = "/nonexistent/patchwork-test-relay.sock";

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-intoto-"));
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

	function appendEvent(): void {
		store.append({
			schema_version: CURRENT_SCHEMA_VERSION,
			id: generateEventId(),
			session_id: sessionId,
			timestamp: new Date().toISOString(),
			agent: "claude-code",
			action: "file_edit",
			status: "completed",
			risk: { level: "low", flags: [] },
		});
	}

	it("buildIntotoEnvelope produces a valid DSSE envelope around the attestation", async () => {
		appendEvent();
		appendEvent();

		const attestation = await generateCommitAttestation({
			commitSha: "1111111111111111111111111111111111111111",
			branch: "main",
			sessionId,
			projectRoot: "/tmp/project",
			store,
			toolVersion: "0.6.9-test",
			relaySocketPath: noRelay,
		});

		const envelope = await buildIntotoEnvelope(attestation, { relaySocketPath: noRelay });
		expect(envelope.payloadType).toBe(DSSE_PAYLOAD_TYPE);
		expect(envelope.signatures).toHaveLength(1);
		expect(envelope.signatures[0].keyid).toBe(attestation.key_id);
		expect(envelope.payload.length).toBeGreaterThan(0);

		const stmt = decodeStatement(envelope) as Record<string, unknown> & {
			subject: { name: string; digest: Record<string, string> }[];
			predicate: Record<string, unknown>;
		};
		expect(stmt._type).toBe(IN_TOTO_STATEMENT_TYPE);
		expect(stmt.predicateType).toBe(PATCHWORK_PREDICATE_TYPE);
		expect(stmt.subject[0].digest.gitCommit).toBe(attestation.commit_sha);
		expect(stmt.predicate.session_id).toBe(sessionId);
		// signing fields belong to the envelope, not the predicate
		expect(stmt.predicate.signature).toBeUndefined();
		expect(stmt.predicate.payload_hash).toBeUndefined();
	});

	it("write + read round-trip preserves the envelope exactly", async () => {
		appendEvent();
		const attestation = await generateCommitAttestation({
			commitSha: "2222222222222222222222222222222222222222",
			branch: "main",
			sessionId,
			projectRoot: "/tmp/project",
			store,
			toolVersion: "0.6.9-test",
			relaySocketPath: noRelay,
		});

		const env = await buildIntotoEnvelope(attestation, { relaySocketPath: noRelay });
		const path = writeIntotoEnvelope(attestation.commit_sha, env);
		expect(existsSync(path)).toBe(true);

		const read = readIntotoEnvelope(attestation.commit_sha);
		expect(read).not.toBeNull();
		expect(read!.payloadType).toBe(env.payloadType);
		expect(read!.payload).toBe(env.payload);
		expect(read!.signatures).toEqual(env.signatures);
		expect(digestStatement(read!)).toBe(digestStatement(env));
	});

	it("envelope signature verifies against the local keyring (round-trip)", async () => {
		appendEvent();
		const attestation = await generateCommitAttestation({
			commitSha: "3333333333333333333333333333333333333333",
			branch: "main",
			sessionId,
			projectRoot: "/tmp/project",
			store,
			toolVersion: "0.6.9-test",
			relaySocketPath: noRelay,
		});

		const env = await buildIntotoEnvelope(attestation, { relaySocketPath: noRelay });

		// Reproduce the verifier the CLI uses: re-derive HMAC with the local
		// keyring's key and compare to the envelope's signature.
		const keyringPath = join(tmpDir, ".patchwork", "keys", "seal");
		const { keyId, key } = ensureKeyring(keyringPath);
		expect(keyId).toBe(attestation.key_id);

		const ok = await verifyDsseEnvelope(env, async (kid, pae, sigBase64) => {
			if (kid !== keyId) return false;
			const expected = createHmac("sha256", key).update(pae).digest();
			const got = Buffer.from(sigBase64, "base64");
			if (got.length !== expected.length) return false;
			return timingSafeEqual(expected, got);
		});
		expect(ok).toBe(true);
	});

	it("envelope rejects payload tampering", async () => {
		appendEvent();
		const attestation = await generateCommitAttestation({
			commitSha: "4444444444444444444444444444444444444444",
			branch: "main",
			sessionId,
			projectRoot: "/tmp/project",
			store,
			toolVersion: "0.6.9-test",
			relaySocketPath: noRelay,
		});

		const env = await buildIntotoEnvelope(attestation, { relaySocketPath: noRelay });
		const decoded = JSON.parse(Buffer.from(env.payload, "base64").toString("utf8"));
		decoded.predicate.pass = false;
		const tampered = {
			...env,
			payload: Buffer.from(JSON.stringify(decoded), "utf8").toString("base64"),
		};

		const keyringPath = join(tmpDir, ".patchwork", "keys", "seal");
		const { key } = ensureKeyring(keyringPath);

		const ok = await verifyDsseEnvelope(tampered, async (_kid, pae, sigBase64) => {
			const expected = createHmac("sha256", key).update(pae).digest();
			const got = Buffer.from(sigBase64, "base64");
			if (got.length !== expected.length) return false;
			return timingSafeEqual(expected, got);
		});
		expect(ok).toBe(false);
	});

	it("readIntotoEnvelope returns null when none exists", () => {
		expect(readIntotoEnvelope("0000000000000000000000000000000000000000")).toBeNull();
	});
});
