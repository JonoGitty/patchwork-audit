import { Command } from "commander";
import chalk from "chalk";
import { runVerification, type VerifyResult } from "../verify-engine.js";
import { loadConfig, resolveVerifyDefaults, type ResolvedPolicy } from "../config.js";

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
	.option("--witness-file <path>", "Path to witness records JSONL file")
	.option("--no-witness-check", "Skip witness verification")
	.option("--require-witness", "Fail if no valid matching witness record exists")
	.option("--max-witness-age-seconds <n>", "Fail if latest matching witness is older than n seconds")
	.option("--strict-witness-file", "Fail if any corrupt lines exist in the witness file")
	.option("--attestation-file <path>", "Path to attestation artifact JSON file")
	.option("--no-attestation-check", "Skip attestation verification")
	.option("--require-attestation", "Fail if attestation is missing, tampered, or has invalid signature")
	.option("--require-signed-attestation", "Fail if attestation is unsigned or signature is invalid")
	.option("--max-attestation-age-seconds <n>", "Fail if attestation is older than n seconds")
	.option("--strict-attestation-file", "Additionally require attestation pass=true (not just structural validity)")
	.option("--require-attestation-binding", "Fail if attestation lacks binding fields (prevents legacy vacuous pass)")
	.option("--require-remote-witness-proof", "Fail if remote witness proof quorum is not met")
	.option("--remote-witness-quorum <n>", "Minimum remote witness proofs required (default: 1)")
	.option("--remote-witness-timeout-ms <n>", "HTTP timeout per remote witness endpoint in ms (default: 5000)")
	.option("--no-remote-witness-check", "Skip remote witness proof checks")
	.option("--token-env <name>", "Environment variable name for bearer token (remote witness)")
	.option("--profile <name>", "Enforcement profile: strict, baseline (default: baseline)")
	.option("--show-effective-policy", "Show resolved policy configuration and exit")
	.action(async (opts) => {
		// Resolve config + profile + CLI flags
		const { config, source: configSource, validation } = loadConfig(process.cwd());
		const resolved = resolveVerifyDefaults({
			profile: opts.profile,
			cliFlags: opts,
			config,
			configSource,
			configValidation: validation,
		});

		// --show-effective-policy: diagnostic output and exit (before validation enforcement)
		if (opts.showEffectivePolicy) {
			formatEffectivePolicy(resolved, opts.json);
			return;
		}

		// Config validation enforcement
		if (validation.status === "invalid") {
			if (resolved.profileName === "strict") {
				const errMsg = formatConfigValidationError(validation.errors);
				if (opts.json) {
					console.log(JSON.stringify({
						error: errMsg,
						config_validation: validation,
					}));
				} else {
					console.log(chalk.red(errMsg));
				}
				process.exitCode = 1;
				return;
			}
			// Baseline: warn to stderr and continue
			const warnMsg = validation.errors
				.map((e) => `${e.path ? e.path + ": " : ""}${e.message}`)
				.join("; ");
			console.error(chalk.yellow(`Config warning: ${warnMsg}`));
		}

		const d = resolved.defaults;

		const result = await runVerification({
			file: opts.file,
			sealFile: opts.sealFile,
			keyFile: opts.keyFile,
			keyringDir: opts.keyringDir,
			witnessFile: opts.witnessFile,
			sealCheck: opts.sealCheck,
			requireSeal: d.requireSeal || undefined,
			maxSealAgeSeconds: d.maxSealAgeSeconds,
			strictSealFile: opts.strictSealFile,
			witnessCheck: opts.witnessCheck,
			requireWitness: d.requireWitness || undefined,
			maxWitnessAgeSeconds: d.maxWitnessAgeSeconds,
			strictWitnessFile: opts.strictWitnessFile,
			strict: opts.strict,
			allowInvalid: opts.allowInvalid,
			attestationFile: opts.attestationFile,
			attestationCheck: opts.attestationCheck,
			requireAttestation: opts.requireAttestation,
			requireSignedAttestation: d.requireSignedAttestation || undefined,
			maxAttestationAgeSeconds: d.maxAttestationAgeSeconds,
			strictAttestationFile: d.strictAttestationFile || undefined,
			requireAttestationBinding: d.requireAttestationBinding || undefined,
			requireRemoteWitnessProof: d.requireRemoteWitnessProof || undefined,
			remoteWitnessQuorum: d.remoteWitnessQuorum,
			remoteWitnessTimeoutMs: d.remoteWitnessTimeoutMs,
			noRemoteWitnessCheck: opts.remoteWitnessCheck === false,
			tokenEnv: d.tokenEnv,
		});

		// Handle early-exit errors
		if (result.error) {
			if (opts.json) {
				console.log(JSON.stringify({ error: result.error, path: result.input_paths.events }));
			} else {
				console.log(chalk.red(result.error));
			}
			process.exitCode = 1;
			return;
		}

		if (opts.json) {
			formatJsonOutput(result, resolved);
		} else {
			formatTextOutput(result, opts, resolved);
		}

		if (!result.pass) {
			process.exitCode = 1;
		}
	});

