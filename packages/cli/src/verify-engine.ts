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
	type SealRecord,
} from "@patchwork/core";
import { WitnessRecordSchema, type WitnessRecord } from "@patchwork/core";
import { EVENTS_PATH, SEAL_KEY_PATH, KEYRING_DIR, SEALS_PATH, WITNESSES_PATH } from "./store.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Structured seal check result. */
export interface SealCheckResult {
	seal_checked: boolean;
	seal_present: boolean;
	seal_valid: boolean;
	seal_tip_match: boolean;
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
}

/** Full verification result returned by runVerification(). */
export interface VerifyResult {
	pass: boolean;
	error: string | null;
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
export function runVerification(opts: VerifyOptions): VerifyResult {
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

	return {
		pass: isPass,
		error: null,
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
		input_paths: paths,
	};
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
