/**
 * Shared verification engine used by both `patchwork verify` and `patchwork attest`.
 * Extracts chain, seal, and witness verification into reusable functions.
 */
import { chmodSync, existsSync, readFileSync, statSync } from "node:fs";
import {
	verifyChain,
	computeSealPayload,
	verifySeal,
	readSealKey,
	loadKeyById,
	buildAttestationPayload,
	hashAttestationPayload,
	verifyAttestation,
	type SealRecord,
} from "@patchwork/core";
import { WitnessRecordSchema, type WitnessRecord } from "@patchwork/core";
import { EVENTS_PATH, SEAL_KEY_PATH, KEYRING_DIR, SEALS_PATH, WITNESSES_PATH, ATTESTATION_PATH } from "./store.js";
import { checkRemoteWitnesses, emptyRemoteWitnessResult, type RemoteWitnessCheckResult } from "./remote-witness.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Structured seal check result. */
export interface SealCheckResult {
	seal_checked: boolean;
	seal_present: boolean;
	seal_valid: boolean;
	seal_tip_match: boolean;
	seal_tip_hash: string | null;
	seal_age_seconds: number | null;
	seal_corrupt_lines: number;
	seal_failure_reason: string | null;
}

/** Structured witness check result. */
export interface WitnessCheckResult {
	witness_checked: boolean;
	witness_present: boolean;
	witness_matching_tip_count: number;
	witness_valid_count: number;
	witness_latest_age_seconds: number | null;
	witness_corrupt_lines: number;
	witness_failure_reason: string | null;
}

/** Structured attestation check result. */
export interface AttestationCheckResult {
	attestation_checked: boolean;
	attestation_present: boolean;
	attestation_valid: boolean;
	attestation_signed: boolean;
	attestation_signature_valid: boolean;
	attestation_hash_valid: boolean;
	attestation_age_seconds: number | null;
	attestation_failure_reason: string | null;
	attestation_matches_current_state: boolean;
	attestation_match_failure_reason: string | null;
}

/** Options accepted by the verification engine. */
export interface VerifyOptions {
	file?: string;
	sealFile?: string;
	keyFile?: string;
	keyringDir?: string;
	witnessFile?: string;
	sealCheck?: boolean;
	requireSeal?: boolean;
	maxSealAgeSeconds?: string;
	strictSealFile?: boolean;
	witnessCheck?: boolean;
	requireWitness?: boolean;
	maxWitnessAgeSeconds?: string;
	strictWitnessFile?: boolean;
	strict?: boolean;
	allowInvalid?: boolean;
	attestationFile?: string;
	attestationCheck?: boolean;
	requireAttestation?: boolean;
	requireSignedAttestation?: boolean;
	maxAttestationAgeSeconds?: string;
	strictAttestationFile?: boolean;
	requireAttestationBinding?: boolean;
	requireRemoteWitnessProof?: boolean;
	remoteWitnessQuorum?: string;
	remoteWitnessTimeoutMs?: string;
	noRemoteWitnessCheck?: boolean;
	tokenEnv?: string;
}

