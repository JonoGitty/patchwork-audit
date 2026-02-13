import { Command } from "commander";
import {
	appendFileSync,
	chmodSync,
	closeSync,
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { hostname } from "node:os";
import chalk from "chalk";
import {
	verifyChain,
	computeSealPayload,
	verifySeal,
	readSealKey,
	loadKeyById,
	buildWitnessPayload,
	validateWitnessResponse,
	type SealRecord,
	type WitnessRecord,
} from "@patchwork/core";
import { EVENTS_PATH, SEAL_KEY_PATH, KEYRING_DIR, SEALS_PATH, WITNESSES_PATH } from "../store.js";

export const witnessCommand = new Command("witness")
	.description("Anchor chain tips to external witness endpoints");

witnessCommand
	.command("publish")
	.description("Publish the current chain tip + seal to one or more witness endpoints")
	.option("--file <path>", "Path to events JSONL file")
	.option("--seal-file <path>", "Path to seals JSONL file")
	.option("--witness-file <path>", "Path to witness records JSONL file")
	.option("--witness-url <url...>", "Witness endpoint URL(s) (at least one required)")
	.option("--quorum <n>", "Minimum successful witnesses required (default: 1)")
	.option("--timeout-ms <n>", "HTTP timeout per endpoint in milliseconds (default: 2000)")
	.option("--token-env <name>", "Environment variable name for bearer token")
	.option("--json", "Output result as JSON")
	.option("--key-file <path>", "Path to legacy single seal key file")
	.option("--keyring-dir <path>", "Path to seal keyring directory")
	.action(async (opts) => {
		// Validate required --witness-url
		const urls: string[] = opts.witnessUrl || [];
		if (urls.length === 0) {
			const msg = "At least one --witness-url is required.";
			if (opts.json) {
				console.log(JSON.stringify({ error: msg }));
			} else {
				console.log(chalk.red(msg));
			}
			process.exitCode = 1;
			return;
		}

		// Validate --quorum
		const quorum = opts.quorum !== undefined ? Number(opts.quorum) : 1;
		if (!Number.isInteger(quorum) || quorum < 1) {
			const msg = `Invalid --quorum: "${opts.quorum}" (must be a positive integer).`;
			if (opts.json) {
				console.log(JSON.stringify({ error: msg }));
			} else {
				console.log(chalk.red(msg));
			}
			process.exitCode = 1;
			return;
		}

		// Validate --timeout-ms
		const timeoutMs = opts.timeoutMs !== undefined ? Number(opts.timeoutMs) : 2000;
		if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
			const msg = `Invalid --timeout-ms: "${opts.timeoutMs}" (must be a positive integer).`;
			if (opts.json) {
				console.log(JSON.stringify({ error: msg }));
			} else {
				console.log(chalk.red(msg));
			}
			process.exitCode = 1;
			return;
		}

		// 1. Validate local chain
		const eventsPath = opts.file || EVENTS_PATH;
		if (!existsSync(eventsPath)) {
			const msg = "No audit log found.";
			if (opts.json) {
				console.log(JSON.stringify({ error: msg, path: eventsPath }));
			} else {
				console.log(chalk.red(msg), chalk.dim(eventsPath));
			}
			process.exitCode = 1;
			return;
		}

		const content = readFileSync(eventsPath, "utf-8");
		const lines = content.split("\n").filter((l) => l.trim().length > 0);
		const events: Record<string, unknown>[] = [];
		for (const line of lines) {
			try {
				events.push(JSON.parse(line));
			} catch {
				// skip corrupt lines
			}
		}

		const chainResult = verifyChain(events);
		if (chainResult.hash_mismatch_count > 0 || chainResult.prev_link_mismatch_count > 0) {
			const msg = "Chain integrity check failed. Fix chain before publishing witness.";
			if (opts.json) {
				console.log(JSON.stringify({ error: msg, chain: chainResult }));
			} else {
				console.log(chalk.red(msg));
			}
			process.exitCode = 1;
			return;
		}

		if (chainResult.chained_events === 0) {
			const msg = "No chained events found. Nothing to witness.";
			if (opts.json) {
				console.log(JSON.stringify({ error: msg }));
			} else {
				console.log(chalk.yellow(msg));
			}
			process.exitCode = 1;
			return;
		}

		// Find tip hash
		let tipHash: string | null = null;
		for (let i = events.length - 1; i >= 0; i--) {
			const h = events[i].event_hash;
			if (typeof h === "string") {
				tipHash = h;
				break;
			}
		}
		if (!tipHash) {
			const msg = "Could not determine chain tip hash.";
			if (opts.json) {
				console.log(JSON.stringify({ error: msg }));
			} else {
				console.log(chalk.red(msg));
			}
			process.exitCode = 1;
			return;
		}

		// 2. Validate latest seal
		const sealPath = opts.sealFile || SEALS_PATH;
		if (!existsSync(sealPath)) {
			const msg = "No seal file found. Run 'patchwork seal' before publishing witness.";
			if (opts.json) {
				console.log(JSON.stringify({ error: msg, path: sealPath }));
			} else {
				console.log(chalk.red(msg));
			}
			process.exitCode = 1;
			return;
		}

		const sealContent = readFileSync(sealPath, "utf-8");
		const sealLines = sealContent.split("\n").filter((l) => l.trim().length > 0);
		const latestSeal = findLatestValidSeal(sealLines);

		if (!latestSeal) {
			const msg = "No valid seal record found in seal file.";
			if (opts.json) {
				console.log(JSON.stringify({ error: msg }));
			} else {
				console.log(chalk.red(msg));
			}
			process.exitCode = 1;
			return;
		}

		// Verify seal signature
		const keyPath = opts.keyFile || SEAL_KEY_PATH;
		const keyringDir = opts.keyringDir || KEYRING_DIR;
		let key: Buffer | null = null;

		if (latestSeal.key_id) {
			try {
				key = loadKeyById(keyringDir, latestSeal.key_id);
			} catch {
				// try legacy fallback
			}
		}
		if (!key) {
			try {
				key = readSealKey(keyPath);
			} catch {
				const msg = "Cannot read seal key for verification.";
				if (opts.json) {
					console.log(JSON.stringify({ error: msg }));
				} else {
					console.log(chalk.red(msg));
				}
				process.exitCode = 1;
				return;
			}
		}

		const sealPayload = computeSealPayload(
			latestSeal.tip_hash,
			latestSeal.chained_events,
			latestSeal.sealed_at,
		);
		if (!verifySeal(sealPayload, latestSeal.signature, key)) {
			const msg = "Latest seal has invalid signature. Cannot publish witness with invalid seal.";
			if (opts.json) {
				console.log(JSON.stringify({ error: msg }));
			} else {
				console.log(chalk.red(msg));
			}
			process.exitCode = 1;
			return;
		}

		// Verify seal tip matches chain tip
		if (latestSeal.tip_hash !== tipHash) {
			const msg = "Seal tip does not match current chain tip. Run 'patchwork seal' to create a fresh seal.";
			if (opts.json) {
				console.log(JSON.stringify({ error: msg }));
			} else {
				console.log(chalk.red(msg));
			}
			process.exitCode = 1;
			return;
		}

		// 3. Build witness payload and publish
		const requestedAt = new Date().toISOString();
		const witnessPayloadStr = buildWitnessPayload({
			tip_hash: tipHash,
			chained_events: chainResult.chained_events,
			seal_signature: latestSeal.signature,
			key_id: latestSeal.key_id,
			requested_at: requestedAt,
		});

		// Resolve bearer token
		let bearerToken: string | undefined;
		if (opts.tokenEnv) {
			bearerToken = process.env[opts.tokenEnv];
		}

		// POST to each witness URL
		const results: { url: string; record?: WitnessRecord; error?: string }[] = [];

		for (const url of urls) {
			try {
				const record = await postToWitness(
					url,
					witnessPayloadStr,
					timeoutMs,
					tipHash,
					chainResult.chained_events,
					latestSeal.signature,
					latestSeal.key_id,
					bearerToken,
					requestedAt,
				);
				results.push({ url, record });
			} catch (err) {
				results.push({ url, error: err instanceof Error ? err.message : String(err) });
			}
		}

		// 4. Persist successful witness records
		const witnessFilePath = opts.witnessFile || WITNESSES_PATH;
		const successes = results.filter((r) => r.record);
		const failures = results.filter((r) => r.error);

		if (successes.length > 0) {
			ensureWitnessFile(witnessFilePath);
			withWitnessLock(witnessFilePath, () => {
				for (const s of successes) {
					appendFileSync(witnessFilePath, JSON.stringify(s.record) + "\n", "utf-8");
				}
			});
			reconcileMode(witnessFilePath, 0o600);
		}

		// 5. Quorum check
		const quorumMet = successes.length >= quorum;

		if (opts.json) {
			console.log(JSON.stringify({
				quorum_met: quorumMet,
				quorum,
				successes: successes.length,
				failures: failures.length,
				results: results.map((r) => ({
					url: r.url,
					anchor_id: r.record?.anchor_id ?? null,
					error: r.error ?? null,
				})),
			}, null, 2));
		} else {
			console.log(chalk.bold("Witness Publish"));
			console.log();
			for (const r of results) {
				if (r.record) {
					console.log(chalk.green(`  + ${r.url}`), chalk.dim(`anchor=${r.record.anchor_id}`));
				} else {
					console.log(chalk.red(`  - ${r.url}`), chalk.dim(r.error || "unknown error"));
				}
			}
			console.log();
			console.log(`  Successes: ${successes.length}/${urls.length} (quorum: ${quorum})`);
			if (quorumMet) {
				console.log(chalk.green("  Quorum met."));
			} else {
				console.log(chalk.red(`  Quorum NOT met (need ${quorum}, got ${successes.length}).`));
			}
		}

		if (!quorumMet) {
			process.exitCode = 1;
		}
	});

