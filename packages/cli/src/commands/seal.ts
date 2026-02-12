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
	signSeal,
	ensureSealKey,
	type SealRecord,
} from "@patchwork/core";
import { EVENTS_PATH, SEAL_KEY_PATH, SEALS_PATH } from "../store.js";

/** Lock constants */
const SEAL_LOCK_MAX_RETRIES = 20;
const SEAL_LOCK_BASE_DELAY_MS = 10;
const SEAL_LOCK_STALE_THRESHOLD_MS = 5_000;

interface SealLockMetadata {
	pid: number;
	hostname: string;
	created_at_ms: number;
}

export const sealCommand = new Command("seal")
	.description("HMAC-seal the current chain tip to detect full-log rewrites")
	.option("--file <path>", "Path to events JSONL file")
	.option("--key-file <path>", "Path to seal key file")
	.option("--seal-file <path>", "Path to seals JSONL file")
	.option("--allow-invalid", "Do not fail on invalid/corrupt event lines")
	.option("--json", "Output result as JSON")
	.action((opts) => {
		const eventsPath = opts.file || EVENTS_PATH;
		const keyPath = opts.keyFile || SEAL_KEY_PATH;
		const sealPath = opts.sealFile || SEALS_PATH;

		if (!existsSync(eventsPath)) {
			if (opts.json) {
				console.log(JSON.stringify({ error: "No audit log found", path: eventsPath }));
			} else {
				console.log(chalk.yellow("No audit log found at:"), chalk.dim(eventsPath));
			}
			process.exitCode = 1;
			return;
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

		// Verify chain to get tip info
		const chainResult = verifyChain(events);
		chainResult.invalid_schema_events += parseErrors;

		if (!opts.allowInvalid && chainResult.invalid_schema_events > 0) {
			if (opts.json) {
				console.log(JSON.stringify({
					error: "Invalid/corrupt events detected",
					invalid_schema_events: chainResult.invalid_schema_events,
				}));
			} else {
				console.log(chalk.red(`${chainResult.invalid_schema_events} invalid/corrupt event(s) detected.`));
				console.log(chalk.dim("Use --allow-invalid to seal anyway, or run 'patchwork verify' to inspect."));
			}
			process.exitCode = 1;
			return;
		}

		if (chainResult.chained_events === 0) {
			if (opts.json) {
				console.log(JSON.stringify({ error: "No chained events to seal" }));
			} else {
				console.log(chalk.yellow("No chained events found. Nothing to seal."));
			}
			process.exitCode = 1;
			return;
		}

		// Find the tip hash (last chained event's event_hash)
		let tipHash: string | null = null;
		for (let i = events.length - 1; i >= 0; i--) {
			const h = events[i].event_hash;
			if (typeof h === "string") {
				tipHash = h;
				break;
			}
		}

		if (!tipHash) {
			console.log(chalk.red("Could not determine chain tip hash."));
			process.exitCode = 1;
			return;
		}

		// Load or create seal key
		const key = ensureSealKey(keyPath);

		// Create seal record
		const sealedAt = new Date().toISOString();
		const payload = computeSealPayload(tipHash, chainResult.chained_events, sealedAt);
		const signature = signSeal(payload, key);

		const seal: SealRecord = {
			sealed_at: sealedAt,
			tip_hash: tipHash,
			chained_events: chainResult.chained_events,
			signature,
		};

		// Locked append
		ensureSealFile(sealPath);
		withSealLock(sealPath, () => {
			appendFileSync(sealPath, JSON.stringify(seal) + "\n", "utf-8");
		});

		if (opts.json) {
			console.log(JSON.stringify(seal, null, 2));
		} else {
			console.log(chalk.bold("Seal created"));
			console.log();
			console.log(`  Sealed at:        ${sealedAt}`);
			console.log(`  Tip hash:         ${chalk.dim(tipHash)}`);
			console.log(`  Chained events:   ${chainResult.chained_events}`);
			console.log(`  Signature:        ${chalk.dim(signature.slice(0, 30))}...`);
			console.log();
			console.log(chalk.green("Seal appended to:"), chalk.dim(sealPath));
		}
	});

/**
 * Acquire an exclusive lock for the seal file, run the critical section,
 * then release. Uses O_EXCL for atomicity, bounded retry with backoff,
 * and stale-lock reclamation.
 */
function withSealLock(sealPath: string, fn: () => void): void {
	const lockPath = sealPath + ".lock";
	let fd: number | null = null;

	for (let attempt = 0; attempt <= SEAL_LOCK_MAX_RETRIES; attempt++) {
		try {
			fd = openSync(lockPath, "wx");
			// Write metadata for stale detection
			const meta: SealLockMetadata = {
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
			if (isSealLockStale(lockPath)) {
				try {
					unlinkSync(lockPath);
					continue; // retry immediately after reclaim
				} catch {
					// Another process beat us — continue retrying
				}
			}

			if (attempt === SEAL_LOCK_MAX_RETRIES) {
				throw new Error(
					`Seal lock contention: could not acquire ${lockPath} after ${SEAL_LOCK_MAX_RETRIES} attempts. ` +
					"Another seal process may be active.",
				);
			}

			// Bounded exponential backoff: 10ms, 20ms, 40ms, ... capped at 200ms
			const delay = Math.min(SEAL_LOCK_BASE_DELAY_MS * (2 ** attempt), 200);
			sleepSync(delay);
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

/** Check whether an existing seal lock file is stale. */
function isSealLockStale(lockPath: string): boolean {
	try {
		const content = readFileSync(lockPath, "utf-8");
		const meta: SealLockMetadata = JSON.parse(content);

		// Guard against future timestamps (clock skew)
		if (meta.created_at_ms > Date.now() + 60_000) {
			// Suspicious future timestamp — fall back to mtime
			return isStalByMtime(lockPath);
		}

		const age = Date.now() - meta.created_at_ms;

		// Same host: check process liveness
		if (meta.hostname === hostname()) {
			try {
				process.kill(meta.pid, 0);
				// Process alive — only stale if very old
				return age > SEAL_LOCK_STALE_THRESHOLD_MS;
			} catch {
				// Process dead — stale
				return true;
			}
		}

		// Cross-host: age-only
		return age > SEAL_LOCK_STALE_THRESHOLD_MS;
	} catch {
		// Can't read or parse — fall back to mtime
		return isStalByMtime(lockPath);
	}
}

/** Fallback stale check using file modification time. */
function isStalByMtime(lockPath: string): boolean {
	try {
		const stat = statSync(lockPath);
		return Date.now() - stat.mtimeMs > SEAL_LOCK_STALE_THRESHOLD_MS;
	} catch {
		return true; // File gone — treat as stale
	}
}

/** Synchronous sleep using Atomics.wait. */
function sleepSync(ms: number): void {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Ensure the seal file and its parent directory exist with secure permissions.
 * Creates parent dir (0700) and file (0600) if missing; reconciles insecure
 * permissions on existing paths.
 */
function ensureSealFile(sealPath: string): void {
	const dir = dirname(sealPath);

	// Parent directory: create or reconcile to 0700
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true, mode: 0o700 });
	} else {
		reconcileMode(dir, 0o700);
	}

	// Seal file: create or reconcile to 0600
	if (!existsSync(sealPath)) {
		writeFileSync(sealPath, "", { mode: 0o600 });
	} else {
		reconcileMode(sealPath, 0o600);
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
		// Path disappeared between check and chmod — safe to ignore
	}
}
