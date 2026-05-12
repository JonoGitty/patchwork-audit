/**
 * Per-session taint snapshot storage (v0.6.11 commit 7).
 *
 * Persists `TaintSnapshot` records produced by the PostToolUse handler
 * so the PreToolUse sink classifier (commit 8) can read the active set
 * for an enforcement decision. One file per session lives at
 * `~/.patchwork/taint/<session_id>.json`, mode 0600, dir 0700, written
 * atomically via tmp + rename. The on-disk schema is the existing
 * `TaintSnapshotSchema` from `@patchwork/core` — this module only adds
 * the I/O layer.
 *
 * Storage choice rationale (decided 2026-05-10):
 *   - One JSON file per session matches the existing per-file pattern
 *     used by commit-attestations and the SQLite divergence marker —
 *     trivially inspectable via `cat`, no new dep, no schema migrations.
 *   - JSONL append-log was rejected: a replay parser is extra surface
 *     and the snapshot only ever needs the latest state.
 *   - SQLite was rejected: heavier than needed for a per-session blob
 *     that is rarely re-read and never queried.
 *
 * Failure semantics — source fail-open, sink fail-closed:
 *   - Writers (PostToolUse) wrap `writeTaintSnapshot` in try/catch and
 *     continue on any error. A bug in the source path only ever fails
 *     to *record* taint, never to enforce it.
 *   - Readers (PreToolUse, commit 8) MUST treat a `null` return from
 *     `readTaintSnapshot` as "all taint kinds active" and force the
 *     approval-required path. Missing file, corrupt JSON, and
 *     schema-invalid content all collapse to the same `null` — so a
 *     storage bug forces *more* approvals, never fewer. This preserves
 *     the security property of the enforcement layer even if the
 *     source layer is broken.
 */

import {
	type TaintSnapshot,
	TaintSnapshotSchema,
	createSnapshot,
	getHomeDir,
} from "@patchwork/core";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	openSync,
	closeSync,
	readFileSync,
	renameSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { dirname, join } from "node:path";

/** Owner-only read/write/execute on the taint directory. */
const TAINT_DIR_MODE = 0o700;
/** Owner-only read/write on a snapshot file. */
const TAINT_FILE_MODE = 0o600;

/**
 * Derive a filesystem-safe filename from a session id.
 *
 * Previously a character-class sanitizer (`[^A-Za-z0-9_-] → _`) — that
 * was R1-007: two distinct session ids `"a/b"` and `"a_b"` collided to
 * the same path, enabling cross-session taint contamination. The fix
 * is sha256, which is injective on inputs and gives no information
 * leakage either way. The original session id is also written *inside*
 * the snapshot and verified on read, so even a sha256 collision (which
 * is computationally infeasible) would be detected at the schema layer.
 */
function sessionIdToFilenameStem(sessionId: string): string {
	return createHash("sha256").update(sessionId).digest("hex");
}

export function getTaintDir(): string {
	return join(getHomeDir(), ".patchwork", "taint");
}

export function getTaintSnapshotPath(sessionId: string): string {
	return join(getTaintDir(), `${sessionIdToFilenameStem(sessionId)}.json`);
}

/**
 * Path of the "pending" marker file (R1-002). PostToolUse touches this
 * before mutating the snapshot and removes it after a successful write.
 * If a reader sees the marker AND the snapshot, the snapshot is
 * potentially stale-after-failure and must be treated as suspect — the
 * reader collapses to the `null` (fail-closed) semantic.
 */
export function getTaintPendingPath(sessionId: string): string {
	return join(
		getTaintDir(),
		`${sessionIdToFilenameStem(sessionId)}.pending`,
	);
}

/**
 * Path of the session lock file (R1-003). Acquired O_EXCL-style with a
 * retry loop so two concurrent PostToolUse handlers serialize their
 * read-modify-write cycles. Releasing is a simple unlink; stale locks
 * are reclaimed after a 30s grace window.
 */