/** Scan seal lines backward to find latest valid JSON seal record. */
function findLatestValidSeal(sealLines: string[]): SealRecord | null {
	for (let i = sealLines.length - 1; i >= 0; i--) {
		try {
			const parsed = JSON.parse(sealLines[i]) as Record<string, unknown>;
			if (
				parsed.sealed_at &&
				parsed.tip_hash &&
				typeof parsed.chained_events === "number" &&
				parsed.signature
			) {
				return parsed as unknown as SealRecord;
			}
		} catch {
			continue;
		}
	}
	return null;
}

/** POST witness payload to a single endpoint. Returns WitnessRecord on success. */
async function postToWitness(
	url: string,
	payloadStr: string,
	timeoutMs: number,
	tipHash: string,
	chainedEvents: number,
	sealSignature: string,
	keyId?: string,
	bearerToken?: string,
	fallbackWitnessedAt?: string,
): Promise<WitnessRecord> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (bearerToken) {
		headers["Authorization"] = `Bearer ${bearerToken}`;
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(url, {
			method: "POST",
			headers,
			body: payloadStr,
			signal: controller.signal,
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const body = await response.json();
		const result = validateWitnessResponse(body, url, tipHash, chainedEvents, sealSignature, keyId, fallbackWitnessedAt);

		if ("error" in result) {
			throw new Error(result.error);
		}

		return result;
	} finally {
		clearTimeout(timer);
	}
}

/** Ensure witness file and parent dir exist with secure permissions. */
function ensureWitnessFile(filePath: string): void {
	const dir = dirname(filePath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true, mode: 0o700 });
	} else {
		reconcileMode(dir, 0o700);
	}
	if (!existsSync(filePath)) {
		writeFileSync(filePath, "", { mode: 0o600 });
	} else {
		reconcileMode(filePath, 0o600);
	}
}

