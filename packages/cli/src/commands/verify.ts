import { Command } from "commander";
import { chmodSync, existsSync, readFileSync, statSync } from "node:fs";
import chalk from "chalk";
import {
	verifyChain,
	computeSealPayload,
	verifySeal,
	readSealKey,
	loadKeyById,
	type SealRecord,
} from "@patchwork/core";
import { EVENTS_PATH, SEAL_KEY_PATH, KEYRING_DIR, SEALS_PATH } from "../store.js";

/** Structured seal check result for JSON output and policy decisions. */
interface SealCheckResult {
	seal_checked: boolean;
	seal_present: boolean;
	seal_valid: boolean;
	seal_tip_match: boolean;
	seal_age_seconds: number | null;
	seal_corrupt_lines: number;
	seal_failure_reason: string | null;
}

/**
 * Parse and strictly validate --max-seal-age-seconds.
 * Returns the validated positive integer, or null if not provided.
 * Exits non-zero with clear error for invalid values.
 */
function parseMaxSealAge(raw: unknown): number | null | "invalid" {
	if (raw === undefined) return null;
	const str = String(raw);
	// Reject decimals, non-numeric, empty
	if (!/^\d+$/.test(str)) return "invalid";
	const n = Number(str);
	// Reject 0 and anything that somehow isn't a safe integer
	if (n <= 0 || !Number.isSafeInteger(n)) return "invalid";
	return n;
}

export const verifyCommand = new Command("verify")
	.description("Verify tamper-evident hash chain integrity of the audit log")
	.option("--json", "Output result as JSON")
	.option("--strict", "Exit with code 1 if any legacy (unchained) events exist")
	.option("--allow-invalid", "Do not fail verification due to invalid/corrupt event lines")
	.option("--file <path>", "Path to JSONL file (default: ~/.patchwork/events.jsonl)")
	.option("--seal-file <path>", "Path to seals JSONL file")
	.option("--key-file <path>", "Path to legacy single seal key file")
	.option("--keyring-dir <path>", "Path to seal keyring directory")
	.option("--no-seal-check", "Skip seal verification even if seal file exists")
	.option("--require-seal", "Fail if no valid seal exists")
	.option("--max-seal-age-seconds <n>", "Fail if latest seal is older than n seconds (positive integer)")
	.option("--strict-seal-file", "Fail if any corrupt lines exist in the seal file")
	.action((opts) => {
		// Validate --max-seal-age-seconds early, before any verification logic
		const maxAgeResult = parseMaxSealAge(opts.maxSealAgeSeconds);
		if (maxAgeResult === "invalid") {
			const msg = `Invalid --max-seal-age-seconds: "${opts.maxSealAgeSeconds}". Must be a positive integer (> 0).`;
			if (opts.json) {
				console.log(JSON.stringify({ error: msg }));
			} else {
				console.log(chalk.red(msg));
			}
			process.exitCode = 1;
			return;
		}

		const filePath = opts.file || EVENTS_PATH;

		if (!existsSync(filePath)) {
			if (opts.json) {
				console.log(JSON.stringify({ error: "No audit log found", path: filePath }));
			} else {
				console.log(chalk.yellow("No audit log found at:"), chalk.dim(filePath));
			}
			process.exitCode = 1;
			return;
		}

		const content = readFileSync(filePath, "utf-8");
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

		const result = verifyChain(events);
		result.invalid_schema_events += parseErrors;
		const hasIntegrityFailures =
			result.hash_mismatch_count > 0 || result.prev_link_mismatch_count > 0;
		const hasInvalidFailures =
			!opts.allowInvalid && result.invalid_schema_events > 0;
		const hasStrictLegacyFailures = opts.strict && result.legacy_events > 0;
		let isPass =
			!hasIntegrityFailures && !hasInvalidFailures && !hasStrictLegacyFailures;

		// Seal verification
		const sealCheck = runSealCheck(opts, events, maxAgeResult);

		// Apply seal policy to pass/fail
		if (sealCheck.seal_checked) {
			if (sealCheck.seal_failure_reason !== null) {
				isPass = false;
			}
		}

		if (opts.json) {
			const output = { ...result, seal: sealCheck };
			console.log(JSON.stringify(output, null, 2));
		} else {
			const status = isPass
				? chalk.green("PASS")
				: chalk.red("FAIL");

			console.log(chalk.bold("Hash Chain Verification"), status);
			console.log();
			console.log(`  Total events:       ${result.total_events}`);
			console.log(`  Chained events:     ${result.chained_events}`);
			console.log(`  Legacy events:      ${result.legacy_events}`);
			console.log(`  Invalid/corrupt:    ${result.invalid_schema_events}`);
			console.log();

			if (result.hash_mismatch_count > 0) {
				console.log(chalk.red(`  Hash mismatches:    ${result.hash_mismatch_count}`));
			}
			if (result.prev_link_mismatch_count > 0) {
				console.log(chalk.red(`  Link mismatches:    ${result.prev_link_mismatch_count}`));
			}
			if (result.first_failure_index !== null) {
				console.log(chalk.red(`  First failure at:   event index ${result.first_failure_index}`));
			}

			if (opts.allowInvalid && result.invalid_schema_events > 0) {
				console.log(
					chalk.yellow(
						`  --allow-invalid: ignoring ${result.invalid_schema_events} invalid/corrupt event(s).`,
					),
				);
			}

			if (isPass && result.chained_events > 0) {
				console.log(chalk.green(`  Chain intact across ${result.chained_events} event(s).`));
			}

			// Seal text output
			if (sealCheck.seal_checked) {
				if (sealCheck.seal_failure_reason) {
					console.log(chalk.red(`  Seal FAILED: ${sealCheck.seal_failure_reason}`));
				} else if (sealCheck.seal_present && sealCheck.seal_valid) {
					const ageStr = sealCheck.seal_age_seconds !== null
						? ` (age: ${sealCheck.seal_age_seconds}s)`
						: "";
					const corruptStr = sealCheck.seal_corrupt_lines > 0
						? ` [${sealCheck.seal_corrupt_lines} corrupt seal line(s) skipped]`
						: "";
					console.log(chalk.green(`  Seal verified: signature valid, tip matches${ageStr}${corruptStr}`));
				} else if (!sealCheck.seal_present) {
					console.log(chalk.yellow("  Seal: No seal file found. Run 'patchwork seal' to create one."));
				}
			}
		}

		if (!isPass) {
			process.exitCode = 1;
		}
	});

