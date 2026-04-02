/**
 * Patchwork Relay Daemon — root-owned audit event receiver.
 *
 * Layer 2 of the tamper-proof architecture. Runs as root via launchd.
 * Listens on a Unix domain socket, validates incoming audit events,
 * and writes them to an append-only log that user-level processes
 * cannot modify.
 *
 * Security model:
 * - Socket: root:wheel, mode 0777 (any user can connect and send)
 * - Log file: root:wheel, mode 0644 (anyone can read, only root can write)
 * - PID file: root:wheel, mode 0644
 * - Daemon process: runs as root
 */

import { createServer, type Server, type Socket } from "node:net";
import {
	appendFileSync,
	chmodSync,
	chownSync,
	existsSync,
	mkdirSync,
	readFileSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { AuditEventSchema } from "../schema/event.js";
import { computeEventHash } from "../hash/chain.js";
import {
	RELAY_SOCKET_PATH,
	RELAY_LOG_PATH,
	RELAY_DAEMON_LOG_PATH,
	RELAY_PID_PATH,
	HEARTBEAT_INTERVAL_MS,
	MAX_MESSAGE_SIZE,
	RELAY_PROTOCOL_VERSION,
	type RelayMessage,
	type RelayResponse,
	type HeartbeatRecord,
} from "./protocol.js";

/** Relay daemon configuration. */
export interface RelayDaemonOptions {
	socketPath?: string;
	logPath?: string;
	daemonLogPath?: string;
	pidPath?: string;
	heartbeatIntervalMs?: number;
}

/** Relay daemon state — exposed for testing. */
export interface RelayDaemonState {
	eventCount: number;
	chainTip: string | null;
	startedAt: number;
	lastHeartbeat: number | null;
}

/**
 * The relay daemon. Call start() to begin listening.
 */
export class RelayDaemon {
	private server: Server | null = null;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private readonly socketPath: string;
	private readonly logPath: string;
	private readonly daemonLogPath: string;
	private readonly pidPath: string;
	private readonly heartbeatIntervalMs: number;

	/** Daemon state — public for testing. */
	readonly state: RelayDaemonState = {
		eventCount: 0,
		chainTip: null,
		startedAt: Date.now(),
		lastHeartbeat: null,
	};

	constructor(options: RelayDaemonOptions = {}) {
		this.socketPath = options.socketPath ?? RELAY_SOCKET_PATH;
		this.logPath = options.logPath ?? RELAY_LOG_PATH;
		this.daemonLogPath = options.daemonLogPath ?? RELAY_DAEMON_LOG_PATH;
		this.pidPath = options.pidPath ?? RELAY_PID_PATH;
		this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS;
	}

	/** Initialize the relay: recover chain state from existing log. */
	private init(): void {
		// Ensure log directory exists
		const logDir = dirname(this.logPath);
		if (!existsSync(logDir)) {
			mkdirSync(logDir, { recursive: true, mode: 0o755 });
		}

		// Recover chain tip from existing relay log
		if (existsSync(this.logPath)) {
			try {
				const content = readFileSync(this.logPath, "utf-8");
				const lines = content.split("\n").filter((l) => l.trim().length > 0);
				let count = 0;
				let tip: string | null = null;

				for (const line of lines) {
					try {
						const parsed = JSON.parse(line);
						if (parsed.type === "heartbeat") continue;
						if (typeof parsed._relay_hash === "string") {
							tip = parsed._relay_hash;
						}
						count++;
					} catch {
						// Skip corrupt lines
					}
				}

				this.state.eventCount = count;
				this.state.chainTip = tip;
				this.log(`Recovered chain state: ${count} events, tip=${tip?.slice(0, 20) ?? "null"}`);
			} catch {
				this.log("WARNING: Could not read existing relay log — starting fresh");
			}
		}
	}

	/** Start the relay daemon. */
	start(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.init();

			// Remove stale socket file
			if (existsSync(this.socketPath)) {
				try {
					unlinkSync(this.socketPath);
				} catch {
					reject(new Error(`Cannot remove stale socket at ${this.socketPath}`));
					return;
				}
			}

			this.server = createServer((socket) => this.handleConnection(socket));

			this.server.on("error", (err) => {
				this.log(`SERVER ERROR: ${err.message}`);
			});

			this.server.listen(this.socketPath, () => {
				// Make socket world-writable so any user can send events
				try {
					chmodSync(this.socketPath, 0o777);
				} catch {
					// May fail in non-root test environments
				}

				// Write PID file
				try {
					writeFileSync(this.pidPath, String(process.pid), { mode: 0o644 });
				} catch {
					// Non-fatal
				}

				this.log(`Relay daemon listening on ${this.socketPath} (pid=${process.pid})`);

				// Start heartbeat
				this.startHeartbeat();

				resolve();
			});
		});
	}

	/** Stop the relay daemon gracefully. */
	stop(): Promise<void> {
		return new Promise((resolve) => {
			if (this.heartbeatTimer) {
				clearInterval(this.heartbeatTimer);
				this.heartbeatTimer = null;
			}

			// Write final heartbeat
			this.writeHeartbeat();

			if (this.server) {
				this.server.close(() => {
					// Clean up socket and PID file
					try { unlinkSync(this.socketPath); } catch { /* */ }
					try { unlinkSync(this.pidPath); } catch { /* */ }
					this.log("Relay daemon stopped");
					resolve();
				});
			} else {
				resolve();
			}
		});
	}

	/** Handle an incoming client connection. */
	private handleConnection(socket: Socket): void {
		let buffer = "";

		socket.on("data", (chunk) => {
			buffer += chunk.toString();

			// Guard against oversized messages
			if (buffer.length > MAX_MESSAGE_SIZE) {
				const resp: RelayResponse = { ok: false, error: "Message too large" };
				socket.write(JSON.stringify(resp) + "\n");
				socket.destroy();
				return;
			}

			// Process complete lines (newline-delimited protocol)
			let newlineIdx: number;
			while ((newlineIdx = buffer.indexOf("\n")) >= 0) {
				const line = buffer.slice(0, newlineIdx);
				buffer = buffer.slice(newlineIdx + 1);

				if (line.trim().length === 0) continue;

				const response = this.processMessage(line);
				socket.write(JSON.stringify(response) + "\n");
			}
		});

		socket.on("error", () => {
			// Client disconnected — no action needed
		});
	}

	/** Process a single relay message. Returns a response. */
	processMessage(raw: string): RelayResponse {
		let msg: RelayMessage;
		try {
			msg = JSON.parse(raw);
		} catch {
			return { ok: false, error: "Invalid JSON" };
		}

		if (msg.protocol_version !== RELAY_PROTOCOL_VERSION) {
			return { ok: false, error: `Unsupported protocol version: ${msg.protocol_version}` };
		}

		switch (msg.type) {
			case "ping":
				return { ok: true, relay_hash: this.state.chainTip ?? undefined };

			case "event":
				return this.processEvent(msg);

			default:
				return { ok: false, error: `Unknown message type: ${msg.type}` };
		}
	}

	/** Validate and store an audit event. */
	private processEvent(msg: RelayMessage): RelayResponse {
		if (!msg.payload) {
			return { ok: false, error: "Missing event payload" };
		}

		// Validate against schema
		const parsed = AuditEventSchema.safeParse(msg.payload);
		if (!parsed.success) {
			const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
			this.log(`REJECTED: invalid schema — ${issues}`);
			return { ok: false, error: `Schema validation failed: ${issues}` };
		}

		// Verify the event's own hash chain integrity
		const eventHash = msg.payload.event_hash as string | undefined;
		if (eventHash) {
			const recomputed = computeEventHash(msg.payload);
			if (recomputed !== eventHash) {
				this.log(`REJECTED: hash mismatch — expected ${recomputed}, got ${eventHash}`);
				return { ok: false, error: "Event hash mismatch — possible tampering" };
			}
		}

		// Compute relay-side chain: re-chain the event into our own hash sequence
		const relayEvent = {
			...msg.payload,
			_relay: {
				received_at: new Date().toISOString(),
				relay_prev_hash: this.state.chainTip,
			},
		};
		const relayHash = computeEventHash(relayEvent);
		(relayEvent as Record<string, unknown>)._relay_hash = relayHash;

		// Append to root-owned log
		try {
			const line = JSON.stringify(relayEvent) + "\n";
			const isNew = !existsSync(this.logPath);
			appendFileSync(this.logPath, line, "utf-8");
			if (isNew) {
				try {
					chmodSync(this.logPath, 0o644);
					chownSync(this.logPath, 0, 0); // root:wheel
				} catch {
					// May fail in non-root test environments
				}
			}
		} catch (err: unknown) {
			const errMsg = err instanceof Error ? err.message : String(err);
			this.log(`WRITE ERROR: ${errMsg}`);
			return { ok: false, error: `Write failed: ${errMsg}` };
		}

		// Update state
		this.state.chainTip = relayHash;
		this.state.eventCount++;

		return { ok: true, relay_hash: relayHash };
	}

	/** Start the periodic heartbeat. */
	private startHeartbeat(): void {
		// Write initial heartbeat
		this.writeHeartbeat();

		this.heartbeatTimer = setInterval(() => {
			this.writeHeartbeat();
		}, this.heartbeatIntervalMs);

		// Don't keep the process alive just for heartbeat
		if (this.heartbeatTimer.unref) {
			this.heartbeatTimer.unref();
		}
	}

	/** Write a heartbeat record to the relay log. */
	private writeHeartbeat(): void {
		const record: HeartbeatRecord = {
			type: "heartbeat",
			timestamp: new Date().toISOString(),
			relay_chain_tip: this.state.chainTip,
			relay_event_count: this.state.eventCount,
			uptime_ms: Date.now() - this.state.startedAt,
		};

		try {
			appendFileSync(this.logPath, JSON.stringify(record) + "\n", "utf-8");
			this.state.lastHeartbeat = Date.now();
		} catch {
			// Best effort — heartbeat write failure is non-fatal
		}
	}

	/** Log to the daemon log file. */
	private log(message: string): void {
		const ts = new Date().toISOString();
		const line = `${ts} [relay] ${message}\n`;
		try {
			const logDir = dirname(this.daemonLogPath);
			if (!existsSync(logDir)) {
				mkdirSync(logDir, { recursive: true, mode: 0o755 });
			}
			appendFileSync(this.daemonLogPath, line, "utf-8");
		} catch {
			// Fall back to stderr if we can't write the log
			process.stderr.write(line);
		}
	}
}

/**
 * Entry point for running the relay daemon as a standalone process.
 * Called from the CLI or directly via launchd.
 */
export async function runRelayDaemon(options: RelayDaemonOptions = {}): Promise<RelayDaemon> {
	const daemon = new RelayDaemon(options);

	// Graceful shutdown on signals
	const shutdown = async () => {
		await daemon.stop();
		process.exit(0);
	};

	process.on("SIGTERM", shutdown);
	process.on("SIGINT", shutdown);

	await daemon.start();
	return daemon;
}
