/**
 * Generates signed commit attestations and writes them to disk + git notes.
 *
 * Called from the PostToolUse handler when a successful `git commit` is detected.
 */

import {
	type AuditEvent,
	type CommitAttestation,
	type RiskSummary,
	type Store,
	type DsseEnvelope,
	verifyEventHashes,
	ensureKeyring,
	readSealKey,
	buildAttestationPayload,
	hashAttestationPayload,
	signAttestation,
	loadActivePolicy,
	getHomeDir,
	requestSignature,
	buildInTotoStatement,
	buildDsseEnvelope,
} from "@patchwork/core";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";

function commitAttestationsDir() { return join(getHomeDir(), ".patchwork", "commit-attestations"); }
function commitIndexPath() { return join(commitAttestationsDir(), "index.jsonl"); }
function attestorFailuresPath() { return join(commitAttestationsDir(), "_failures.jsonl"); }
function keyringDir() { return join(getHomeDir(), ".patchwork", "keys", "seal"); }
function legacyKeyPath() { return join(getHomeDir(), ".patchwork", "keys", "seal.key"); }

/**
 * Git commit shas — 40-hex (SHA-1, current default) or 64-hex (SHA-256, future).
 * Anything else MUST NOT be passed as a path component or to `git notes`,
 * because callers can construct typed `CommitAttestation` objects without
 * round-tripping through the Zod schema validator.
 */
const COMMIT_SHA_RE = /^[0-9a-f]{40}$|^[0-9a-f]{64}$/i;

function assertCommitSha(commitSha: string): void {
	if (typeof commitSha !== "string" || !COMMIT_SHA_RE.test(commitSha)) {
		throw new Error(
			`commit_sha must match /^[0-9a-f]{40,64}$/ (got ${JSON.stringify(commitSha).slice(0, 80)})`,
		);
	}
}

export interface CommitAttestationParams {
	commitSha: string;
	branch: string;
	sessionId: string;
	projectRoot: string;
	store: Store;
	toolVersion: string;
	/** Override relay socket path (for testing). */
	relaySocketPath?: string;
}

/**
 * Generate a signed commit attestation from the current session state.
 * Tries the relay signing proxy first (layer 5), falls back to local keyring.
 */