/**
 * Result from scanning seal lines backward to find the latest valid record.
 */
interface SealScanResult {
	seal: SealRecord | null;
	corrupt_lines: number;
}

/**
 * Scan seal lines backward to find the latest valid JSON seal record.
 * A valid record must parse as JSON and have all required fields.
 * Returns the latest valid seal and a count of corrupt/invalid trailing lines.
 */
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

		// Parseable JSON but missing required fields — still corrupt
		corruptLines++;
	}

	return { seal: null, corrupt_lines: corruptLines };
}

/**
 * Run the full seal check, applying --require-seal, --max-seal-age-seconds,
 * and --strict-seal-file policies on top of the raw verification result.
 */
function runSealCheck(
	opts: Record<string, unknown>,
	events: Record<string, unknown>[],
	maxAge: number | null,
): SealCheckResult {
	// --no-seal-check skips everything
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

	const sealPath = (opts.sealFile as string) || SEALS_PATH;
	const keyPath = (opts.keyFile as string) || SEAL_KEY_PATH;
	const keyringDir = (opts.keyringDir as string) || KEYRING_DIR;
	const requireSeal = opts.requireSeal === true;
	const strictSealFile = opts.strictSealFile === true;

	// Seal file missing
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

	// Reconcile insecure seal file permissions on use
	reconcileMode(sealPath, 0o600);

	// Read seal file and scan backward for latest valid record
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

	// --strict-seal-file: fail if any corrupt lines
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

	// Key resolution: keyring by key_id, then legacy key-file fallback
	let key: Buffer | null = null;

	if (latestSeal.key_id) {
		// Seal has a key_id — try keyring lookup
		try {
			key = loadKeyById(keyringDir, latestSeal.key_id);
		} catch {
			// Keyring lookup failed — try legacy key-file as last resort
		}
	}

	if (!key) {
		// Legacy fallback: use --key-file path
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

	// Signature verification
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

	// Tip consistency
	let currentTip: string | null = null;
	for (let i = events.length - 1; i >= 0; i--) {
		const h = events[i].event_hash;
		if (typeof h === "string") {
			currentTip = h;
			break;
		}
	}
	const tipMatch = currentTip === latestSeal.tip_hash;

	// Seal age
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

	// Freshness check
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

/** Chmod path to target mode if current mode doesn't match. Safe if path doesn't exist. */
function reconcileMode(path: string, targetMode: number): void {
	try {
		const stat = statSync(path);
		if ((stat.mode & 0o777) !== targetMode) {
			chmodSync(path, targetMode);
		}
	} catch {
		// Path disappeared between check and chmod — safe to ignore
	}
}