/** Full verification result returned by runVerification(). */
export interface VerifyResult {
	pass: boolean;
	error: string | null;
	chain_tip_hash: string | null;
	chain: {
		total_events: number;
		chained_events: number;
		legacy_events: number;
		invalid_schema_events: number;
		hash_mismatch_count: number;
		prev_link_mismatch_count: number;
		first_failure_index: number | null;
	};
	seal: SealCheckResult;
	witness: WitnessCheckResult;
	remote_witness: RemoteWitnessCheckResult;
	attestation: AttestationCheckResult;
	input_paths: {
		events: string;
		seals: string;
		witnesses: string;
	};
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse and strictly validate a positive-integer age parameter.
 * Returns the validated positive integer, null if not provided, or "invalid".
 */
export function parsePositiveIntAge(raw: unknown): number | null | "invalid" {
	if (raw === undefined) return null;
	const str = String(raw);
	if (!/^\d+$/.test(str)) return "invalid";
	const n = Number(str);
	if (n <= 0 || !Number.isSafeInteger(n)) return "invalid";
	return n;
}

/**
 * Run the full verification pipeline: chain + seal + witness.
 * Returns a structured result that both `verify` and `attest` can consume.
 */
export async function runVerification(opts: VerifyOptions): Promise<VerifyResult> {
	const eventsPath = opts.file || EVENTS_PATH;
	const sealsPath = opts.sealFile || SEALS_PATH;
	const witnessPath = opts.witnessFile || WITNESSES_PATH;

	const basePaths = { events: eventsPath, seals: sealsPath, witnesses: witnessPath };

	// Validate age params
	const maxSealAge = parsePositiveIntAge(opts.maxSealAgeSeconds);
	if (maxSealAge === "invalid") {
		return emptyResult(false, `Invalid --max-seal-age-seconds: "${opts.maxSealAgeSeconds}". Must be a positive integer (> 0).`, basePaths);
	}

	const maxWitnessAge = parsePositiveIntAge(opts.maxWitnessAgeSeconds);
	if (maxWitnessAge === "invalid") {
		return emptyResult(false, `Invalid --max-witness-age-seconds: "${opts.maxWitnessAgeSeconds}". Must be a positive integer (> 0).`, basePaths);
	}

	const maxAttestationAge = parsePositiveIntAge(opts.maxAttestationAgeSeconds);
	if (maxAttestationAge === "invalid") {
		return emptyResult(false, `Invalid --max-attestation-age-seconds: "${opts.maxAttestationAgeSeconds}". Must be a positive integer (> 0).`, basePaths);
	}

	// Events file must exist
	if (!existsSync(eventsPath)) {
		return emptyResult(false, "No audit log found", basePaths);
	}

	// Parse events
	const content = readFileSync(eventsPath, "utf-8");
	const lines = content.split("\n").filter((l) => l.trim().length > 0);
	const events: Record<string, unknown>[] = [];
	let parseErrors = 0;

	for (const line of lines) {
		try {
			events.push(JSON.parse(line));
		} catch {
			parseErrors++;
		}
	}

	// Chain verification
	const chainResult = verifyChain(events);
	chainResult.invalid_schema_events += parseErrors;

	const hasIntegrityFailures =
		chainResult.hash_mismatch_count > 0 || chainResult.prev_link_mismatch_count > 0;
	const hasInvalidFailures =
		!opts.allowInvalid && chainResult.invalid_schema_events > 0;
	const hasStrictLegacyFailures = opts.strict === true && chainResult.legacy_events > 0;
	let isPass =
		!hasIntegrityFailures && !hasInvalidFailures && !hasStrictLegacyFailures;

	// Seal check
	const sealCheck = runSealCheck(opts, events, maxSealAge);
	if (sealCheck.seal_checked && sealCheck.seal_failure_reason !== null) {
		isPass = false;
	}

	// Witness check — find chain tip
	let currentTip: string | null = null;
	for (let i = events.length - 1; i >= 0; i--) {
		const h = events[i].event_hash;
		if (typeof h === "string") {
			currentTip = h;
			break;
		}
	}
	const witnessCheck = runWitnessCheck(opts, currentTip, maxWitnessAge);
	if (witnessCheck.witness_checked && witnessCheck.witness_failure_reason !== null) {
		isPass = false;
	}

	// Remote witness proof check
	let remoteWitnessCheck: RemoteWitnessCheckResult = emptyRemoteWitnessResult();
	if (opts.noRemoteWitnessCheck !== true && opts.requireRemoteWitnessProof) {
		const witnessPathVal = opts.witnessFile || WITNESSES_PATH;
		remoteWitnessCheck = await runRemoteWitnessCheck(opts, witnessPathVal, currentTip);
		if (remoteWitnessCheck.remote_witness_checked && remoteWitnessCheck.remote_witness_failure_reason !== null) {
			isPass = false;
		}
	}

	// Attestation check — pass current state for binding comparison
	const currentState: CurrentVerifyState = {
		chain_tip_hash: currentTip,
		chain_chained_events: chainResult.chained_events,
		seal_tip_hash: sealCheck.seal_tip_hash,
		seal_checked: sealCheck.seal_checked,
		witness_latest_matching_tip_hash: witnessCheck.witness_matching_tip_count > 0 ? currentTip : null,
		witness_checked: witnessCheck.witness_checked,
	};
	const attestationCheck = runAttestationCheck(opts, maxAttestationAge, currentState);
	if (attestationCheck.attestation_checked && attestationCheck.attestation_failure_reason !== null) {
		isPass = false;
	}

	return {
		pass: isPass,
		error: null,
		chain_tip_hash: currentTip,
		chain: {
			total_events: chainResult.total_events,
			chained_events: chainResult.chained_events,
			legacy_events: chainResult.legacy_events,
			invalid_schema_events: chainResult.invalid_schema_events,
			hash_mismatch_count: chainResult.hash_mismatch_count,
			prev_link_mismatch_count: chainResult.prev_link_mismatch_count,
			first_failure_index: chainResult.first_failure_index,
		},
		seal: sealCheck,
		witness: witnessCheck,
		remote_witness: remoteWitnessCheck,
		attestation: attestationCheck,
		input_paths: basePaths,
	};
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function emptyResult(
	pass: boolean,
	error: string,
	paths: { events: string; seals: string; witnesses: string },
): VerifyResult {
	return {
		pass,
		error,
		chain_tip_hash: null,
		chain: {
			total_events: 0,
			chained_events: 0,
			legacy_events: 0,
			invalid_schema_events: 0,
			hash_mismatch_count: 0,
			prev_link_mismatch_count: 0,
			first_failure_index: null,
		},
		seal: {
			seal_checked: false,
			seal_present: false,
			seal_valid: false,
			seal_tip_match: false,
			seal_tip_hash: null,
			seal_age_seconds: null,
			seal_corrupt_lines: 0,
			seal_failure_reason: null,
		},
		witness: {
			witness_checked: false,
			witness_present: false,
			witness_matching_tip_count: 0,
			witness_valid_count: 0,
			witness_latest_age_seconds: null,
			witness_corrupt_lines: 0,
			witness_failure_reason: null,
		},
		remote_witness: emptyRemoteWitnessResult(),
		attestation: {
			attestation_checked: false,
			attestation_present: false,
			attestation_valid: false,
			attestation_signed: false,
			attestation_signature_valid: false,
			attestation_hash_valid: false,
			attestation_age_seconds: null,
			attestation_failure_reason: null,
			attestation_matches_current_state: false,
			attestation_match_failure_reason: null,
		},
		input_paths: paths,
	};
}

/** Current verification state passed to attestation check for binding comparison. */
interface CurrentVerifyState {
	chain_tip_hash: string | null;
	chain_chained_events: number;
	seal_tip_hash: string | null;
	seal_checked: boolean;
	witness_latest_matching_tip_hash: string | null;
	witness_checked: boolean;
}

interface SealScanResult {
	seal: SealRecord | null;
	corrupt_lines: number;
}

function findLatestValidSeal(sealLines: string[]): SealScanResult {
	let corruptLines = 0;

	for (let i = sealLines.length - 1; i >= 0; i--) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(sealLines[i]);
		} catch {
			corruptLines++;
			continue;
		}

		const record = parsed as Record<string, unknown>;
		if (
			record.sealed_at &&
			record.tip_hash &&
			typeof record.chained_events === "number" &&
			record.signature
		) {
			return { seal: record as unknown as SealRecord, corrupt_lines: corruptLines };
		}

		corruptLines++;
	}

