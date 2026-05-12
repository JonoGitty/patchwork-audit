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
	readFileSync,
	renameSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";

/** Owner-only read/write/execute on the taint directory. */
const TAINT_DIR_MODE = 0o700;
/** Owner-only read/write on a snapshot file. */
const TAINT_FILE_MODE = 0o600;

/**
 * Sanitize a session id so it can be used as a filename without escape
 * games. Anything outside `[A-Za-z0-9_-]` is collapsed to `_`. The
 * sanitizer is one-way (collisions are possible in theory) but session
 * ids are already opaque high-entropy strings — collisions in practice
 * would require a hostile session id, which is itself an upstream
 * problem.
 */
function sanitizeSessionId(sessionId: string): string {
	return sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function getTaintDir(): string {
	return join(getHomeDir(), ".patchwork", "taint");
}

export function getTaintSnapshotPath(sessionId: string): string {
	return join(getTaintDir(), `${sanitizeSessionId(sessionId)}.json`);
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
 * unreadable state: missing file, parse failure, or schema mismatch.
 *
 * Per the sink-fail-closed contract (see file header), commit 8 must
 * treat this `null` as "all kinds active" and force approval.
 */
export function readTaintSnapshot(
	sessionId: string,
	overridePath?: string,
): TaintSnapshot | null {
	const p = overridePath ?? getTaintSnapshotPath(sessionId);
	try {
		const raw = readFileSync(p, "utf-8");
		const parsed = JSON.parse(raw);
		const result = TaintSnapshotSchema.safeParse(parsed);
		return result.success ? result.data : null;
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
