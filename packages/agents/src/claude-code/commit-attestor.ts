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
	verifyChain,
	ensureKeyring,
	readSealKey,
	buildAttestationPayload,
	hashAttestationPayload,
	signAttestation,
	loadActivePolicy,
	getHomeDir,
} from "@patchwork/core";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";

function commitAttestationsDir() { return join(getHomeDir(), ".patchwork", "commit-attestations"); }
function commitIndexPath() { return join(commitAttestationsDir(), "index.jsonl"); }
function keyringDir() { return join(getHomeDir(), ".patchwork", "keys", "seal"); }
function legacyKeyPath() { return join(getHomeDir(), ".patchwork", "keys", "seal.key"); }

export interface CommitAttestationParams {
	commitSha: string;
	branch: string;
	sessionId: string;
	projectRoot: string;
	store: Store;
	toolVersion: string;
}

/**
 * Generate a signed commit attestation from the current session state.
 */
export function generateCommitAttestation(params: CommitAttestationParams): CommitAttestation {
	const { commitSha, branch, sessionId, projectRoot, store, toolVersion } = params;

	// Query session events
	let sessionEvents: AuditEvent[] = [];
	try {
		sessionEvents = store.query({ session_id: sessionId });
	} catch {
		// Store read failed — generate degraded attestation
	}

	// Find events since last commit attestation in this session
	const lastCommitIdx = findLastCommitEventIndex(sessionEvents);
	const eventsSinceLastCommit = lastCommitIdx === -1
		? sessionEvents.length
		: sessionEvents.length - lastCommitIdx - 1;

	// Verify chain integrity
	const rawEvents = sessionEvents.map((e) => e as unknown as Record<string, unknown>);
	const chain = verifyChain(rawEvents);

	// Compute chain tip hash
	const chainTipHash = rawEvents.length > 0
		? (rawEvents[rawEvents.length - 1].event_hash as string) || null
		: null;

	// Compute risk summary
	const riskSummary = computeRiskSummary(sessionEvents);

	// Load active policy
	const { source: policySource } = loadActivePolicy(projectRoot);

	// Determine pass/fail
	const failureReasons: string[] = [];
	if (!chain.is_valid) failureReasons.push("chain_integrity_failure");
	if (riskSummary.denials > 0) failureReasons.push("policy_denials_present");
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
		chain_chained_events: chain.chained_events,
		risk_summary: riskSummary,
		policy_source: policySource,
		pass: failureReasons.length === 0,
		failure_reasons: failureReasons,
	};

	// Sign
	let key: Buffer | null = null;
	let keyId: string | undefined;
	try {
		const kr = ensureKeyring(keyringDir());
		key = kr.key;
		keyId = kr.keyId;
	} catch {
		try {
			key = readSealKey(legacyKeyPath());
		} catch {
			// No key — unsigned attestation
		}
	}

	const payloadStr = buildAttestationPayload(artifact);
	artifact.payload_hash = hashAttestationPayload(payloadStr);

	if (key) {
		artifact.signature = signAttestation(payloadStr, key);
		if (keyId !== undefined) artifact.key_id = keyId;
	} else {
		artifact.signature = "unsigned";
	}

	return artifact as unknown as CommitAttestation;
}

/**
 * Write a commit attestation to disk.
 */
export function writeCommitAttestation(attestation: CommitAttestation): string {
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
	const risk = attestation.risk_summary;
	const noteBody = [
		`Patchwork-Approved: ${attestation.payload_hash}`,
		`Status: ${attestation.pass ? "PASS" : "FAIL"}`,
		`Session: ${attestation.session_id}`,
		`Chain: ${attestation.chain_valid ? "valid" : "INVALID"} (${attestation.chain_chained_events} events, tip: ${attestation.chain_tip_hash || "none"})`,
		`Risk: ${risk.critical} critical, ${risk.high} high, ${risk.medium} medium`,
		`Policy: ${attestation.policy_source}`,
		...(attestation.failure_reasons.length > 0
			? [`Failures: ${attestation.failure_reasons.join(", ")}`]
			: []),
	].join("\n");

	execSync(
		`git notes --ref=patchwork add -f -m ${shellQuote(noteBody)} ${attestation.commit_sha}`,
		{ cwd, timeout: 5000, stdio: "ignore" },
	);
}

/**
 * Read an existing commit attestation from disk.
 */
export function readCommitAttestation(commitSha: string): CommitAttestation | null {
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
		if (level && level in summary) {
			summary[level as keyof Omit<RiskSummary, "denials">]++;
		}
		if (e.status === "denied") summary.denials++;
	}
	return summary;
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

function shellQuote(s: string): string {
	return "'" + s.replace(/'/g, "'\\''") + "'";
}