function formatConfigValidationError(errors: { path: string; message: string }[]): string {
	const lines = errors.map(
		(e) => `  ${e.path ? e.path + ": " : ""}${e.message}`,
	);
	return `Config validation failed (profile: strict):\n${lines.join("\n")}`;
}

function formatEffectivePolicy(resolved: ResolvedPolicy, json?: boolean): void {
	if (json) {
		console.log(JSON.stringify({
			resolved_policy: {
				profile: resolved.profileName,
				config_source: resolved.configSource,
				effective: resolved.defaults,
				config_validation: {
					status: resolved.configValidation.status,
					errors: resolved.configValidation.errors,
				},
			},
		}, null, 2));
	} else {
		const cv = resolved.configValidation;
		console.log(chalk.bold("Effective Policy"));
		console.log();
		console.log(`  Profile:                    ${resolved.profileName}`);
		console.log(`  Config source:              ${resolved.configSource}`);
		console.log(`  Config validation:          ${cv.status}`);
		if (cv.errors.length > 0) {
			for (const err of cv.errors) {
				console.log(chalk.yellow(`    ${err.path ? err.path + ": " : ""}${err.message}`));
			}
		}
		console.log();
		const d = resolved.defaults;
		console.log(`  requireSeal:                ${d.requireSeal}`);
		console.log(`  requireWitness:             ${d.requireWitness}`);
		console.log(`  requireRemoteWitnessProof:  ${d.requireRemoteWitnessProof}`);
		console.log(`  requireSignedAttestation:   ${d.requireSignedAttestation}`);
		console.log(`  requireAttestationBinding:  ${d.requireAttestationBinding}`);
		console.log(`  strictAttestationFile:      ${d.strictAttestationFile}`);
		console.log(`  maxSealAgeSeconds:          ${d.maxSealAgeSeconds ?? "-"}`);
		console.log(`  maxWitnessAgeSeconds:       ${d.maxWitnessAgeSeconds ?? "-"}`);
		console.log(`  maxAttestationAgeSeconds:   ${d.maxAttestationAgeSeconds ?? "-"}`);
		console.log(`  remoteWitnessQuorum:        ${d.remoteWitnessQuorum ?? "-"}`);
		console.log(`  remoteWitnessTimeoutMs:     ${d.remoteWitnessTimeoutMs ?? "-"}`);
		console.log(`  tokenEnv:                   ${d.tokenEnv ?? "-"}`);
	}
}

function formatJsonOutput(result: VerifyResult, resolved: ResolvedPolicy): void {
	const output = {
		...result.chain,
		seal: result.seal,
		witness: result.witness,
		remote_witness: result.remote_witness,
		attestation: result.attestation,
		resolved_policy: {
			profile: resolved.profileName,
			config_source: resolved.configSource,
			effective: resolved.defaults,
			config_validation: {
				status: resolved.configValidation.status,
				errors: resolved.configValidation.errors,
			},
		},
	};
	console.log(JSON.stringify(output, null, 2));
}