	return { seal: null, corrupt_lines: corruptLines };
}

function runSealCheck(
	opts: VerifyOptions,
	events: Record<string, unknown>[],
	maxAge: number | null,
): SealCheckResult {
	if (opts.sealCheck === false) {
		return {
			seal_checked: false,
			seal_present: false,
			seal_valid: false,
			seal_tip_match: false,
			seal_tip_hash: null,
			seal_age_seconds: null,
			seal_corrupt_lines: 0,
			seal_failure_reason: null,
		};
	}

	const sealPath = opts.sealFile || SEALS_PATH;
	const keyPath = opts.keyFile || SEAL_KEY_PATH;
	const keyringDir = opts.keyringDir || KEYRING_DIR;
	const requireSeal = opts.requireSeal === true;
	const strictSealFile = opts.strictSealFile === true;

	if (!existsSync(sealPath)) {
		const needsFail = requireSeal || maxAge !== null;
		return {
			seal_checked: true,
			seal_present: false,
			seal_valid: false,
			seal_tip_match: false,
			seal_tip_hash: null,
			seal_age_seconds: null,
			seal_corrupt_lines: 0,
			seal_failure_reason: needsFail
				? "No seal file found (required by policy)"
				: null,
		};
	}

	reconcileMode(sealPath, 0o600);

	const sealContent = readFileSync(sealPath, "utf-8");
	const sealLines = sealContent.split("\n").filter((l) => l.trim().length > 0);
	if (sealLines.length === 0) {
		return {
			seal_checked: true,
			seal_present: true,
			seal_valid: false,
			seal_tip_match: false,
			seal_tip_hash: null,
			seal_age_seconds: null,
			seal_corrupt_lines: 0,
			seal_failure_reason: "Seal file is empty",
		};
	}

	const scanResult = findLatestValidSeal(sealLines);

	if (strictSealFile && scanResult.corrupt_lines > 0) {
		return {
			seal_checked: true,
			seal_present: true,
			seal_valid: false,
			seal_tip_match: false,
			seal_tip_hash: null,
			seal_age_seconds: null,
			seal_corrupt_lines: scanResult.corrupt_lines,
			seal_failure_reason: `${scanResult.corrupt_lines} corrupt seal line(s) detected (--strict-seal-file)`,
		};
	}

	if (!scanResult.seal) {
		return {
			seal_checked: true,
			seal_present: true,
			seal_valid: false,
			seal_tip_match: false,
			seal_tip_hash: null,
			seal_age_seconds: null,
			seal_corrupt_lines: scanResult.corrupt_lines,
			seal_failure_reason: "No valid seal record found in seal file",
		};
	}

	const latestSeal = scanResult.seal;

	let key: Buffer | null = null;
	if (latestSeal.key_id) {
		try {
			key = loadKeyById(keyringDir, latestSeal.key_id);
		} catch {
			// try legacy fallback
		}
	}

	if (!key) {
		if (!existsSync(keyPath)) {
			const reason = latestSeal.key_id
				? `Key ${latestSeal.key_id} not found in keyring and no legacy key at ${keyPath}`
				: `Seal file exists but key not found at ${keyPath}`;
			return {
				seal_checked: true,
				seal_present: true,
				seal_valid: false,
				seal_tip_match: false,
				seal_tip_hash: null,
				seal_age_seconds: null,
				seal_corrupt_lines: scanResult.corrupt_lines,
				seal_failure_reason: reason,
			};
		}
		try {
			key = readSealKey(keyPath);
		} catch {
			return {
				seal_checked: true,
				seal_present: true,
				seal_valid: false,
				seal_tip_match: false,
				seal_tip_hash: null,
				seal_age_seconds: null,
				seal_corrupt_lines: scanResult.corrupt_lines,
				seal_failure_reason: `Cannot read seal key at ${keyPath}`,
			};
		}
	}

	const payload = computeSealPayload(
		latestSeal.tip_hash,
		latestSeal.chained_events,
		latestSeal.sealed_at,
	);
	const sigValid = verifySeal(payload, latestSeal.signature, key);

	if (!sigValid) {
		return {
			seal_checked: true,
			seal_present: true,
			seal_valid: false,
			seal_tip_match: false,
			seal_tip_hash: null,
			seal_age_seconds: null,
			seal_corrupt_lines: scanResult.corrupt_lines,
			seal_failure_reason: "Seal signature is invalid (key mismatch or tampered seal)",
		};
	}

	let currentTip: string | null = null;
	for (let i = events.length - 1; i >= 0; i--) {
		const h = events[i].event_hash;
		if (typeof h === "string") {
			currentTip = h;
			break;
		}
	}
	const tipMatch = currentTip === latestSeal.tip_hash;

	const sealTime = new Date(latestSeal.sealed_at).getTime();
	const ageSeconds = Math.round((Date.now() - sealTime) / 1000);

	if (!tipMatch) {
		return {
			seal_checked: true,
			seal_present: true,
			seal_valid: true,
			seal_tip_match: false,
			seal_tip_hash: latestSeal.tip_hash,
			seal_age_seconds: ageSeconds,
			seal_corrupt_lines: scanResult.corrupt_lines,
			seal_failure_reason: `Chain tip mismatch: sealed=${latestSeal.tip_hash.slice(0, 20)}... current=${currentTip?.slice(0, 20) ?? "null"}...`,
		};
	}

	if (maxAge !== null && ageSeconds > maxAge) {
		return {
			seal_checked: true,
			seal_present: true,
			seal_valid: true,
			seal_tip_match: true,
			seal_tip_hash: latestSeal.tip_hash,
			seal_age_seconds: ageSeconds,
			seal_corrupt_lines: scanResult.corrupt_lines,
			seal_failure_reason: `Seal too old: ${ageSeconds}s exceeds max ${maxAge}s`,
		};
	}

	return {
		seal_checked: true,
		seal_present: true,
		seal_valid: true,
		seal_tip_match: true,
		seal_tip_hash: latestSeal.tip_hash,
		seal_age_seconds: ageSeconds,
		seal_corrupt_lines: scanResult.corrupt_lines,
		seal_failure_reason: null,
	};
}