export async function generateCommitAttestation(params: CommitAttestationParams): Promise<CommitAttestation> {
	const { commitSha, branch, sessionId, projectRoot, store, toolVersion, relaySocketPath } = params;

	// Query session events
	let sessionEvents: AuditEvent[] = [];
	try {
		sessionEvents = store.query({ sessionId });
	} catch {
		// Store read failed — generate degraded attestation
	}

	// Find events since the *previous* commit in this session.
	//
	// The PostToolUse hook records the just-completed `git commit` to the audit
	// log before invoking us, so the trailing event in `sessionEvents` is the
	// current commit. If we don't exclude it, `findLastCommitEventIndex` returns
	// the current commit's index, the slice below is empty, and any high-risk
	// denials between the previous and current commit are silently dropped from
	// `denials_high_risk_since_last_commit` — turning an attestation that should
	// fail into one that passes.
	const priorEvents = sessionEvents.length > 0 ? sessionEvents.slice(0, -1) : sessionEvents;
	const lastCommitIdx = findLastCommitEventIndex(priorEvents);
	const eventsSinceLastCommit = lastCommitIdx === -1
		? priorEvents.length
		: priorEvents.length - lastCommitIdx - 1;
	const sinceLastCommitEvents = lastCommitIdx === -1
		? priorEvents
		: priorEvents.slice(lastCommitIdx + 1);

	// Verify per-event hash integrity. Session events are a *filter* over the
	// global append-only chain; events from other sessions are interleaved
	// between them in the underlying log, so they do not chain to each other.
	// Running verifyChain on this slice would always report prev_link mismatches
	// and produce a false negative. The correct check for tamper evidence is
	// per-event hash integrity: does each event's stored hash match the
	// deterministic hash of its content?
	const rawEvents = sessionEvents.map((e) => e as unknown as Record<string, unknown>);
	const chain = verifyEventHashes(rawEvents);

	// Compute chain tip hash — last event in this session that has a hash
	const chainTipHash = rawEvents.length > 0
		? (rawEvents[rawEvents.length - 1].event_hash as string) || null
		: null;

	// Compute risk summary across the whole session (informational) plus a
	// scoped count of high-risk denials since the last commit (load-bearing
	// for pass/fail).
	const riskSummary = computeRiskSummary(sessionEvents);
	const highRiskDenialsSinceLastCommit = countHighRiskDenials(sinceLastCommitEvents);
	riskSummary.denials_high_risk_since_last_commit = highRiskDenialsSinceLastCommit;

	// Load active policy
	const { source: policySource } = loadActivePolicy(projectRoot);

	// Determine pass/fail. Expected denials (medium/low risk) are informational:
	// they show the policy is working, not that the commit is unsafe. Only
	// denials of critical/high-risk actions in the window leading up to this
	// commit are treated as attestation failures.
	const failureReasons: string[] = [];
	if (!chain.is_valid) failureReasons.push("chain_integrity_failure");
	if (highRiskDenialsSinceLastCommit > 0) failureReasons.push("high_risk_denials_since_last_commit");
	if (sessionEvents.length === 0) failureReasons.push("no_session_events");

	// Build unsigned artifact
	const artifact: Record<string, unknown> = {
		schema_version: 1,
		type: "commit-attestation",
		generated_at: new Date().toISOString(),
		tool_version: toolVersion,
		commit_sha: commitSha,
		branch,
		project_root: projectRoot,
		session_id: sessionId,
		session_events_count: sessionEvents.length,
		session_events_since_last_commit: eventsSinceLastCommit,
		chain_tip_hash: chainTipHash,
		chain_valid: chain.is_valid,
		chain_chained_events: chain.total - chain.unhashed_count,
		risk_summary: riskSummary,
		policy_source: policySource,
		pass: failureReasons.length === 0,
		failure_reasons: failureReasons,
	};

	// Sign via relay proxy (layer 5) with local fallback
	const payloadStr = buildAttestationPayload(artifact);
	artifact.payload_hash = hashAttestationPayload(payloadStr);

	try {
		const signResult = await requestSignature(payloadStr, {
			localKeyringPath: keyringDir(),
			...(relaySocketPath !== undefined ? { socketPath: relaySocketPath } : {}),
		});
		artifact.signature = signResult.signature;
		artifact.key_id = signResult.key_id;
		artifact.signature_source = signResult.source; // "relay" or "local"
	} catch {
		// All signing failed — try legacy single key as last resort
		try {
			const key = readSealKey(legacyKeyPath());
			artifact.signature = signAttestation(payloadStr, key);
			artifact.signature_source = "legacy";
		} catch {
			artifact.signature = "unsigned";
		}
	}

	return artifact as unknown as CommitAttestation;
}

/**
 * Write a commit attestation to disk.
 */
export function writeCommitAttestation(attestation: CommitAttestation): string {
	assertCommitSha(attestation.commit_sha);
	if (!existsSync(commitAttestationsDir())) {
		mkdirSync(commitAttestationsDir(), { recursive: true, mode: 0o700 });
	}

	const filePath = join(commitAttestationsDir(), `${attestation.commit_sha}.json`);
	writeFileSync(filePath, JSON.stringify(attestation, null, 2) + "\n", { mode: 0o600 });

	// Append to index
	const indexLine = JSON.stringify({
		commit_sha: attestation.commit_sha,
		branch: attestation.branch,
		session_id: attestation.session_id,
		pass: attestation.pass,
		generated_at: attestation.generated_at,
		payload_hash: attestation.payload_hash,
	}) + "\n";
	appendFileSync(commitIndexPath(), indexLine, { mode: 0o600 });

	return filePath;
}

