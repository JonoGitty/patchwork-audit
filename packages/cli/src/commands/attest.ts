import { Command } from "commander";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import chalk from "chalk";
import {
	ensureKeyring,
	readSealKey,
	loadKeyById,
	buildAttestationPayload,
	hashAttestationPayload,
	signAttestation,
} from "@patchwork/core";
import { runVerification, reconcileMode, type VerifyResult } from "../verify-engine.js";
import { ATTESTATION_PATH, ATTESTATIONS_DIR, KEYRING_DIR, SEAL_KEY_PATH } from "../store.js";
import { TOOL_VERSION } from "../version.js";
import { loadConfig, resolveVerifyDefaults, type ResolvedPolicy } from "../config.js";

/** The signed attestation artifact schema. */
interface AttestationArtifact {
	schema_version: 1;
	generated_at: string;
	tool_version: string;
	pass: boolean;
	input_paths: {
		events: string;
		seals: string;
		witnesses: string;
	};
	chain: VerifyResult["chain"];
	seal: VerifyResult["seal"];
	witness: VerifyResult["witness"];
	error: string | null;
	/** Binding fields — tie the attestation to the exact audit state at generation time. */
	chain_tip_hash: string | null;
	chain_chained_events: number;
	seal_tip_hash: string | null;
	witness_latest_matching_tip_hash: string | null;
	payload_hash: string;
	signature: string;
	key_id?: string;
}

