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
	.action((opts) => {
		const result = runVerification({
			file: opts.file,
			sealFile: opts.sealFile,
			keyFile: opts.keyFile,
			keyringDir: opts.keyringDir,
			witnessFile: opts.witnessFile,
			requireSeal: opts.requireSeal,
			requireWitness: opts.requireWitness,
			maxSealAgeSeconds: opts.maxSealAgeSeconds,
			maxWitnessAgeSeconds: opts.maxWitnessAgeSeconds,
		});

		// Build unsigned artifact
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