/**
 * Add a git note with the attestation summary under refs/notes/patchwork.
 */
export function addGitNote(attestation: CommitAttestation, cwd: string): void {
	assertCommitSha(attestation.commit_sha);
	const risk = attestation.risk_summary;
	const highRiskSinceCommit = risk.denials_high_risk_since_last_commit ?? 0;
	const noteBody = [
		`Patchwork-Approved: ${attestation.payload_hash}`,
		`Status: ${attestation.pass ? "PASS" : "FAIL"}`,
		`Session: ${attestation.session_id}`,
		`Chain: ${attestation.chain_valid ? "valid" : "INVALID"} (${attestation.chain_chained_events} events, tip: ${attestation.chain_tip_hash || "none"})`,
		`Risk: ${risk.critical} critical, ${risk.high} high, ${risk.medium} medium`,
		`Denials: ${risk.denials} total, ${highRiskSinceCommit} high-risk since last commit`,
		`Policy: ${attestation.policy_source}`,
		...(attestation.failure_reasons.length > 0
			? [`Failures: ${attestation.failure_reasons.join(", ")}`]
			: []),
	].join("\n");

	// execFileSync (no shell): note body and commit sha are passed as argv
	// elements, so neither metacharacters in the body nor a maliciously-shaped
	// commit_sha (already rejected by assertCommitSha, defence in depth) can
	// trigger shell interpretation.
	execFileSync(
		"git",
		["notes", "--ref=patchwork", "add", "-f", "-m", noteBody, attestation.commit_sha],
		{ cwd, timeout: 5000, stdio: "ignore" },
	);
}

/**
 * Build a DSSE-wrapped in-toto Statement around an existing commit attestation.
 *
 * Pure additive output: the original Patchwork-format attestation is unchanged.
 * Signing reuses the same key path as the bespoke attestation (relay proxy
 * with local-keyring fallback) so verification can use the same `key_id`.
 *
 * Opt-in via `PATCHWORK_INTOTO=1`. Off by default in v0.6.9 while the format
 * stabilises.
 */
export async function buildIntotoEnvelope(
	attestation: CommitAttestation,
	options?: { relaySocketPath?: string },
): Promise<DsseEnvelope> {
	const statement = buildInTotoStatement(attestation);
	return buildDsseEnvelope(statement, async (pae) => {
		// PAE for an in-toto Statement is `DSSEv1 N application/vnd.in-toto+json M <utf8-json>`
		// — pure UTF-8, so the round-trip through requestSignature's string API is lossless.
		const paeStr = pae.toString("utf8");
		const result = await requestSignature(paeStr, {
			localKeyringPath: keyringDir(),
			...(options?.relaySocketPath !== undefined
				? { socketPath: options.relaySocketPath }
				: {}),
		});
		// requestSignature returns "hmac-sha256:<hex>" — DSSE wants raw signature
		// bytes as base64. Strip the prefix and recode.
		const hex = result.signature.replace(/^hmac-sha256:/, "");
		const sigBase64 = Buffer.from(hex, "hex").toString("base64");
		return { keyid: result.key_id, sigBase64 };
	});
}

/**
 * Write an in-toto/DSSE envelope to disk alongside the bespoke attestation.
 * Path: ~/.patchwork/commit-attestations/<sha>.intoto.json
 */
export function writeIntotoEnvelope(commitSha: string, envelope: DsseEnvelope): string {
	assertCommitSha(commitSha);
	if (!existsSync(commitAttestationsDir())) {
		mkdirSync(commitAttestationsDir(), { recursive: true, mode: 0o700 });
	}
	const filePath = join(commitAttestationsDir(), `${commitSha}.intoto.json`);
	writeFileSync(filePath, JSON.stringify(envelope, null, 2) + "\n", { mode: 0o600 });
	return filePath;
}

