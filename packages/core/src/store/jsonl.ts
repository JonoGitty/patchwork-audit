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
import { AuditEventSchema } from "../schema/event.js";
import type { AuditEvent } from "../schema/event.js";
import type { EventFilter, Store } from "./types.js";

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

		const line = JSON.stringify(event) + "\n";
		const lockPath = this.filePath + ".lock";

		this.withLock(lockPath, () => {
			// Dedup by idempotency_key INSIDE the lock to prevent TOCTOU races
			if (event.idempotency_key) {
				const existing = this.readAllRaw();
				if (existing.some((e) => e.idempotency_key === event.idempotency_key)) {
					return; // Already recorded — skip silently
				}
			}

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

	/** Read raw parsed objects without validation (used for dedup checks). */
	private readAllRaw(): AuditEvent[] {
		if (!existsSync(this.filePath)) {
			return [];
		}
		const content = readFileSync(this.filePath, "utf-8");
		return content
			.split("\n")
			.filter((line) => line.trim().length > 0)
			.map((line) => {
				try {
					return JSON.parse(line) as AuditEvent;
				} catch {
					return null;
				}
			})
			.filter((e): e is AuditEvent => e !== null);
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
		const token =
			Math.random().toString(36).slice(2) +
			Math.random().toString(36).slice(2);
		let fd: number | null = null;
		let acquired = false;

		for (let attempt = 0; attempt < LOCK_MAX_RETRIES; attempt++) {
			try {
				fd = openSync(lockPath, "wx");
				acquired = true;
				break;
			} catch (err: unknown) {
				const code = (err as NodeJS.ErrnoException).code;
				if (code === "EEXIST") {
					// Check if lock is stale before continuing to spin
					if (isLockStale(lockPath, LOCK_STALE_THRESHOLD_MS)) {
						try {
							unlinkSync(lockPath);
						} catch {
							// Another process beat us — retry loop will handle it
						}
						continue;
					}
					sleepSync(LOCK_RETRY_DELAY_MS);
					continue;
				}
				throw err;
			}
		}

		if (!acquired) {
			// Final stale check — only reclaim if definitively stale
			if (isLockStale(lockPath, LOCK_STALE_THRESHOLD_MS)) {
				try {
					unlinkSync(lockPath);
				} catch {
					// Already removed
				}
				fd = openSync(lockPath, "wx");
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
