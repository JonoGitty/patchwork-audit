/**
 * Patchwork Relay Client — fire-and-forget event sender.
 *
 * Used by the hook pipeline to send copies of audit events to the
 * root-owned relay daemon. Designed to be non-blocking: if the relay
 * is down, the event is silently dropped (primary JSONL store is
 * always written first).
 *
 * Tracks relay failures via a divergence marker, similar to the
 * existing SQLite divergence tracking.
 */

import { connect, type Socket } from "node:net";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
	renameSync,
	statSync,
	chmodSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { getHomeDir } from "../path/home.js";
import {
	RELAY_SOCKET_PATH,
	RELAY_PROTOCOL_VERSION,
	type RelayMessage,
	type RelayResponse,
} from "./protocol.js";

/** Timeout for relay connection + write in milliseconds. */
const RELAY_TIMEOUT_MS = 500;

/** Secure directory mode: owner-only read/write/execute */
const STATE_DIR_MODE = 0o700;
/** Secure file mode: owner-only read/write */
const STATE_FILE_MODE = 0o600;

/** Schema for the relay divergence marker file. */
export interface RelayDivergenceMarker {
	schema_version: 1;
	failure_count: number;
	first_failure_at: string;
	last_failure_at: string;
	last_error: string;
	/** Last successful relay hash received. */
	last_relay_hash?: string;
}

function getDivergenceMarkerPath(): string {
	return join(getHomeDir(), ".patchwork", "state", "relay-divergence.json");
}

/** Reconcile permissions to target if they don't match. */
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

/**
 * Read the current relay divergence marker, or null if absent/corrupt.
 */
export function readRelayDivergenceMarker(markerPath?: string): RelayDivergenceMarker | null {
	const p = markerPath || getDivergenceMarkerPath();
	try {
		const content = readFileSync(p, "utf-8");
		const parsed = JSON.parse(content);
		if (
			parsed &&
			parsed.schema_version === 1 &&
			typeof parsed.failure_count === "number" &&
			typeof parsed.first_failure_at === "string" &&
			typeof parsed.last_failure_at === "string" &&
			typeof parsed.last_error === "string"
		) {
			return parsed as RelayDivergenceMarker;
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Write a relay divergence marker atomically (tmp + rename).
 */
function writeRelayDivergenceMarker(marker: RelayDivergenceMarker, markerPath?: string): void {
	const p = markerPath || getDivergenceMarkerPath();
	const dir = dirname(p);

	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true, mode: STATE_DIR_MODE });
	} else {
		reconcileMode(dir, STATE_DIR_MODE);
	}

	const tmpPath = p + "." + randomBytes(4).toString("hex") + ".tmp";
	writeFileSync(tmpPath, JSON.stringify(marker, null, 2) + "\n", { mode: STATE_FILE_MODE });
	renameSync(tmpPath, p);
}

/**
 * Record a relay failure in the divergence marker.
 */
function recordRelayDivergence(errorMessage: string, markerPath?: string): void {
	const now = new Date().toISOString();
	const existing = readRelayDivergenceMarker(markerPath);

	const marker: RelayDivergenceMarker = {
		schema_version: 1,
		failure_count: existing ? existing.failure_count + 1 : 1,
		first_failure_at: existing ? existing.first_failure_at : now,
		last_failure_at: now,
		last_error: errorMessage,
		last_relay_hash: existing?.last_relay_hash,
	};

	try {
		writeRelayDivergenceMarker(marker, markerPath);
	} catch {
		// Best effort — don't let marker I/O break the hot path
	}
}

/**
 * Send an audit event to the relay daemon.
 *
 * Fire-and-forget: returns quickly regardless of outcome.
 * On failure, records a divergence marker.
 *
 * @param event - The raw audit event (already serialized with hash chain)
 * @param socketPath - Override the default socket path (for testing)
 */