/** Chmod path to target mode if current mode doesn't match. */
function reconcileMode(path: string, targetMode: number): void {
	try {
		const stat = statSync(path);
		if ((stat.mode & 0o777) !== targetMode) {
			chmodSync(path, targetMode);
		}
	} catch {
		// Path disappeared — safe to ignore
	}
}

/** Lock constants */
const WITNESS_LOCK_MAX_RETRIES = 20;
const WITNESS_LOCK_BASE_DELAY_MS = 10;
const WITNESS_LOCK_STALE_THRESHOLD_MS = 5_000;

interface WitnessLockMetadata {
	pid: number;
	hostname: string;
	created_at_ms: number;
}

/**
 * Acquire an exclusive lock for the witness file, run the critical section,
 * then release. Uses O_EXCL for atomicity, bounded retry with backoff,
 * and stale-lock reclamation.
 */
function withWitnessLock(witnessPath: string, fn: () => void): void {
	const lockPath = witnessPath + ".lock";
	let fd: number | null = null;

	for (let attempt = 0; attempt <= WITNESS_LOCK_MAX_RETRIES; attempt++) {
		try {
			fd = openSync(lockPath, "wx");
			// Write metadata for stale detection
			const meta: WitnessLockMetadata = {
				pid: process.pid,
				hostname: hostname(),
				created_at_ms: Date.now(),
			};
			writeFileSync(fd, JSON.stringify(meta));
			break;
		} catch (err: unknown) {
			if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
			fd = null;

			// Try to reclaim stale lock
			if (isWitnessLockStale(lockPath)) {
				try {
					unlinkSync(lockPath);
					continue; // retry immediately after reclaim
				} catch {
					// Another process beat us — continue retrying
				}
			}

			if (attempt === WITNESS_LOCK_MAX_RETRIES) {
				throw new Error(
					`Witness lock contention: could not acquire ${lockPath} after ${WITNESS_LOCK_MAX_RETRIES} attempts. ` +
					"Another witness process may be active.",
				);
			}

			// Bounded exponential backoff: 10ms, 20ms, 40ms, ... capped at 200ms
			const delay = Math.min(WITNESS_LOCK_BASE_DELAY_MS * 2 ** attempt, 200);
			const jitter = Math.floor(Math.random() * delay);
			Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay + jitter);
		}
	}

	try {
		fn();
	} finally {
		// Release: close fd, then remove lock
		if (fd !== null) {
			try { closeSync(fd); } catch { /* ignore */ }
		}
		try { unlinkSync(lockPath); } catch { /* ignore */ }
	}
}

