import { Command } from "commander";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import {
	CommitAttestationSchema,
	buildAttestationPayload,
	hashAttestationPayload,
	requestVerification,
	verifyDsseEnvelope,
	decodeStatement,
	digestStatement,
	type DsseEnvelope,
	type InTotoStatement,
	type PatchworkAiAgentPredicate,
} from "@patchwork/core";
import { COMMIT_ATTESTATIONS_DIR, COMMIT_ATTESTATION_INDEX, KEYRING_DIR } from "../store.js";

export const commitAttestCommand = new Command("commit-attest")
	.description("View and verify commit attestations")
	.argument("[sha]", "Commit SHA to inspect")
	.option("--verify", "Verify the attestation signature")
	.option("--list", "List all attested commits")
	.option("--failures", "Show recent attestation failures (commits that should have been attested but weren't)")
	.option("--intoto", "Show the in-toto/DSSE envelope (set PATCHWORK_INTOTO=1 in your hook to enable emission)")
	.option("--intoto-verify", "Verify the in-toto/DSSE envelope's signature")
	.option("--json", "Output as JSON")
	.action(async (sha, opts) => {
		if (opts.list) {
			return listAttestations(opts.json);
		}

		if (opts.failures) {
			return listFailures(opts.json);
		}

		if (!sha) {
			console.log(chalk.red("Provide a commit SHA or use --list / --failures"));
			process.exitCode = 1;
			return;
		}

		// Support short SHAs — find matching file
		const resolvedSha = resolveShortSha(sha);
		if (!resolvedSha) {
			if (opts.json) {
				console.log(JSON.stringify({ error: `No attestation found for ${sha}` }));
			} else {
				console.log(chalk.red(`No attestation found for ${sha}`));
			}
			process.exitCode = 1;
			return;
		}

		if (opts.intoto || opts.intotoVerify) {
			return showOrVerifyIntoto(resolvedSha, !!opts.intotoVerify, opts.json);
		}

		const filePath = join(COMMIT_ATTESTATIONS_DIR, `${resolvedSha}.json`);
		const raw = readFileSync(filePath, "utf-8");
		const parsed = CommitAttestationSchema.safeParse(JSON.parse(raw));

		if (!parsed.success) {
			console.log(chalk.red("Invalid attestation file"));
			process.exitCode = 1;
			return;
		}

		const attestation = parsed.data;

		if (opts.verify) {
			return verifyCommitAttestation(attestation, opts.json);
		}

		if (opts.json) {
			console.log(JSON.stringify(attestation, null, 2));
			return;
		}

		// Pretty print
		const status = attestation.pass
			? chalk.green("PASS")
			: chalk.red("FAIL");
		const risk = attestation.risk_summary;

		console.log(chalk.bold("Commit Attestation"), status);
		console.log();
		console.log(`  Commit:       ${attestation.commit_sha}`);
		console.log(`  Branch:       ${attestation.branch}`);
		console.log(`  Generated:    ${attestation.generated_at}`);
		console.log(`  Session:      ${attestation.session_id}`);
		console.log(`  Events:       ${attestation.session_events_count} total, ${attestation.session_events_since_last_commit} since last commit`);
		console.log(`  Chain:        ${attestation.chain_valid ? "valid" : chalk.red("INVALID")} (${attestation.chain_chained_events} chained)`);
		console.log(`  Risk:         ${risk.critical} critical, ${risk.high} high, ${risk.medium} medium, ${risk.low} low`);
		console.log(`  Denials:      ${risk.denials}`);
		console.log(`  Policy:       ${attestation.policy_source}`);
		console.log(`  Signed:       ${attestation.signature !== "unsigned" ? "yes" : "no"}`);
		console.log(`  Hash:         ${attestation.payload_hash}`);

		if (attestation.failure_reasons.length > 0) {
			console.log(chalk.red(`  Failures:     ${attestation.failure_reasons.join(", ")}`));
		}
	});