function getTaintLockPath(sessionId: string): string {
	return join(getTaintDir(), `${sessionIdToFilenameStem(sessionId)}.lock`);
}

function reconcileMode(path: string, targetMode: number): void {
	try {
		const stat = statSync(path);
		if ((stat.mode & 0o777) !== targetMode) {
			chmodSync(path, targetMode);
		}
	} catch {
		// Path vanished between stat and chmod — safe to ignore.
	}
}

/**
 * Read the persisted snapshot for `sessionId`. Returns `null` for any
 * state the reader can't trust:
 *   - missing file                                      (fresh session)
 *   - parse failure / schema invalid                    (corrupt)
 *   - `.pending` marker present alongside the snapshot  (R1-002 stale)
 *   - session_id inside the file ≠ the requested id     (R1-007 collision)
 *
 * Per the sink-fail-closed contract, commit 8 collapses every `null` to
 * "all kinds active." So every form of doubt routes through the same
 * conservative path.
 */
export function readTaintSnapshot(
	sessionId: string,
	overridePath?: string,
): TaintSnapshot | null {
	const p = overridePath ?? getTaintSnapshotPath(sessionId);
	const pendingPath = overridePath
		? `${overridePath}.pending`
		: getTaintPendingPath(sessionId);
	try {
		// R1-002: a stale snapshot after a failed PostToolUse write looks
		// indistinguishable from a current one without an external signal.
		// The `.pending` marker IS that signal: PostToolUse touches it
		// before mutating and removes it after success. Reader seeing
		// both files collapses to null → fail-closed.
		if (existsSync(pendingPath) && existsSync(p)) {
			return null;
		}
		const raw = readFileSync(p, "utf-8");
		const parsed = JSON.parse(raw);
		const result = TaintSnapshotSchema.safeParse(parsed);
		if (!result.success) return null;
		// R1-007 follow-through: the session_id INSIDE the file must
		// match the requested id. Catches both sha256 collisions (none
		// expected, but free) and the case where a write to one
		// session's path stamps another id (shouldn't happen but is
		// cheap to detect).
		if (result.data.session_id !== sessionId && overridePath === undefined) {
			return null;
		}
		return result.data;
	} catch {
		return null;
	}
}

/**
 * Persist `snapshot` atomically. Ensures the parent directory exists
 * with 0700 perms and the file is written 0600 via tmp + rename.
 *
 * Throws on I/O failure. PostToolUse callers MUST wrap this in a
 * try/catch so the hook pipeline survives any storage breakage.
 */
export function writeTaintSnapshot(
	snapshot: TaintSnapshot,
	overridePath?: string,
): void {
	const p =
		overridePath ?? getTaintSnapshotPath(snapshot.session_id);
	const dir = dirname(p);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true, mode: TAINT_DIR_MODE });
	} else {
		reconcileMode(dir, TAINT_DIR_MODE);
	}
	const tmpPath = `${p}.${randomBytes(4).toString("hex")}.tmp`;
	writeFileSync(tmpPath, JSON.stringify(snapshot, null, 2) + "\n", {
		mode: TAINT_FILE_MODE,
	});
	renameSync(tmpPath, p);
}

/** Grace window after which a lockfile is considered stale and may be
 *  reclaimed. PostToolUse RMW is a handful of fs ops, so 30s is far
 *  beyond any legitimate hold time — anything older was a crashed
 *  writer that never released its lock. */
const LOCK_STALE_MS = 30_000;

/**
 * Acquire an exclusive per-session lock and run `fn` while holding it
 * (R1-003 — partial fix). Without this, two concurrent PostToolUse
 * handlers for the same session can both read the same base snapshot,
 * fold in different taint sources, and the last rename wins — silently
 * dropping the other update.
 *
 * Lock = sibling file created via `openSync(.., "wx")`. **Single
 * attempt**: if the lock is held by another writer we throw
 * immediately. We DO NOT busy-spin — that monopolized the event loop
 * during testing. The PostToolUse caller's fail-open try/catch
 * swallows the throw and leaves the `.pending` marker behind, which
 * routes the next PreToolUse through the fail-closed path. So
 * contention naturally degrades into "one writer wins, the other's
 * effects are conservatively assumed via fail-closed."
 *
 * A lockfile older than `LOCK_STALE_MS` is reclaimed once (crashed
 * writer). Release is `unlink` in the `finally` block.
 *
 * `fn` throws → lock is still released.
 */