function formatTextOutput(result: VerifyResult, opts: Record<string, unknown>, resolved: ResolvedPolicy): void {
	const { chain, seal: sealCheck, witness: witnessCheck } = result;
	const status = result.pass
		? chalk.green("PASS")
		: chalk.red("FAIL");

	console.log(chalk.bold("Hash Chain Verification"), status);
	console.log();

	// Policy line
	const d = resolved.defaults;
	const configPart = resolved.configSource !== "none"
		? `config: ${resolved.configSource}`
		: "no config file";
	const thresholds: string[] = [];
	if (d.maxSealAgeSeconds) thresholds.push(`seal-age=${d.maxSealAgeSeconds}s`);
	if (d.maxWitnessAgeSeconds) thresholds.push(`witness-age=${d.maxWitnessAgeSeconds}s`);
	if (d.maxAttestationAgeSeconds) thresholds.push(`attestation-age=${d.maxAttestationAgeSeconds}s`);
	const thresholdStr = thresholds.length > 0 ? ` | ${thresholds.join(" ")}` : "";
	console.log(`  Policy: ${resolved.profileName} (${configPart})${thresholdStr}`);
	console.log();
	console.log(`  Total events:       ${chain.total_events}`);
	console.log(`  Chained events:     ${chain.chained_events}`);
	console.log(`  Legacy events:      ${chain.legacy_events}`);
	console.log(`  Invalid/corrupt:    ${chain.invalid_schema_events}`);
	console.log();

	if (chain.hash_mismatch_count > 0) {
		console.log(chalk.red(`  Hash mismatches:    ${chain.hash_mismatch_count}`));
	}
	if (chain.prev_link_mismatch_count > 0) {
		console.log(chalk.red(`  Link mismatches:    ${chain.prev_link_mismatch_count}`));
	}
	if (chain.first_failure_index !== null) {
		console.log(chalk.red(`  First failure at:   event index ${chain.first_failure_index}`));
	}

	if (opts.allowInvalid && chain.invalid_schema_events > 0) {
		console.log(
			chalk.yellow(
				`  --allow-invalid: ignoring ${chain.invalid_schema_events} invalid/corrupt event(s).`,
			),
		);
	}

	if (result.pass && chain.chained_events > 0) {
		console.log(chalk.green(`  Chain intact across ${chain.chained_events} event(s).`));
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

	// Witness text output
	if (witnessCheck.witness_checked) {
		if (witnessCheck.witness_failure_reason) {
			console.log(chalk.red(`  Witness FAILED: ${witnessCheck.witness_failure_reason}`));
		} else if (witnessCheck.witness_matching_tip_count > 0) {
			const ageStr = witnessCheck.witness_latest_age_seconds !== null
				? ` (age: ${witnessCheck.witness_latest_age_seconds}s)`
				: "";
			const corruptStr = witnessCheck.witness_corrupt_lines > 0
				? ` [${witnessCheck.witness_corrupt_lines} corrupt witness line(s) skipped]`
				: "";
			console.log(chalk.green(`  Witness verified: ${witnessCheck.witness_matching_tip_count} matching record(s)${ageStr}${corruptStr}`));
		} else if (!witnessCheck.witness_present) {
			console.log(chalk.yellow("  Witness: No witness file found. Run 'patchwork witness publish' to create one."));
		}
	}

	// Remote witness text output
	const remoteCheck = result.remote_witness;
	if (remoteCheck.remote_witness_checked) {
		if (remoteCheck.remote_witness_failure_reason) {
			console.log(chalk.red(`  Remote witness FAILED: ${remoteCheck.remote_witness_failure_reason}`));
		} else if (remoteCheck.remote_witness_quorum_met) {
			console.log(chalk.green(`  Remote witness verified: ${remoteCheck.remote_witness_verified_count} proof(s) confirmed`));
		}
	}

	// Attestation text output
	const attestCheck = result.attestation;
	if (attestCheck.attestation_checked) {
		if (attestCheck.attestation_failure_reason) {
			console.log(chalk.red(`  Attestation FAILED: ${attestCheck.attestation_failure_reason}`));
		} else if (attestCheck.attestation_present && attestCheck.attestation_valid) {
			const ageStr = attestCheck.attestation_age_seconds !== null
				? ` (age: ${attestCheck.attestation_age_seconds}s)`
				: "";
			const sigStr = attestCheck.attestation_signed
				? (attestCheck.attestation_signature_valid ? ", signature valid" : ", signature INVALID")
				: ", unsigned";
			const stateStr = attestCheck.attestation_matches_current_state ? ", state bound" : "";
			console.log(chalk.green(`  Attestation verified: hash valid${sigStr}${stateStr}${ageStr}`));
		} else if (!attestCheck.attestation_present) {
			console.log(chalk.yellow("  Attestation: No attestation file found. Run 'patchwork attest' to create one."));
		}
	}
}