/** Check whether an existing witness lock file is stale. */
function isWitnessLockStale(lockPath: string): boolean {
	try {
		const content = readFileSync(lockPath, "utf-8");
		const meta: WitnessLockMetadata = JSON.parse(content);

		// Guard against future timestamps (clock skew)
		if (meta.created_at_ms > Date.now() + 60_000) {
			return isStaleByMtime(lockPath);
		}

		const age = Date.now() - meta.created_at_ms;

		// Same host: check process liveness
		if (meta.hostname === hostname()) {
			try {
				process.kill(meta.pid, 0);
				// Process alive — not stale unless very old
				return age > WITNESS_LOCK_STALE_THRESHOLD_MS;
			} catch {
				// Process dead — stale
				return true;
			}
		}

		// Cross-host: age-only
		return age > WITNESS_LOCK_STALE_THRESHOLD_MS;
	} catch {
		// Can't read or parse — fall back to mtime
		return isStaleByMtime(lockPath);
	}
}

/** Fallback stale check using file modification time. */
function isStaleByMtime(lockPath: string): boolean {
	try {
		const stat = statSync(lockPath);
		return Date.now() - stat.mtimeMs > WITNESS_LOCK_STALE_THRESHOLD_MS;
	} catch {
		return true; // File gone — treat as stale
	}
}