export function withSessionLock<T>(
	sessionId: string,
	fn: () => T,
	overrideLockPath?: string,
): T {
	const lockPath = overrideLockPath ?? getTaintLockPath(sessionId);
	const dir = dirname(lockPath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true, mode: TAINT_DIR_MODE });
	}

	let fd: number;
	try {
		fd = openSync(lockPath, "wx", TAINT_FILE_MODE);
	} catch (err: unknown) {
		// EEXIST: another writer holds the lock. Reclaim if stale, else throw.
		const e = err as NodeJS.ErrnoException;
		if (e.code === "EEXIST") {
			try {
				const st = statSync(lockPath);
				if (Date.now() - st.mtimeMs > LOCK_STALE_MS) {
					try {
						unlinkSync(lockPath);
					} catch {
						// Another writer just reclaimed it — give up
					}
					try {
						fd = openSync(lockPath, "wx", TAINT_FILE_MODE);
					} catch {
						throw new Error(
							`taint-store: lock at ${lockPath} contended after stale reclaim`,
						);
					}
				} else {
					throw new Error(
						`taint-store: lock at ${lockPath} held by another writer`,
					);
				}
			} catch (reclaimErr) {
				// Stat failed (lock vanished) or reclaim failed — let the
				// caller's fail-open path handle it.
				if (reclaimErr instanceof Error && reclaimErr.message.startsWith("taint-store:")) {
					throw reclaimErr;
				}
				throw new Error(
					`taint-store: lock at ${lockPath} not acquirable (${(reclaimErr as Error).message})`,
				);
			}
		} else {
			throw err;
		}
	}

	try {
		return fn();
	} finally {
		try {
			closeSync(fd);
		} catch {
			// fd already closed — ignore
		}
		try {
			unlinkSync(lockPath);
		} catch {
			// already gone — ignore
		}
	}
}

/**
 * Mark the session's snapshot file as "about to be mutated" by creating
 * the `.pending` sibling. The PostToolUse RMW calls this before writing
 * and `clearPendingMarker` after a successful write. The reader uses
 * the presence of `.pending` alongside the snapshot file as a signal
 * that the write may have crashed mid-flight and the snapshot is stale.
 * See `readTaintSnapshot` for the reader side (R1-002).
 */
export function setPendingMarker(
	sessionId: string,
	overridePath?: string,
): void {
	const p = overridePath ?? getTaintPendingPath(sessionId);
	const dir = dirname(p);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true, mode: TAINT_DIR_MODE });
	}
	// Best-effort; pending-marker absence is just a slightly more
	// trusting reader, not a security regression on its own.
	try {
		writeFileSync(p, "", { mode: TAINT_FILE_MODE });
	} catch {
		// ignore
	}
}

export function clearPendingMarker(
	sessionId: string,
	overridePath?: string,
): void {
	const p = overridePath ?? getTaintPendingPath(sessionId);
	try {
		unlinkSync(p);
	} catch {
		// already gone — ignore
	}
}

/**
 * Load the persisted snapshot for `sessionId` or fall back to an empty
 * one. Used by PostToolUse before folding new sources in. A missing or
 * corrupt file at this layer is silently re-initialized — the
 * fail-closed contract is held at the *reader* boundary in commit 8,
 * not here.
 */
export function loadOrInitSnapshot(
	sessionId: string,
	overridePath?: string,
): TaintSnapshot {
	const existing = readTaintSnapshot(sessionId, overridePath);
	if (existing) return existing;
	return createSnapshot(sessionId);
}