function runWitnessCheck(
	opts: VerifyOptions,
	currentTip: string | null,
	maxAge: number | null,
): WitnessCheckResult {
	if (opts.witnessCheck === false) {
		return {
			witness_checked: false,
			witness_present: false,
			witness_matching_tip_count: 0,
			witness_valid_count: 0,
			witness_latest_age_seconds: null,
			witness_corrupt_lines: 0,
			witness_failure_reason: null,
		};
	}

	const witnessPathVal = opts.witnessFile || WITNESSES_PATH;
	const requireWitness = opts.requireWitness === true;
	const strictWitnessFile = opts.strictWitnessFile === true;

	if (!existsSync(witnessPathVal)) {
		const needsFail = requireWitness || maxAge !== null;
		return {
			witness_checked: true,
			witness_present: false,
			witness_matching_tip_count: 0,
			witness_valid_count: 0,
			witness_latest_age_seconds: null,
			witness_corrupt_lines: 0,
			witness_failure_reason: needsFail
				? "No witness file found (required by policy)"
				: null,
		};
	}

	reconcileMode(witnessPathVal, 0o600);

	const witnessContent = readFileSync(witnessPathVal, "utf-8");
	const witnessLines = witnessContent.split("\n").filter((l) => l.trim().length > 0);
	if (witnessLines.length === 0) {
		const needsFail = requireWitness || maxAge !== null;
		return {
			witness_checked: true,
			witness_present: true,
			witness_matching_tip_count: 0,
			witness_valid_count: 0,
			witness_latest_age_seconds: null,
			witness_corrupt_lines: 0,
			witness_failure_reason: needsFail
				? "Witness file is empty (required by policy)"
				: null,
		};
	}

	let corruptLines = 0;
	const validRecords: WitnessRecord[] = [];

	for (const line of witnessLines) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch {
			corruptLines++;
			continue;
		}

		const result = WitnessRecordSchema.safeParse(parsed);
		if (result.success) {
			validRecords.push(result.data);
		} else {
			corruptLines++;
		}
	}

	if (strictWitnessFile && corruptLines > 0) {
		return {
			witness_checked: true,
			witness_present: true,
			witness_matching_tip_count: 0,
			witness_valid_count: validRecords.length,
			witness_latest_age_seconds: null,
			witness_corrupt_lines: corruptLines,
			witness_failure_reason: `${corruptLines} corrupt witness line(s) detected (--strict-witness-file)`,
		};
	}

	const matchingRecords = currentTip
		? validRecords.filter((r) => r.tip_hash === currentTip)
		: [];

	let latestAgeSeconds: number | null = null;
	if (matchingRecords.length > 0) {
		let latestTime = 0;
		for (const r of matchingRecords) {
			const t = new Date(r.witnessed_at).getTime();
			if (t > latestTime) latestTime = t;
		}
		latestAgeSeconds = Math.round((Date.now() - latestTime) / 1000);
	}

	if (requireWitness && matchingRecords.length === 0) {
		return {
			witness_checked: true,
			witness_present: true,
			witness_matching_tip_count: 0,
			witness_valid_count: validRecords.length,
			witness_latest_age_seconds: latestAgeSeconds,
			witness_corrupt_lines: corruptLines,
			witness_failure_reason: "No witness record matches current chain tip (required by --require-witness)",
		};
	}

	if (maxAge !== null && matchingRecords.length > 0 && latestAgeSeconds !== null && latestAgeSeconds > maxAge) {
		return {
			witness_checked: true,
			witness_present: true,
			witness_matching_tip_count: matchingRecords.length,
			witness_valid_count: validRecords.length,
			witness_latest_age_seconds: latestAgeSeconds,
			witness_corrupt_lines: corruptLines,
			witness_failure_reason: `Witness too old: ${latestAgeSeconds}s exceeds max ${maxAge}s`,
		};
	}

	if (maxAge !== null && matchingRecords.length === 0) {
		return {
			witness_checked: true,
			witness_present: true,
			witness_matching_tip_count: 0,
			witness_valid_count: validRecords.length,
			witness_latest_age_seconds: latestAgeSeconds,
			witness_corrupt_lines: corruptLines,
			witness_failure_reason: "No witness record matches current chain tip (required by --max-witness-age-seconds)",
		};
	}

	return {
		witness_checked: true,
		witness_present: true,
		witness_matching_tip_count: matchingRecords.length,
		witness_valid_count: validRecords.length,
		witness_latest_age_seconds: latestAgeSeconds,
		witness_corrupt_lines: corruptLines,
		witness_failure_reason: null,
	};
}

