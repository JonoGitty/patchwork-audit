#!/usr/bin/env node
/**
 * Minimal witness writer for multi-process contention testing.
 * Reimplements the witness lock protocol from witness.ts using only Node.js built-ins.
 *
 * Usage:
 *   node _witness-lock-worker.mjs --witness-path <p> --record-json <json>
 *                                  [--hold-ms <n>] [--max-retries <n>]
 *
 * Exits 0 on success (record appended), 1 on failure (error on stderr).
 */

import {
	openSync,
	writeFileSync,
	closeSync,
	appendFileSync,
	unlinkSync,
	readFileSync,
	statSync,
} from "node:fs";
import { hostname } from "node:os";

const STALE_THRESHOLD_MS = 5_000;
const BASE_DELAY_MS = 10;

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------
const argMap = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
	argMap.set(process.argv[i], process.argv[i + 1]);
}

const witnessPath = argMap.get("--witness-path");
const recordJson = argMap.get("--record-json");
const holdMs = parseInt(argMap.get("--hold-ms") ?? "0", 10);
const maxRetries = parseInt(argMap.get("--max-retries") ?? "20", 10);

// ---------------------------------------------------------------------------
// Lock helpers — mirrors witness.ts protocol exactly
// ---------------------------------------------------------------------------

function sleepSync(ms) {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isLockStale(lockPath) {
	try {
		const content = readFileSync(lockPath, "utf-8");
		const meta = JSON.parse(content);

		if (meta.created_at_ms > Date.now() + 60_000) {
			return isStaleByMtime(lockPath);
		}

		const age = Date.now() - meta.created_at_ms;

		if (meta.hostname === hostname()) {
			try {
				process.kill(meta.pid, 0);
				return age > STALE_THRESHOLD_MS;
			} catch {
				return true; // dead process
			}
		}

		return age > STALE_THRESHOLD_MS;
	} catch {
		return isStaleByMtime(lockPath);
	}
}

function isStaleByMtime(lockPath) {
	try {
		const stat = statSync(lockPath);
		return Date.now() - stat.mtimeMs > STALE_THRESHOLD_MS;
	} catch {
		return true;
	}
}

function withLock(filePath, fn) {
	const lockPath = filePath + ".lock";
	let fd = null;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			fd = openSync(lockPath, "wx");
			writeFileSync(fd, JSON.stringify({
				pid: process.pid,
				hostname: hostname(),
				created_at_ms: Date.now(),
			}));
			break;
		} catch (err) {
			if (err.code !== "EEXIST") throw err;
			fd = null;

			if (isLockStale(lockPath)) {
				try { unlinkSync(lockPath); continue; } catch { /* race */ }
			}

			if (attempt === maxRetries) {
				throw new Error("Witness lock contention: max retries exceeded");
			}

			const delay = Math.min(BASE_DELAY_MS * (2 ** attempt), 200);
			sleepSync(delay);
		}
	}

	try {
		fn();
	} finally {
		if (fd !== null) try { closeSync(fd); } catch { /* ignore */ }
		try { unlinkSync(lockPath); } catch { /* ignore */ }
	}
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

try {
	withLock(witnessPath, () => {
		if (holdMs > 0) sleepSync(holdMs);
		appendFileSync(witnessPath, recordJson + "\n", "utf-8");
	});

	process.stdout.write(JSON.stringify({ ok: true, pid: process.pid }) + "\n");
	process.exit(0);
} catch (err) {
	process.stderr.write(err.message + "\n");
	process.exit(1);
}