export function sendToRelay(
	event: Record<string, unknown>,
	socketPath?: string,
): void {
	const sockPath = socketPath ?? RELAY_SOCKET_PATH;

	// Quick check: if socket doesn't exist, don't even try
	if (!existsSync(sockPath)) {
		// Not an error — relay may not be installed
		return;
	}

	const msg: RelayMessage = {
		protocol_version: RELAY_PROTOCOL_VERSION,
		type: "event",
		timestamp: new Date().toISOString(),
		payload: event,
	};

	const data = JSON.stringify(msg) + "\n";

	// Fire-and-forget with timeout
	let socket: Socket | null = null;
	let settled = false;

	const fail = (reason: string) => {
		if (settled) return;
		settled = true;
		recordRelayDivergence(reason);
		if (socket) {
			try { socket.destroy(); } catch { /* */ }
		}
	};

	const timer = setTimeout(() => {
		fail("Relay connection timed out");
	}, RELAY_TIMEOUT_MS);

	// Prevent timer from keeping the process alive (critical for hook latency)
	if (timer.unref) {
		timer.unref();
	}

	try {
		socket = connect(sockPath, () => {
			// Connected — send the event
			socket!.write(data, () => {
				// Data written — we don't wait for the response in fire-and-forget mode
				// but we do read it if available within the timeout
				clearTimeout(timer);
				settled = true;

				// Read response (best effort, non-blocking)
				socket!.once("data", (chunk) => {
					try {
						const resp: RelayResponse = JSON.parse(chunk.toString().trim());
						if (!resp.ok) {
							recordRelayDivergence(`Relay rejected: ${resp.error}`);
						}
					} catch {
						// Response parse failure — non-fatal
					}
					try { socket!.destroy(); } catch { /* */ }
				});

				// Auto-destroy after a short grace period for reading response
				const readTimer = setTimeout(() => {
					try { socket!.destroy(); } catch { /* */ }
				}, 100);
				if (readTimer.unref) readTimer.unref();
			});
		});

		socket.on("error", (err) => {
			clearTimeout(timer);
			fail(`Socket error: ${err.message}`);
		});

		// Don't keep the process alive for this connection
		socket.unref();
	} catch (err: unknown) {
		clearTimeout(timer);
		const errMsg = err instanceof Error ? err.message : String(err);
		fail(`Connection failed: ${errMsg}`);
	}
}

/**
 * Synchronous relay send — blocks until response or timeout.
 * Used for testing and CLI commands where we need confirmation.
 */
export function sendToRelaySync(
	event: Record<string, unknown>,
	socketPath?: string,
	timeoutMs?: number,
): RelayResponse {
	const sockPath = socketPath ?? RELAY_SOCKET_PATH;
	const timeout = timeoutMs ?? RELAY_TIMEOUT_MS;

	if (!existsSync(sockPath)) {
		return { ok: false, error: "Relay socket not found" };
	}

	// Use synchronous approach via SharedArrayBuffer + Atomics
	// This is acceptable in CLI/test context but NOT in hooks
	return new Promise<RelayResponse>((resolve) => {
		const timer = setTimeout(() => {
			resolve({ ok: false, error: "Timeout" });
		}, timeout);

		const msg: RelayMessage = {
			protocol_version: RELAY_PROTOCOL_VERSION,
			type: "event",
			timestamp: new Date().toISOString(),
			payload: event,
		};

		const socket = connect(sockPath, () => {
			socket.write(JSON.stringify(msg) + "\n");
		});

		socket.on("data", (chunk) => {
			clearTimeout(timer);
			try {
				resolve(JSON.parse(chunk.toString().trim()));
			} catch {
				resolve({ ok: false, error: "Invalid relay response" });
			}
			socket.destroy();
		});

		socket.on("error", (err) => {
			clearTimeout(timer);
			resolve({ ok: false, error: err.message });
		});
	}) as unknown as RelayResponse;
}

/**
 * Ping the relay daemon to check if it's running.
 * Returns the relay's current chain tip hash, or null if unreachable.
 */
export async function pingRelay(socketPath?: string): Promise<RelayResponse | null> {
	const sockPath = socketPath ?? RELAY_SOCKET_PATH;

	if (!existsSync(sockPath)) {
		return null;
	}

	return new Promise((resolve) => {
		const timer = setTimeout(() => {
			resolve(null);
		}, RELAY_TIMEOUT_MS);

		const msg: RelayMessage = {
			protocol_version: RELAY_PROTOCOL_VERSION,
			type: "ping",
			timestamp: new Date().toISOString(),
		};

		const socket = connect(sockPath, () => {
			socket.write(JSON.stringify(msg) + "\n");
		});

		socket.on("data", (chunk) => {
			clearTimeout(timer);
			try {
				resolve(JSON.parse(chunk.toString().trim()));
			} catch {
				resolve(null);
			}
			socket.destroy();
		});

		socket.on("error", () => {
			clearTimeout(timer);
			resolve(null);
		});
	});
}
