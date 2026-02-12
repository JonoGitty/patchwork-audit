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
import { randomUUID } from "node:crypto";
import { AuditEventSchema } from "../schema/event.js";
import type { AuditEvent } from "../schema/event.js";
import type { EventFilter, Store } from "./types.js";
import { computeEventHash } from "../hash/chain.js";

/** Secure directory mode: owner-only read/write/execute */
const DIR_MODE = 0o700;
/** Secure file mode: owner-only read/write */
const FILE_MODE = 0o600;

/** Max attempts to acquire the lock file */
const LOCK_MAX_RETRIES = 50;
/** Delay between lock retries in ms */
const LOCK_RETRY_DELAY_MS = 10;
/** Lock files older than this (ms) are considered stale and reclaimable */
const LOCK_STALE_THRESHOLD_MS = 5_000;
/** Cached hostname for lock ownership checks. */
const LOCK_HOSTNAME = hostname();
/** Maximum allowed clock skew before treating created_at_ms as invalid (ms). */
const LOCK_FUTURE_SKEW_MS = 60_000;

/**
 * @internal Lock I/O operations, injectable for deterministic testing.
 * Default implementations use real fs / helpers; tests can override
 * individual operations via _setLockIO().
 */
interface LockIO {
	openLock(path: string): number;
	unlinkLock(path: string): void;
	sleep(ms: number): void;
	isStale(lockPath: string, thresholdMs: number): boolean;
}

const defaultLockIO: LockIO = {
	openLock: (path) => openSync(path, "wx"),
	unlinkLock: (path) => unlinkSync(path),
	sleep: (ms) => sleepSync(ms),
	isStale: (path, ms) => isLockStale(path, ms),
};

let lockIO: LockIO = defaultLockIO;

/** @internal For testing only. Override lock I/O operations. Pass null to restore defaults. */
export function _setLockIO(overrides: Partial<LockIO> | null): void {
	lockIO =
		overrides === null
			? defaultLockIO
			: { ...defaultLockIO, ...overrides };
}

/**
 * Append-only JSONL store for audit events.
 * - Validates events against Zod schema on write (rejects invalid).
 * - Validates events on read (skips corrupt lines, counts errors).
 * - Deduplicates by idempotency_key on append (inside lock critical section).
 * - Uses advisory file lock for process-level concurrency safety.
 * - Reconciles dir/file permissions on init.
 */
export class JsonlStore implements Store {
	/** Count of corrupt/invalid lines skipped during the last read operation. */
	lastReadErrors = 0;

