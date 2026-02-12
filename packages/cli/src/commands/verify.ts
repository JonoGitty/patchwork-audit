import { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import chalk from "chalk";
import {
	verifyChain,
	computeSealPayload,
	verifySeal,
	readSealKey,
	type SealRecord,
} from "@patchwork/core";
import { EVENTS_PATH, SEAL_KEY_PATH, SEALS_PATH } from "../store.js";

/** Structured seal check result for JSON output and policy decisions. */
interface SealCheckResult {
	seal_checked: boolean;
	seal_present: boolean;
	seal_valid: boolean;
	seal_tip_match: boolean;
	seal_age_seconds: number | null;
	seal_failure_reason: string | null;
}

export const verifyCommand = new Command("verify")
	.description("Verify tamper-evident hash chain integrity of the audit log")
	.option("--json", "Output result as JSON")
	.option("--strict", "Exit with code 1 if any legacy (unchained) events exist")
	.option("--allow-invalid", "Do not fail verification due to invalid/corrupt event lines")
	.option("--file <path>", "Path to JSONL file (default: ~/.patchwork/events.jsonl)")
	.option("--seal-file <path>", "Path to seals JSONL file")
	.option("--key-file <path>", "Path to seal key file")
	.option("--no-seal-check", "Skip seal verification even if seal file exists")
	.option("--require-seal", "Fail if no valid seal exists")
	.option("--max-seal-age-seconds <n>", "Fail if latest seal is older than n seconds", parseInt)
	.action((opts) => {
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
		const sealCheck = runSealCheck(opts, events);

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
					console.log(chalk.green(`  Seal verified: signature valid, tip matches${ageStr}`));
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
 * Run the full seal check, applying --require-seal and --max-seal-age-seconds
 * policies on top of the raw verification result.
 */
function runSealCheck(
	opts: Record<string, unknown>,
	events: Record<string, unknown>[],
): SealCheckResult {
	// --no-seal-check skips everything
	if (opts.sealCheck === false) {
		return {
			seal_checked: false,
			seal_present: false,
			seal_valid: false,
			seal_tip_match: false,
			seal_age_seconds: null,
			seal_failure_reason: null,
		};
	}

	const sealPath = (opts.sealFile as string) || SEALS_PATH;
	const keyPath = (opts.keyFile as string) || SEAL_KEY_PATH;
	const requireSeal = opts.requireSeal === true;
	const maxAge = typeof opts.maxSealAgeSeconds === "number"
		? opts.maxSealAgeSeconds
		: null;

	// Seal file missing
	if (!existsSync(sealPath)) {
		const needsFail = requireSeal || maxAge !== null;
		return {
			seal_checked: true,
			seal_present: false,
			seal_valid: false,
			seal_tip_match: false,
			seal_age_seconds: null,
			seal_failure_reason: needsFail
				? "No seal file found (required by policy)"
				: null,
		};
	}

	// Read latest seal record
	const sealContent = readFileSync(sealPath, "utf-8");
	const sealLines = sealContent.split("\n").filter((l) => l.trim().length > 0);
	if (sealLines.length === 0) {
		return {
			seal_checked: true,
			seal_present: true,
			seal_valid: false,
			seal_tip_match: false,
			seal_age_seconds: null,
			seal_failure_reason: "Seal file is empty",
		};
	}

	let latestSeal: SealRecord;
	try {
		latestSeal = JSON.parse(sealLines[sealLines.length - 1]);
	} catch {
		return {
			seal_checked: true,
			seal_present: true,
			seal_valid: false,
			seal_tip_match: false,
			seal_age_seconds: null,
			seal_failure_reason: "Latest seal record is corrupt",
		};
	}

	if (
		!latestSeal.sealed_at ||
		!latestSeal.tip_hash ||
		typeof latestSeal.chained_events !== "number" ||
		!latestSeal.signature
	) {
		return {
			seal_checked: true,
			seal_present: true,
			seal_valid: false,
			seal_tip_match: false,
			seal_age_seconds: null,
			seal_failure_reason: "Latest seal record has missing fields",
		};
	}

	// Key check
	if (!existsSync(keyPath)) {
		return {
			seal_checked: true,
			seal_present: true,
			seal_valid: false,
			seal_tip_match: false,
			seal_age_seconds: null,
			seal_failure_reason: `Seal file exists but key not found at ${keyPath}`,
		};
	}

	let key: Buffer;
	try {
		key = readSealKey(keyPath);
	} catch {
		return {
			seal_checked: true,
			seal_present: true,
			seal_valid: false,
			seal_tip_match: false,
			seal_age_seconds: null,
			seal_failure_reason: `Cannot read seal key at ${keyPath}`,
		};
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
			seal_failure_reason: `Seal too old: ${ageSeconds}s exceeds max ${maxAge}s`,
		};
	}

	return {
		seal_checked: true,
		seal_present: true,
		seal_valid: true,
		seal_tip_match: true,
		seal_age_seconds: ageSeconds,
		seal_failure_reason: null,
	};
}