/**
 * Attach the DSSE envelope as a git note under refs/notes/patchwork-intoto,
 * parallel to (and not replacing) the existing refs/notes/patchwork note.
 */
export function addIntotoGitNote(commitSha: string, envelope: DsseEnvelope, cwd: string): void {
	assertCommitSha(commitSha);
	const noteBody = JSON.stringify(envelope);
	execFileSync(
		"git",
		["notes", "--ref=patchwork-intoto", "add", "-f", "-m", noteBody, commitSha],
		{ cwd, timeout: 5000, stdio: "ignore" },
	);
}

/**
 * Read an existing in-toto/DSSE envelope from disk.
 */
export function readIntotoEnvelope(commitSha: string): DsseEnvelope | null {
	assertCommitSha(commitSha);
	const filePath = join(commitAttestationsDir(), `${commitSha}.intoto.json`);
	if (!existsSync(filePath)) return null;
	try {
		return JSON.parse(readFileSync(filePath, "utf-8")) as DsseEnvelope;
	} catch {
		return null;
	}
}

/**
 * Persist a record when commit attestation fails. Without this, the empty
 * catch in the post-tool handler swallowed every error — so missed commits
 * were invisible. Failures land in commit-attestations/_failures.jsonl.
 */
export function writeAttestationFailure(params: {
	commitSha?: string;
	branch?: string;
	sessionId: string;
	stage: "extract" | "generate" | "write" | "note";
	error: unknown;
}): void {
	try {
		if (!existsSync(commitAttestationsDir())) {
			mkdirSync(commitAttestationsDir(), { recursive: true, mode: 0o700 });
		}
		const err = params.error;
		const message = err instanceof Error ? err.message : String(err);
		const stack = err instanceof Error ? err.stack : undefined;
		const line = JSON.stringify({
			timestamp: new Date().toISOString(),
			stage: params.stage,
			commit_sha: params.commitSha ?? null,
			branch: params.branch ?? null,
			session_id: params.sessionId,
			error_message: message,
			error_stack: stack,
		}) + "\n";
		appendFileSync(attestorFailuresPath(), line, { mode: 0o600 });
	} catch {
		// Failure to log a failure is non-fatal — never block the hook pipeline
	}
}

/**
 * Read an existing commit attestation from disk.
 */
export function readCommitAttestation(commitSha: string): CommitAttestation | null {
	assertCommitSha(commitSha);
	const filePath = join(commitAttestationsDir(), `${commitSha}.json`);
	if (!existsSync(filePath)) return null;
	try {
		return JSON.parse(readFileSync(filePath, "utf-8")) as CommitAttestation;
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function computeRiskSummary(events: AuditEvent[]): RiskSummary {
	const summary: RiskSummary = { critical: 0, high: 0, medium: 0, low: 0, none: 0, denials: 0 };
	for (const e of events) {
		const level = e.risk?.level;
		if (level === "critical" || level === "high" || level === "medium" || level === "low" || level === "none") {
			summary[level]++;
		}
		if (e.status === "denied") summary.denials++;
	}
	return summary;
}

/** Count denials of critical/high-risk actions — the load-bearing signal for attestation pass/fail. */
function countHighRiskDenials(events: AuditEvent[]): number {
	let count = 0;
	for (const e of events) {
		if (e.status !== "denied") continue;
		const level = e.risk?.level;
		if (level === "critical" || level === "high") count++;
	}
	return count;
}

function findLastCommitEventIndex(events: AuditEvent[]): number {
	for (let i = events.length - 1; i >= 0; i--) {
		const e = events[i];
		if (
			e.action === "command_execute" &&
			e.provenance?.tool_name === "Bash" &&
			e.target?.command &&
			/\bgit\s+commit\b/.test(e.target.command)
		) {
			return i;
		}
	}
	return -1;
}