export const attestCommand = new Command("attest")
	.description("Generate a signed, machine-readable attestation artifact from verification results")
	.option("--out <path>", "Output file path (default: ~/.patchwork/attestations/latest.json)")
	.option("--json", "Also print the attestation JSON to stdout")
	.option("--file <path>", "Path to events JSONL file")
	.option("--seal-file <path>", "Path to seals JSONL file")
	.option("--key-file <path>", "Path to legacy single seal key file")
	.option("--keyring-dir <path>", "Path to seal keyring directory")
	.option("--witness-file <path>", "Path to witness records JSONL file")
	.option("--require-seal", "Fail if no valid seal exists")
	.option("--require-witness", "Fail if no valid matching witness record exists")
	.option("--max-seal-age-seconds <n>", "Fail if latest seal is older than n seconds")
	.option("--max-witness-age-seconds <n>", "Fail if latest matching witness is older than n seconds")
	.option("--history", "Write timestamped artifact to history in addition to latest")
	.option("--max-history-files <n>", "Maximum number of history files to keep (default: unlimited)")
	.option("--profile <name>", "Enforcement profile: strict, baseline (default: baseline)")
	.option("--show-effective-policy", "Show resolved policy configuration and exit")
	.action(async (opts) => {
		// Validate --max-history-files early
		if (opts.maxHistoryFiles !== undefined) {
			const n = Number(opts.maxHistoryFiles);
			if (!Number.isInteger(n) || n <= 0) {
				const msg = `Invalid --max-history-files: "${opts.maxHistoryFiles}". Must be a positive integer (> 0).`;
				if (opts.json) {
					console.log(JSON.stringify({ error: msg }));
				} else {
					console.log(chalk.red(msg));
				}
				process.exitCode = 1;
				return;
			}
		}

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
			requireSeal: d.requireSeal || undefined,
			requireWitness: d.requireWitness || undefined,
			maxSealAgeSeconds: d.maxSealAgeSeconds,
			maxWitnessAgeSeconds: d.maxWitnessAgeSeconds,
		});

		// Build unsigned artifact with binding fields that tie it to current state
		const artifact: Record<string, unknown> = {
			schema_version: 1,
			generated_at: new Date().toISOString(),
			tool_version: TOOL_VERSION,
			pass: result.pass,
			input_paths: result.input_paths,
			chain: result.chain,
			seal: result.seal,
			witness: result.witness,
			error: result.error,
			chain_tip_hash: result.chain_tip_hash,
			chain_chained_events: result.chain.chained_events,
			seal_tip_hash: result.seal.seal_tip_hash,
			witness_latest_matching_tip_hash:
				result.witness.witness_matching_tip_count > 0 ? result.chain_tip_hash : null,
		};

		// Resolve signing key
		const keyringDir = opts.keyringDir || KEYRING_DIR;
		const keyPath = opts.keyFile || SEAL_KEY_PATH;
		let key: Buffer | null = null;
		let keyId: string | undefined;

		try {
			const kr = ensureKeyring(keyringDir);
			key = kr.key;
			keyId = kr.keyId;
		} catch {
			// Keyring unavailable — try legacy key
			try {
				key = readSealKey(keyPath);
			} catch {
				// No key available — sign with empty signature
			}
		}

		// Compute payload hash and signature
		const payloadStr = buildAttestationPayload(artifact);
		artifact.payload_hash = hashAttestationPayload(payloadStr);

		if (key) {
			artifact.signature = signAttestation(payloadStr, key);
			if (keyId !== undefined) {
				artifact.key_id = keyId;
			}
		} else {
			artifact.signature = "unsigned";
		}

		const signedArtifact = artifact as unknown as AttestationArtifact;

		// Write artifact to disk
		const outPath = opts.out || ATTESTATION_PATH;
		ensureAttestationDir(outPath);
		const artifactJson = JSON.stringify(signedArtifact, null, 2) + "\n";
		writeFileSync(outPath, artifactJson, { mode: 0o600 });
		reconcileMode(outPath, 0o600);

		// History mode: write timestamped copy
		if (opts.history) {
			const attestDir = opts.out ? dirname(opts.out) : ATTESTATIONS_DIR;
			ensureAttestationDir(join(attestDir, "_placeholder"));
			const ts = (signedArtifact.generated_at as string).replace(/[:.]/g, "-");
			const historyPath = join(attestDir, `attestation-${ts}.json`);
			writeFileSync(historyPath, artifactJson, { mode: 0o600 });
			reconcileMode(historyPath, 0o600);

			// Retention pruning
			if (opts.maxHistoryFiles !== undefined) {
				const maxFiles = Number(opts.maxHistoryFiles);
				if (Number.isInteger(maxFiles) && maxFiles > 0) {
					pruneHistory(attestDir, maxFiles);
				}
			}
		}

		if (opts.json) {
			console.log(JSON.stringify(signedArtifact, null, 2));
		} else {
			const status = result.pass
				? chalk.green("PASS")
				: chalk.red("FAIL");
			console.log(chalk.bold("Attestation"), status);
			console.log();
			console.log(`  Artifact written to: ${outPath}`);
			console.log(`  Chain events:        ${result.chain.chained_events}`);
			console.log(`  Seal checked:        ${result.seal.seal_checked ? (result.seal.seal_valid ? "valid" : "failed") : "skipped"}`);
			console.log(`  Witness checked:     ${result.witness.witness_checked ? (result.witness.witness_matching_tip_count > 0 ? `${result.witness.witness_matching_tip_count} match(es)` : "no matches") : "skipped"}`);
			console.log(`  Signed:              ${signedArtifact.signature !== "unsigned" ? "yes" : "no (no key available)"}`);

			if (result.error) {
				console.log(chalk.red(`  Error: ${result.error}`));
			}
			if (result.seal.seal_failure_reason) {
				console.log(chalk.red(`  Seal: ${result.seal.seal_failure_reason}`));
			}
			if (result.witness.witness_failure_reason) {
				console.log(chalk.red(`  Witness: ${result.witness.witness_failure_reason}`));
			}
		}

		if (!result.pass) {
			process.exitCode = 1;
		}
	});

/** Ensure attestation dir exists with secure permissions. */
function ensureAttestationDir(filePath: string): void {
	const dir = dirname(filePath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true, mode: 0o700 });
	} else {
		reconcileMode(dir, 0o700);
	}
}

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

/** Prune history files, keeping only the N most recent. */
function pruneHistory(dir: string, maxFiles: number): void {
	try {
		const files = readdirSync(dir)
			.filter((f) => f.startsWith("attestation-") && f.endsWith(".json"))
			.sort(); // lexicographic sort = chronological for ISO-derived filenames

		const toRemove = files.slice(0, Math.max(0, files.length - maxFiles));
		for (const f of toRemove) {
			try {
				unlinkSync(join(dir, f));
			} catch {
				// best-effort cleanup
			}
		}
	} catch {
		// dir read failed — skip pruning
	}
}