// ---------------------------------------------------------------------------
// Remote witness proof check
// ---------------------------------------------------------------------------

async function runRemoteWitnessCheck(
	opts: VerifyOptions,
	witnessPathVal: string,
	currentTip: string | null,
): Promise<RemoteWitnessCheckResult> {
	const quorum = opts.remoteWitnessQuorum !== undefined ? Number(opts.remoteWitnessQuorum) : 1;
	const timeoutMs = opts.remoteWitnessTimeoutMs !== undefined ? Number(opts.remoteWitnessTimeoutMs) : 5000;

	// Read and filter witness records
	if (!existsSync(witnessPathVal)) {
		return {
			remote_witness_checked: true,
			remote_witness_proof_results: [],
			remote_witness_verified_count: 0,
			remote_witness_quorum_met: false,
			remote_witness_failure_reason: "No witness file found for remote verification",
		};
	}

	const content = readFileSync(witnessPathVal, "utf-8");
	const lines = content.split("\n").filter((l) => l.trim().length > 0);
	const validRecords: WitnessRecord[] = [];

	for (const line of lines) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch {
			continue;
		}
		const result = WitnessRecordSchema.safeParse(parsed);
		if (result.success) {
			validRecords.push(result.data);
		}
	}

	// Filter to records matching current tip with witness_url and anchor_id
	const candidates = validRecords.filter(
		(r) => r.witness_url && r.anchor_id && (!currentTip || r.tip_hash === currentTip),
	);

	let bearerToken: string | undefined;
	if (opts.tokenEnv) {
		bearerToken = process.env[opts.tokenEnv];
	}

	return checkRemoteWitnesses({
		witnessRecords: candidates.map((r) => ({
			witness_url: r.witness_url!,
			anchor_id: r.anchor_id!,
		})),
		quorum,
		timeoutMs,
		bearerToken,
	});
}

