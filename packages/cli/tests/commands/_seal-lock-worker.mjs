#!/usr/bin/env node
/**
 * Minimal seal writer for multi-process contention testing.
 * Reimplements the seal lock protocol from seal.ts using only Node.js built-ins.
 *
 * Usage:
 *   node _seal-lock-worker.mjs --seal-path <p> --events-path <p> --key-path <p>
 *                               [--hold-ms <n>] [--max-retries <n>]
 *
 * Exits 0 on success (seal appended), 1 on failure (error on stderr).
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
import { createHmac } from "node:crypto";

const STALE_THRESHOLD_MS = 5_000;
const BASE_DELAY_MS = 10;

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------
const argMap = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
	argMap.set(process.argv[i], process.argv[i + 1]);
}

const sealPath = argMap.get("--seal-path");
const eventsPath = argMap.get("--events-path");
const keyPath = argMap.get("--key-path");
const holdMs = parseInt(argMap.get("--hold-ms") ?? "0", 10);
const maxRetries = parseInt(argMap.get("--max-retries") ?? "20", 10);

// ---------------------------------------------------------------------------
// Lock helpers — mirrors seal.ts protocol exactly
// ---------------------------------------------------------------------------

function sleepSync(ms) {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isLockStale(lockPath) {
	try {
		const content = readFileSync(lockPath, "utf-8");
		const meta = JSON.parse(content);

		if (meta.created_at_ms > Date.now() + 60_000) {
			return isStalByMtime(lockPath);
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
		return isStalByMtime(lockPath);
	}
}

function isStalByMtime(lockPath) {
	try {
		const stat = statSync(lockPath);
		return Date.now() - stat.mtimeMs > STALE_THRESHOLD_MS;
	} catch {
		return true;
	}
}

function withLock(sealFilePath, fn) {
	const lockPath = sealFilePath + ".lock";
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
				throw new Error("Seal lock contention: max retries exceeded");
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
	// Read events → find tip hash and chained count
	const eventsContent = readFileSync(eventsPath, "utf-8");
	const eventLines = eventsContent.split("\n").filter((l) => l.trim());
	let tipHash = null;
	let chainedEvents = 0;

	for (let i = eventLines.length - 1; i >= 0; i--) {
		const evt = JSON.parse(eventLines[i]);
		if (typeof evt.event_hash === "string") {
			if (tipHash === null) tipHash = evt.event_hash;
			chainedEvents++;
		}
	}

	if (!tipHash) {
		process.stderr.write("No chained events found\n");
		process.exit(1);
	}

	// Read key
	const key = readFileSync(keyPath);

	// Compute seal record (same format as seal.ts)
	const sealedAt = new Date().toISOString();
	const payload = `patchwork-seal:v1:${tipHash}:${chainedEvents}:${sealedAt}`;
	const hmac = createHmac("sha256", key).update(payload).digest("hex");
	const signature = `hmac-sha256:${hmac}`;

	const seal = {
		sealed_at: sealedAt,
		tip_hash: tipHash,
		chained_events: chainedEvents,
		signature,
	};

	withLock(sealPath, () => {
		if (holdMs > 0) sleepSync(holdMs);
		appendFileSync(sealPath, JSON.stringify(seal) + "\n", "utf-8");
	});

	process.stdout.write(JSON.stringify({ ok: true, pid: process.pid }) + "\n");
	process.exit(0);
} catch (err) {
	process.stderr.write(err.message + "\n");
	process.exit(1);
}