function listFailures(json?: boolean): void {
	const failuresPath = join(COMMIT_ATTESTATIONS_DIR, "_failures.jsonl");
	if (!existsSync(failuresPath)) {
		if (json) console.log(JSON.stringify({ failures: [] }));
		else console.log("No attestation failures recorded.");
		return;
	}
	const lines = readFileSync(failuresPath, "utf-8").split("\n").filter((l) => l.trim());
	const entries = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

	if (json) {
		console.log(JSON.stringify({ failures: entries }, null, 2));
		return;
	}
	if (entries.length === 0) {
		console.log("No attestation failures recorded.");
		return;
	}
	console.log(chalk.bold(`Attestation Failures (${entries.length})`));
	console.log();
	for (const e of entries.slice(-20)) {
		const sha = e.commit_sha || chalk.dim("<no-sha>");
		console.log(`  ${e.timestamp}  ${chalk.red(e.stage)}  ${sha}  ${e.session_id}`);
		console.log(`    ${chalk.red(e.error_message)}`);
	}
}

function listAttestations(json?: boolean): void {
	if (!existsSync(COMMIT_ATTESTATION_INDEX)) {
		if (json) {
			console.log(JSON.stringify({ attestations: [] }));
		} else {
			console.log("No commit attestations found.");
		}
		return;
	}

	const lines = readFileSync(COMMIT_ATTESTATION_INDEX, "utf-8")
		.split("\n")
		.filter((l) => l.trim());

	const entries = lines.map((l) => {
		try { return JSON.parse(l); } catch { return null; }
	}).filter(Boolean);

	if (json) {
		console.log(JSON.stringify({ attestations: entries }, null, 2));
		return;
	}

	if (entries.length === 0) {
		console.log("No commit attestations found.");
		return;
	}

	console.log(chalk.bold(`Commit Attestations (${entries.length})`));
	console.log();
	for (const e of entries) {
		const status = e.pass ? chalk.green("PASS") : chalk.red("FAIL");
		console.log(`  ${e.commit_sha}  ${status}  ${e.branch || ""}  ${e.generated_at}`);
	}
}

async function verifyCommitAttestation(
	attestation: ReturnType<typeof CommitAttestationSchema.parse>,
	json?: boolean,
): Promise<void> {
	if (attestation.signature === "unsigned") {
		if (json) {
			console.log(JSON.stringify({ verified: false, reason: "unsigned" }));
		} else {
			console.log(chalk.yellow("Attestation is unsigned — cannot verify"));
		}
		process.exitCode = 1;
		return;
	}

	const keyId = attestation.key_id;
	if (!keyId) {
		if (json) {
			console.log(JSON.stringify({ verified: false, reason: "no_key_id" }));
		} else {
			console.log(chalk.red("FAIL — attestation has no key_id"));
		}
		process.exitCode = 1;
		return;
	}

	const artifact = attestation as unknown as Record<string, unknown>;
	const payloadStr = buildAttestationPayload(artifact);
	const payloadHash = hashAttestationPayload(payloadStr);

	// Check payload hash matches
	if (payloadHash !== attestation.payload_hash) {
		if (json) {
			console.log(JSON.stringify({ verified: false, reason: "payload_hash_mismatch" }));
		} else {
			console.log(chalk.red("FAIL — payload hash mismatch (attestation may be tampered)"));
		}
		process.exitCode = 1;
		return;
	}

	// Verify against the appropriate keyring (local first, then root-owned relay).
	const result = await requestVerification(payloadStr, attestation.signature, keyId, {
		localKeyringPath: KEYRING_DIR,
	});

	if (json) {
		console.log(JSON.stringify({
			verified: result.verified,
			source: result.source,
			payload_hash: payloadHash,
			...(result.reason ? { reason: result.reason } : {}),
		}));
	} else if (result.verified) {
		console.log(chalk.green(`VERIFIED — signature is valid (via ${result.source})`));
	} else {
		const suffix = result.reason ? ` (${result.reason})` : "";
		console.log(chalk.red(`FAIL — signature verification failed${suffix}`));
	}

	if (!result.verified) process.exitCode = 1;
}