	constructor(private readonly filePath: string) {
		const dir = dirname(filePath);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true, mode: DIR_MODE });
		} else {
			reconcileMode(dir, DIR_MODE);
		}
		// Reconcile existing data file permissions
		if (existsSync(filePath)) {
			reconcileMode(filePath, FILE_MODE);
		}
	}

	append(event: AuditEvent): void {
		// Validate against schema before writing
		const result = AuditEventSchema.safeParse(event);
		if (!result.success) {
			throw new Error(
				`Invalid event: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
			);
		}

		const lockPath = this.filePath + ".lock";

		this.withLock(lockPath, () => {
			const { events: existing, errors } = this.parseFile();
			if (errors > 0) {
				throw new Error(
					`Refusing to append to corrupted audit log: ${errors} invalid/corrupt line(s) detected. Run "patchwork verify" to inspect.`,
				);
			}

			// Dedup by idempotency_key INSIDE the lock to prevent TOCTOU races
			if (event.idempotency_key) {
				if (existing.some((e) => e.idempotency_key === event.idempotency_key)) {
					return; // Already recorded — skip silently
				}
			}

			// Compute hash chain: prev_hash from last chained event, then event_hash
			const lastChainedHash = this.getLastChainedHash(existing);
			const chained = {
				...event,
				prev_hash: lastChainedHash,
			} as Record<string, unknown>;
			chained.event_hash = computeEventHash(chained);

			const line = JSON.stringify(chained) + "\n";
			const isNew = !existsSync(this.filePath);
			appendFileSync(this.filePath, line, "utf-8");
			if (isNew) {
				chmodSync(this.filePath, FILE_MODE);
			}
		});
	}

	readAll(): AuditEvent[] {
		const { events, errors } = this.parseFile();
		this.lastReadErrors = errors;
		return events;
	}

	readRecent(limit: number): AuditEvent[] {
		const all = this.readAll();
		return all.slice(-limit);
	}

	query(filter: EventFilter): AuditEvent[] {
		let events = this.readAll();

		if (filter.agent) {
			events = events.filter((e) => e.agent === filter.agent);
		}
		if (filter.action) {
			events = events.filter((e) => e.action === filter.action);
		}
		if (filter.minRisk) {
			const order = ["none", "low", "medium", "high", "critical"];
			const minIdx = order.indexOf(filter.minRisk);
			events = events.filter((e) => order.indexOf(e.risk.level) >= minIdx);
		}
		if (filter.sessionId) {
			events = events.filter((e) => e.session_id === filter.sessionId);
		}
		if (filter.since) {
			const sinceTs = filter.since.toISOString();
			events = events.filter((e) => e.timestamp >= sinceTs);
		}
		if (filter.targetGlob) {
			const pattern = filter.targetGlob;
			events = events.filter((e) => {
				const path = e.target?.path || e.target?.abs_path || "";
				return path.includes(pattern.replace(/\*/g, ""));
			});
		}
		if (filter.projectName) {
			events = events.filter((e) => e.project?.name === filter.projectName);
		}

		if (filter.limit) {
			events = events.slice(-filter.limit);
		}

		return events;
	}

	get path(): string {
		return this.filePath;
	}

	/** Get the event_hash of the last chained event, or null if none. */
	private getLastChainedHash(events: AuditEvent[]): string | null {
		for (let i = events.length - 1; i >= 0; i--) {
			const h = (events[i] as Record<string, unknown>).event_hash;
			if (typeof h === "string") {
				return h;
			}
		}
		return null;
	}

	/** Parse file with schema validation, returning valid events and error count. */
	private parseFile(): { events: AuditEvent[]; errors: number } {
		if (!existsSync(this.filePath)) {
			return { events: [], errors: 0 };
		}
		const content = readFileSync(this.filePath, "utf-8");
		const lines = content.split("\n").filter((line) => line.trim().length > 0);
		const events: AuditEvent[] = [];
		let errors = 0;

		for (const line of lines) {
			try {
				const raw = JSON.parse(line);
				const result = AuditEventSchema.safeParse(raw);
				if (result.success) {
					events.push(result.data);
				} else {
					errors++;
				}
			} catch {
				errors++;
			}
		}

		return { events, errors };
	}

	/**
	 * Execute fn while holding an advisory lock file.
	 * Uses O_EXCL to atomically create a .lock file.
	 * Writes structured metadata (pid, hostname, token, created_at_ms) for
	 * ownership-safe stale detection and unlock.
	 * Spins with short delay on contention.
	 * Only reclaims locks that are stale (holder dead or age > threshold).
	 */
	private withLock(lockPath: string, fn: () => void): void {
		const token = randomUUID();
		let fd: number | null = null;
		let acquired = false;

		for (let attempt = 0; attempt < LOCK_MAX_RETRIES; attempt++) {
			try {
				fd = lockIO.openLock(lockPath);
				acquired = true;
				break;
			} catch (err: unknown) {
				const code = (err as NodeJS.ErrnoException).code;
				if (code === "EEXIST") {
					// Check if lock is stale before continuing to spin
					if (lockIO.isStale(lockPath, LOCK_STALE_THRESHOLD_MS)) {
						try {
							lockIO.unlinkLock(lockPath);
						} catch {
							// Another process beat us — retry loop will handle it
						}
						continue;
					}
					lockIO.sleep(LOCK_RETRY_DELAY_MS);
					continue;
				}
				throw err;
			}
		}

		if (!acquired) {
			// Final stale check — only reclaim if definitively stale
			if (lockIO.isStale(lockPath, LOCK_STALE_THRESHOLD_MS)) {
				// Bounded retry: another process may recreate the lock between
				// our unlink and open, causing an EEXIST race.
				const FINAL_RECLAIM_ATTEMPTS = 3;
				let reclaimSuccess = false;
				for (let r = 0; r < FINAL_RECLAIM_ATTEMPTS; r++) {
					try {
						lockIO.unlinkLock(lockPath);
					} catch {
						// Already removed by another process
					}
					try {
						fd = lockIO.openLock(lockPath);
						reclaimSuccess = true;
						break;
					} catch (reclaimErr: unknown) {
						if (
							(reclaimErr as NodeJS.ErrnoException).code !==
							"EEXIST"
						) {
							throw reclaimErr;
						}
						lockIO.sleep(LOCK_RETRY_DELAY_MS);
					}
				}
				if (!reclaimSuccess) {
					throw new Error(
						`Failed to acquire lock ${lockPath} after final reclaim (contention during stale recovery)`,
					);
				}
			} else {
				throw new Error(
					`Failed to acquire lock ${lockPath} after ${LOCK_MAX_RETRIES} retries (lock held by active process)`,
				);
			}
		}

		// Write structured ownership metadata
		if (fd !== null) {
			const meta: LockMetadata = {
				pid: process.pid,
				hostname: LOCK_HOSTNAME,
				token,
				created_at_ms: Date.now(),
			};
			try {
				writeFileSync(fd, JSON.stringify(meta));
			} catch {
				// Best-effort — lock is already held via O_EXCL
			}
		}

		try {
			fn();
		} finally {
			if (fd !== null) {
				closeSync(fd);
			}
			// Safe unlock: only remove if we still own the lock
			try {
				const currentMeta = readLockMetadata(lockPath);
				if (
					currentMeta &&
					currentMeta.pid === process.pid &&
					currentMeta.token === token
				) {
					unlinkSync(lockPath);
				}
			} catch {
				// Already removed or inaccessible
			}
		}
	}
}

/** Synchronous sleep using Atomics.wait on a SharedArrayBuffer. */
function sleepSync(ms: number): void {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Structured lock file metadata for ownership-safe locking. */
interface LockMetadata {
	pid: number;
	hostname: string;
	token: string;
	created_at_ms: number;
}

/** Read and parse structured metadata from a lock file. Returns null on any failure. */
function readLockMetadata(lockPath: string): LockMetadata | null {
	try {
		const content = readFileSync(lockPath, "utf-8");
		const parsed = JSON.parse(content);
		if (
			typeof parsed.pid === "number" &&
			typeof parsed.hostname === "string" &&
			typeof parsed.token === "string" &&
			typeof parsed.created_at_ms === "number"
		) {
			return parsed as LockMetadata;
		}
		return null;
	} catch {
		return null;
	}
}

/** Check if a process is alive by sending signal 0. */
function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (err: unknown) {
		// ESRCH = no such process; EPERM = exists but not ours (still alive)
		return (err as NodeJS.ErrnoException).code !== "ESRCH";
	}
}

/**
 * Returns true if the lock is stale (holder dead or age exceeds threshold).
 * - Reads structured metadata when available (pid, hostname, token, created_at_ms).
 * - Falls back to mtime if metadata is corrupt or missing.
 * - Same-host: checks PID liveness; dead holder ⇒ immediately stale.
 * - Cross-host: age check only (cannot verify PID across machines).
 */
function isLockStale(lockPath: string, thresholdMs: number): boolean {
	const meta = readLockMetadata(lockPath);
	if (!meta) {
		// Corrupt or unreadable metadata — fall back to mtime-based check
		try {
			const stat = statSync(lockPath);
			return Date.now() - stat.mtimeMs > thresholdMs;
		} catch {
			// File doesn't exist or stat failed — not stale, just gone
			return false;
		}
	}

	// Same-host: check if the holder process is still alive
	if (meta.hostname === LOCK_HOSTNAME) {
		if (!isProcessAlive(meta.pid)) {
			return true; // Holder is dead — stale regardless of age
		}
	}

	// Guard against future timestamps (clock skew or tampered metadata).
	// If created_at_ms is more than LOCK_FUTURE_SKEW_MS in the future,
	// the metadata is untrustworthy — fall back to mtime.
	if (meta.created_at_ms > Date.now() + LOCK_FUTURE_SKEW_MS) {
		try {
			const stat = statSync(lockPath);
			return Date.now() - stat.mtimeMs > thresholdMs;
		} catch {
			return false;
		}
	}

	// Age-based fallback (handles cross-host and alive-but-stuck processes)
	return Date.now() - meta.created_at_ms > thresholdMs;
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