// ---------------------------------------------------------------------------
// Attestation check
// ---------------------------------------------------------------------------

const REQUIRED_ATTESTATION_FIELDS = [
	"schema_version", "generated_at", "tool_version", "pass",
	"payload_hash", "signature",
];

function emptyAttestationResult(): AttestationCheckResult {
	return {
		attestation_checked: false,
		attestation_present: false,
		attestation_valid: false,
		attestation_signed: false,
		attestation_signature_valid: false,
		attestation_hash_valid: false,
		attestation_age_seconds: null,
		attestation_failure_reason: null,
		attestation_matches_current_state: false,
		attestation_match_failure_reason: null,
	};
}

function runAttestationCheck(
	opts: VerifyOptions,
	maxAge: number | null,
	currentState: CurrentVerifyState,
): AttestationCheckResult {
	if (opts.attestationCheck === false) {
		return emptyAttestationResult();
	}

	const attestationPath = opts.attestationFile || ATTESTATION_PATH;
	const requireAttestation = opts.requireAttestation === true;
	const requireSigned = opts.requireSignedAttestation === true;
	const strictFile = opts.strictAttestationFile === true;
	const requireBinding = opts.requireAttestationBinding === true;

	// If no attestation-related flags are set, skip the check entirely
	if (!requireAttestation && !requireSigned && maxAge === null && !strictFile && !requireBinding && !opts.attestationFile) {
		return emptyAttestationResult();
	}

	if (!existsSync(attestationPath)) {
		const needsFail = requireAttestation || requireSigned || maxAge !== null;
		return {
			attestation_checked: true,
			attestation_present: false,
			attestation_valid: false,
			attestation_signed: false,
			attestation_signature_valid: false,
			attestation_hash_valid: false,
			attestation_age_seconds: null,
			attestation_failure_reason: needsFail
				? "No attestation file found (required by policy)"
				: null,
			attestation_matches_current_state: false,
			attestation_match_failure_reason: null,
		};
	}

	reconcileMode(attestationPath, 0o600);

	// Parse the attestation artifact
	let artifact: Record<string, unknown>;
	try {
		artifact = JSON.parse(readFileSync(attestationPath, "utf-8"));
	} catch {
		return {
			attestation_checked: true,
			attestation_present: true,
			attestation_valid: false,
			attestation_signed: false,
			attestation_signature_valid: false,
			attestation_hash_valid: false,
			attestation_age_seconds: null,
			attestation_failure_reason: "Attestation file is not valid JSON",
			attestation_matches_current_state: false,
			attestation_match_failure_reason: null,
		};
	}

	// Validate required fields
	for (const field of REQUIRED_ATTESTATION_FIELDS) {
		if (!(field in artifact)) {
			return {
				attestation_checked: true,
				attestation_present: true,
				attestation_valid: false,
				attestation_signed: false,
				attestation_signature_valid: false,
				attestation_hash_valid: false,
				attestation_age_seconds: null,
				attestation_failure_reason: `Attestation missing required field: ${field}`,
			attestation_matches_current_state: false,
			attestation_match_failure_reason: null,
			};
		}
	}

	// Recompute canonical payload and verify hash
	const recomputedPayload = buildAttestationPayload(artifact);
	const recomputedHash = hashAttestationPayload(recomputedPayload);
	const hashValid = artifact.payload_hash === recomputedHash;

	// Hash mismatch is always a failure — this is tamper detection.
	// No flag needed; if the attestation check runs at all, integrity is enforced.
	if (!hashValid) {
		return {
			attestation_checked: true,
			attestation_present: true,
			attestation_valid: false,
			attestation_signed: false,
			attestation_signature_valid: false,
			attestation_hash_valid: false,
			attestation_age_seconds: null,
			attestation_failure_reason: "Attestation payload_hash mismatch (artifact may be tampered)",
			attestation_matches_current_state: false,
			attestation_match_failure_reason: null,
		};
	}

	// Check signature
	const sig = String(artifact.signature);
	const isSigned = sig !== "unsigned" && sig.startsWith("hmac-sha256:");
	let sigValid = false;

	if (isSigned) {
		const keyringDir = opts.keyringDir || KEYRING_DIR;
		const keyPath = opts.keyFile || SEAL_KEY_PATH;
		let key: Buffer | null = null;

		// Try key_id from artifact -> keyring first
		if (artifact.key_id && typeof artifact.key_id === "string") {
			try {
				key = loadKeyById(keyringDir, artifact.key_id);
			} catch {
				// try legacy fallback
			}
		}

		// Legacy key fallback
		if (!key) {
			try {
				key = readSealKey(keyPath);
			} catch {
				// no key available
			}
		}

		if (key) {
			sigValid = verifyAttestation(recomputedPayload, sig, key);
		}
	}

	// Freshness check
	const generatedAt = String(artifact.generated_at);
	const genTime = new Date(generatedAt).getTime();
	const ageSeconds = Number.isFinite(genTime)
		? Math.round((Date.now() - genTime) / 1000)
		: null;

	// Signed but invalid signature is always a failure (consistent with seal
	// verification). If a signature is present it must verify; there is no
	// "soft" mode for bad signatures.
	if (isSigned && !sigValid) {
		return {
			attestation_checked: true,
			attestation_present: true,
			attestation_valid: false,
			attestation_signed: true,
			attestation_signature_valid: false,
			attestation_hash_valid: true,
			attestation_age_seconds: ageSeconds,
			attestation_failure_reason: "Attestation signature is invalid (key mismatch or tampered)",
			attestation_matches_current_state: false,
			attestation_match_failure_reason: null,
		};
	}

	// --require-signed-attestation: must be signed (and valid — already checked above)
	if (requireSigned && !isSigned) {
		return {
			attestation_checked: true,
			attestation_present: true,
			attestation_valid: true,
			attestation_signed: false,
			attestation_signature_valid: false,
			attestation_hash_valid: true,
			attestation_age_seconds: ageSeconds,
			attestation_failure_reason: "Attestation is unsigned (required by --require-signed-attestation)",
			attestation_matches_current_state: false,
			attestation_match_failure_reason: null,
		};
	}

	// --strict-attestation-file: the attestation's own pass field must be true.
	// This enforces that the attestation was generated from a passing verification,
	// not just that the artifact itself is structurally intact.
	if (strictFile && artifact.pass !== true) {
		return {
			attestation_checked: true,
			attestation_present: true,
			attestation_valid: true,
			attestation_signed: isSigned,
			attestation_signature_valid: isSigned ? sigValid : false,
			attestation_hash_valid: true,
			attestation_age_seconds: ageSeconds,
			attestation_failure_reason: "Attestation artifact reports pass=false (--strict-attestation-file requires pass=true)",
			attestation_matches_current_state: false,
			attestation_match_failure_reason: null,
		};
	}

	// Freshness
	if (maxAge !== null && ageSeconds !== null && ageSeconds > maxAge) {
		return {
			attestation_checked: true,
			attestation_present: true,
			attestation_valid: true,
			attestation_signed: isSigned,
			attestation_signature_valid: isSigned ? sigValid : false,
			attestation_hash_valid: true,
			attestation_age_seconds: ageSeconds,
			attestation_failure_reason: `Attestation too old: ${ageSeconds}s exceeds max ${maxAge}s`,
			attestation_matches_current_state: false,
			attestation_match_failure_reason: null,
		};
	}

	if (maxAge !== null && ageSeconds === null) {
		return {
			attestation_checked: true,
			attestation_present: true,
			attestation_valid: false,
			attestation_signed: isSigned,
			attestation_signature_valid: isSigned ? sigValid : false,
			attestation_hash_valid: true,
			attestation_age_seconds: null,
			attestation_failure_reason: "Attestation has invalid generated_at timestamp (cannot check age)",
			attestation_matches_current_state: false,
			attestation_match_failure_reason: null,
		};
	}

	// Current-state binding check.
	// If the attestation includes binding fields (chain_tip_hash, etc.), compare
	// them against the current verification state. This prevents replay/stale
	// attestations from being accepted for a different audit state.
	// Attestations without binding fields (legacy) pass vacuously — unless
	// --require-attestation-binding or --strict-attestation-file is set.
	const hasBindingFields = "chain_tip_hash" in artifact;

	// --require-attestation-binding / --strict-attestation-file: binding fields must exist
	if ((requireBinding || strictFile) && !hasBindingFields) {
		const reason = requireBinding
			? "Attestation missing binding fields (required by --require-attestation-binding)"
			: "Attestation missing binding fields (required by --strict-attestation-file)";
		return {
			attestation_checked: true,
			attestation_present: true,
			attestation_valid: true,
			attestation_signed: isSigned,
			attestation_signature_valid: isSigned ? sigValid : false,
			attestation_hash_valid: true,
			attestation_age_seconds: ageSeconds,
			attestation_failure_reason: reason,
			attestation_matches_current_state: false,
			attestation_match_failure_reason: "No binding fields present",
		};
	}

	let matchesState = true;
	let matchFailureReason: string | null = null;

	if (hasBindingFields) {
		const mismatches: string[] = [];
		// Chain fields are always compared (chain verification always runs)
		if (artifact.chain_tip_hash !== currentState.chain_tip_hash) {
			const expected = currentState.chain_tip_hash?.slice(0, 20) ?? "null";
			const got = artifact.chain_tip_hash === null ? "null" : String(artifact.chain_tip_hash).slice(0, 20);
			mismatches.push(`chain_tip_hash: expected=${expected}... got=${got}...`);
		}
		if (artifact.chain_chained_events !== currentState.chain_chained_events) {
			mismatches.push(`chain_chained_events: expected=${currentState.chain_chained_events} got=${artifact.chain_chained_events}`);
		}
		// Seal/witness fields only compared when those checks actually ran
		if (currentState.seal_checked && artifact.seal_tip_hash !== currentState.seal_tip_hash) {
			const expected = currentState.seal_tip_hash?.slice(0, 20) ?? "null";
			const got = artifact.seal_tip_hash === null ? "null" : String(artifact.seal_tip_hash).slice(0, 20);
			mismatches.push(`seal_tip_hash: expected=${expected}... got=${got}...`);
		}
		if (currentState.witness_checked && artifact.witness_latest_matching_tip_hash !== currentState.witness_latest_matching_tip_hash) {
			const expected = currentState.witness_latest_matching_tip_hash?.slice(0, 20) ?? "null";
			const got = artifact.witness_latest_matching_tip_hash === null ? "null" : String(artifact.witness_latest_matching_tip_hash).slice(0, 20);
			mismatches.push(`witness_latest_matching_tip_hash: expected=${expected}... got=${got}...`);
		}

		if (mismatches.length > 0) {
			matchesState = false;
			matchFailureReason = `Attestation does not match current state: ${mismatches.join("; ")}`;
		}
	}

	if (!matchesState) {
		return {
			attestation_checked: true,
			attestation_present: true,
			attestation_valid: true,
			attestation_signed: isSigned,
			attestation_signature_valid: isSigned ? sigValid : false,
			attestation_hash_valid: true,
			attestation_age_seconds: ageSeconds,
			attestation_failure_reason: matchFailureReason,
			attestation_matches_current_state: false,
			attestation_match_failure_reason: matchFailureReason,
		};
	}

	return {
		attestation_checked: true,
		attestation_present: true,
		attestation_valid: true,
		attestation_signed: isSigned,
		attestation_signature_valid: isSigned ? sigValid : false,
		attestation_hash_valid: true,
		attestation_age_seconds: ageSeconds,
		attestation_failure_reason: null,
		attestation_matches_current_state: true,
		attestation_match_failure_reason: null,
	};
}

/** Chmod path to target mode if current mode doesn't match. Safe if path doesn't exist. */
export function reconcileMode(path: string, targetMode: number): void {
	try {
		const stat = statSync(path);
		if ((stat.mode & 0o777) !== targetMode) {
			chmodSync(path, targetMode);
		}
	} catch {
		// Path disappeared between check and chmod — safe to ignore
	}
}