async function showOrVerifyIntoto(
	commitSha: string,
	verify: boolean,
	json?: boolean,
): Promise<void> {
	const envPath = join(COMMIT_ATTESTATIONS_DIR, `${commitSha}.intoto.json`);
	if (!existsSync(envPath)) {
		const msg = `No in-toto envelope for ${commitSha} (run with PATCHWORK_INTOTO=1 to enable emission)`;
		if (json) console.log(JSON.stringify({ error: msg }));
		else console.log(chalk.yellow(msg));
		process.exitCode = 1;
		return;
	}
	let envelope: DsseEnvelope;
	try {
		envelope = JSON.parse(readFileSync(envPath, "utf-8")) as DsseEnvelope;
	} catch {
		console.log(chalk.red("Invalid in-toto envelope file"));
		process.exitCode = 1;
		return;
	}

	if (verify) {
		// DSSE verifyFn: convert sigBase64 → hex, prefix with "hmac-sha256:",
		// hand to requestVerification with the PAE bytes as a UTF-8 string
		// (lossless because the in-toto Statement payload is JSON, all UTF-8).
		const ok = await verifyDsseEnvelope(envelope, async (keyid, pae, sigBase64) => {
			const hex = Buffer.from(sigBase64, "base64").toString("hex");
			const sigPatchwork = `hmac-sha256:${hex}`;
			const result = await requestVerification(pae.toString("utf8"), sigPatchwork, keyid, {
				localKeyringPath: KEYRING_DIR,
			});
			return result.verified;
		});
		if (json) {
			console.log(JSON.stringify({
				verified: ok,
				digest: digestStatement(envelope),
				keyids: envelope.signatures.map((s) => s.keyid),
			}));
		} else if (ok) {
			console.log(chalk.green("VERIFIED — DSSE envelope signature is valid"));
			console.log(`  Digest: ${digestStatement(envelope)}`);
		} else {
			console.log(chalk.red("FAIL — DSSE envelope signature did not verify"));
		}
		if (!ok) process.exitCode = 1;
		return;
	}

	let stmt: InTotoStatement<PatchworkAiAgentPredicate>;
	try {
		stmt = decodeStatement<PatchworkAiAgentPredicate>(envelope);
	} catch (err) {
		console.log(chalk.red(`Cannot decode statement: ${(err as Error).message}`));
		process.exitCode = 1;
		return;
	}

	if (json) {
		console.log(JSON.stringify({ envelope, statement: stmt, digest: digestStatement(envelope) }, null, 2));
		return;
	}

	console.log(chalk.bold("In-toto / DSSE Envelope"));
	console.log();
	console.log(`  Subject:      ${stmt.subject[0]?.name ?? "<missing>"}`);
	console.log(`  PredicateType:${stmt.predicateType}`);
	console.log(`  PayloadType:  ${envelope.payloadType}`);
	console.log(`  Digest:       ${digestStatement(envelope)}`);
	console.log(`  Signatures:   ${envelope.signatures.length}`);
	for (const sig of envelope.signatures) {
		console.log(`    keyid=${sig.keyid}  sig=${sig.sig.slice(0, 16)}…`);
	}
	console.log();
	console.log(chalk.dim("  Run with --intoto-verify to check the signature."));
}

function resolveShortSha(sha: string): string | null {
	if (!existsSync(COMMIT_ATTESTATIONS_DIR)) return null;

	// Exact match first
	if (existsSync(join(COMMIT_ATTESTATIONS_DIR, `${sha}.json`))) return sha;

	// Short SHA prefix match
	const files = readdirSync(COMMIT_ATTESTATIONS_DIR)
		.filter((f) => f.endsWith(".json") && f.startsWith(sha));

	if (files.length === 1) return files[0].replace(".json", "");
	return null;
}
