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
	closeSync,
	constants as fsConstants,
	existsSync,
	lstatSync,
	mkdirSync,
	openSync,
	readFileSync,
	renameSync,
	statSync,
	unlinkSync,
	writeFileSync,
	writeSync,
} from "node:fs";
import { dirname } from "node:path";
import { AuditEventSchema } from "../schema/event.js";
import { computeEventHash } from "../hash/chain.js";
import { ensureKeyring, loadKeyById, signSeal, verifySeal } from "../hash/seal.js";
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
	type SealStatusResponse,
	type ChainStateResponse,
	type SignResponse,
	type VerifyResponse,
} from "./protocol.js";
import { loadRelayConfig, type RelayConfig } from "./config.js";
import {
	performAutoSealCycle,
	readLastSeal,
	RELAY_SEALS_PATH,
	ROOT_KEYRING_PATH,
	type SealState,
} from "./auto-seal.js";

/** Relay daemon configuration. */
export interface RelayDaemonOptions {
	socketPath?: string;
	logPath?: string;
	daemonLogPath?: string;
	pidPath?: string;
	heartbeatIntervalMs?: number;
	configPath?: string;
	keyringPath?: string;
	sealsPath?: string;
	witnessesPath?: string;
}

/** Relay daemon state — exposed for testing. */
export interface RelayDaemonState {
	eventCount: number;
	chainTip: string | null;
	startedAt: number;
	lastHeartbeat: number | null;
	lastSealEventCount: number;
	lastSealAt: number | null;
	totalSeals: number;
}

/**
 * The relay daemon. Call start() to begin listening.
 */
export class RelayDaemon {
	private server: Server | null = null;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private autoSealTimer: ReturnType<typeof setInterval> | null = null;
	/**
	 * Reentrancy guard for runAutoSealCycle. setInterval can fire again while
	 * a previous cycle is still awaiting witness publication; without this
	 * flag two cycles can interleave and emit out-of-order or duplicated
	 * seals.
	 */
	private autoSealInProgress = false;
	private readonly socketPath: string;
	private readonly logPath: string;
	private readonly daemonLogPath: string;
	private readonly pidPath: string;
	private readonly heartbeatIntervalMs: number;
	private readonly configPath: string | undefined;
	private readonly keyringPath: string;
	private readonly sealsPath: string | undefined;
	private readonly witnessesPath: string | undefined;
	private relayConfig: RelayConfig | null = null;

	/** Daemon state — public for testing. */
	readonly state: RelayDaemonState = {
		eventCount: 0,
		chainTip: null,
		startedAt: Date.now(),
		lastHeartbeat: null,
		lastSealEventCount: 0,
		lastSealAt: null,
		totalSeals: 0,
	};

	constructor(options: RelayDaemonOptions = {}) {
		this.socketPath = options.socketPath ?? RELAY_SOCKET_PATH;
		this.logPath = options.logPath ?? RELAY_LOG_PATH;
		this.daemonLogPath = options.daemonLogPath ?? RELAY_DAEMON_LOG_PATH;
		this.pidPath = options.pidPath ?? RELAY_PID_PATH;
		this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS;
		this.configPath = options.configPath;
		this.keyringPath = options.keyringPath ?? ROOT_KEYRING_PATH;
		this.sealsPath = options.sealsPath;
		this.witnessesPath = options.witnessesPath;
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

		// Recover seal count from seals log
		const sealsPath = this.sealsPath ?? RELAY_SEALS_PATH;
		if (existsSync(sealsPath)) {
			try {
				const content = readFileSync(sealsPath, "utf-8");
				const lines = content.split("\n").filter((l) => l.trim().length > 0);
				this.state.totalSeals = lines.length;
				this.log(`Recovered ${lines.length} seals`);
			} catch {
				// Non-fatal
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
				// SECURITY: previously chmod 0777 — that lets any local user
				// send `sign` requests and obtain signatures from the
				// root-owned key (signing oracle). 0660 keeps the socket
				// usable by group members (the agent UIDs you grant via your
				// platform's group membership) without exposing it to the
				// whole machine. Per-request authorization happens in
				// handleSign() — we additionally restrict what the relay
				// will sign to known Patchwork protocol payloads.
				try {
					chmodSync(this.socketPath, 0o660);
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

				// Load config
				const { config, source } = loadRelayConfig(this.configPath);
				this.relayConfig = config;
				this.log(`Config loaded from ${source}`);

				// Recover seal state
				const lastSeal = readLastSeal(this.sealsPath);
				if (lastSeal) {
					this.state.lastSealEventCount = lastSeal.chained_events;
					this.state.lastSealAt = new Date(lastSeal.sealed_at).getTime();
					this.log(`Recovered last seal: ${lastSeal.chained_events} events at ${lastSeal.sealed_at}`);
				}

				// Start heartbeat
				this.startHeartbeat();

				// Start auto-seal timer
				this.startAutoSeal();

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
			if (this.autoSealTimer) {
				clearInterval(this.autoSealTimer);
				this.autoSealTimer = null;
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

			case "seal_status":
				return this.getSealStatus();

			case "get_chain_state":
				return this.getChainState();

			case "sign":
				return this.handleSign(msg);

			case "verify":
				return this.handleVerify(msg);

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

		// Append to root-owned log via O_APPEND|O_CREAT|O_NOFOLLOW so that
		// a malicious symlink at this.logPath cannot redirect writes to an
		// arbitrary file. lstat the existing path first to refuse symlinks
		// up front (defense in depth: O_NOFOLLOW only fails if the FINAL
		// path component is a symlink).
		try {
			const line = JSON.stringify(relayEvent) + "\n";
			const isNew = !existsSync(this.logPath);
			if (!isNew) {
				try {
					const ls = lstatSync(this.logPath);
					if (ls.isSymbolicLink()) {
						this.log(`WRITE ERROR: relay log is a symlink — refusing to follow`);
						return { ok: false, error: "relay log path is a symlink" };
					}
				} catch {
					// stat failed — let openSync fail with a clear error below
				}
			}
			const fd = openSync(
				this.logPath,
				fsConstants.O_APPEND | fsConstants.O_CREAT | fsConstants.O_WRONLY | fsConstants.O_NOFOLLOW,
				0o644,
			);
			try {
				writeSync(fd, line);
			} finally {
				closeSync(fd);
			}
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

	// ---------------------------------------------------------------------------
	// Layer 4: Auto-seal
	// ---------------------------------------------------------------------------

	/** Start the periodic auto-seal timer. */
	private startAutoSeal(): void {
		if (!this.relayConfig?.auto_seal.enabled) return;

		const intervalMs = this.relayConfig.auto_seal.interval_minutes * 60_000;
		this.autoSealTimer = setInterval(() => {
			this.runAutoSealCycle().catch((err) => {
				this.log(`AUTO-SEAL ERROR: ${err instanceof Error ? err.message : String(err)}`);
			});
		}, intervalMs);

		if (this.autoSealTimer.unref) {
			this.autoSealTimer.unref();
		}

		this.log(`Auto-seal enabled: every ${this.relayConfig.auto_seal.interval_minutes}m, min ${this.relayConfig.auto_seal.min_events_between_seals} events`);
	}

	/** Run a single auto-seal cycle. */
	private async runAutoSealCycle(): Promise<void> {
		if (!this.relayConfig) return;
		// Reentrancy guard — setInterval can fire while a cycle is awaiting
		// witness publishing. Skip overlapping cycles instead of doubling up.
		if (this.autoSealInProgress) {
			this.log("AUTO-SEAL: skipped — previous cycle still in progress");
			return;
		}
		this.autoSealInProgress = true;
		try {
			const sealState: SealState = {
				chainTip: this.state.chainTip,
				eventCount: this.state.eventCount,
				lastSealEventCount: this.state.lastSealEventCount,
				lastSealAt: this.state.lastSealAt,
			};

			const result = await performAutoSealCycle(
				sealState,
				this.relayConfig.auto_seal,
				this.relayConfig.witness,
				this.keyringPath,
				this.sealsPath,
				this.witnessesPath,
			);

			if (result.sealed && result.seal) {
				// FIX: bind state to the seal that was actually emitted, not
				// to the live event count. Events appended while the witness
				// publish was awaiting MUST NOT be marked as sealed —
				// otherwise they're never covered by any seal.
				this.state.lastSealEventCount = result.seal.chained_events;
				this.state.lastSealAt = new Date(result.seal.sealed_at).getTime();
				this.state.totalSeals++;
				this.log(`AUTO-SEAL: ${result.seal.tip_hash.slice(0, 30)}... (${result.seal.chained_events} events, key=${result.seal.key_id})`);

				// Drift warning: if events arrived during witness publishing,
				// we know they're outstanding for the next cycle.
				if (this.state.eventCount > result.seal.chained_events) {
					const drift = this.state.eventCount - result.seal.chained_events;
					this.log(`AUTO-SEAL: ${drift} event(s) appended during cycle — covered by next seal`);
				}

				if (result.witness) {
					this.log(`WITNESS: ${result.witness.succeeded}/${result.witness.attempted} endpoints, quorum=${result.witness.quorum_met ? "MET" : "FAILED"}`);
				}
			} else {
				this.log(`AUTO-SEAL: skipped — ${result.reason}`);
			}
		} finally {
			this.autoSealInProgress = false;
		}
	}

	// ---------------------------------------------------------------------------
	// Layer 4: Seal status / chain state queries
	// ---------------------------------------------------------------------------

	/** Return current seal status. */
	private getSealStatus(): SealStatusResponse {
		const lastSeal = readLastSeal(this.sealsPath);
		return {
			ok: true,
			last_seal_at: lastSeal?.sealed_at ?? null,
			last_seal_tip: lastSeal?.tip_hash ?? null,
			last_seal_events: lastSeal?.chained_events ?? null,
			seals_total: this.state.totalSeals,
			auto_seal_enabled: this.relayConfig?.auto_seal.enabled ?? false,
			witness_enabled: this.relayConfig?.witness.enabled ?? false,
			witness_quorum_met: null, // TODO: track from last witness result
		};
	}

	/** Return current chain state. */
	private getChainState(): ChainStateResponse {
		return {
			ok: true,
			chain_tip: this.state.chainTip,
			event_count: this.state.eventCount,
			last_seal_event_count: this.state.lastSealEventCount,
			last_heartbeat: this.state.lastHeartbeat,
			uptime_ms: Date.now() - this.state.startedAt,
			auto_seal_interval_minutes: this.relayConfig?.auto_seal.interval_minutes ?? 0,
		};
	}

	// ---------------------------------------------------------------------------
	// Layer 5: Signing proxy
	// ---------------------------------------------------------------------------

	private static readonly SIGN_PAYLOAD_MAX_BYTES = 16 * 1024;

	/** DSSE Pre-Authentication Encoding always begins with this literal. */
	private static readonly DSSE_PAE_PREFIX = "DSSEv1 ";

	/**
	 * Decide whether the relay is willing to sign this payload, and return a
	 * short tag describing what shape it is. Returning `null` means refuse.
	 *
	 * Hardening rationale (2026-05, second pass):
	 *
	 *   - Seals (`patchwork-seal:v1:...`) are NEVER signed on behalf of clients.
	 *     The daemon produces seals from its own held chain state inside the
	 *     auto-seal loop, never via this code path. Accepting a seal-shaped
	 *     payload here would let any local socket user mint a root-key
	 *     signature over a forged tip-hash + event-count + timestamp.
	 *
	 *   - Bespoke commit attestations are JSON objects produced by
	 *     `buildAttestationPayload()` — sorted-key JSON beginning with `{`.
	 *     We require it to parse as JSON, be an object, and self-declare
	 *     `type === "commit-attestation"` and `schema_version === 1`. This
	 *     stops the relay being a generic JSON-signing oracle.
	 *
	 *   - DSSE Pre-Authentication Encoding starts with the literal
	 *     `DSSEv1 ` and has a strict envelope shape we validate before
	 *     signing.
	 *
	 *   - Anything else is refused so the root-owned keyring can never be
	 *     used to sign attacker-chosen text.
	 */
	/** in-toto Statement payloadType expected inside DSSE PAEs we'll sign. */
	private static readonly INTOTO_PAYLOAD_TYPE = "application/vnd.in-toto+json";

	private classifySignablePayload(data: string): "commit-attestation" | "dsse-pae" | null {
		if (data.startsWith(RelayDaemon.DSSE_PAE_PREFIX)) {
			return this.validateDssePae(data) ? "dsse-pae" : null;
		}
		if (data.startsWith("{")) {
			let parsed: unknown;
			try { parsed = JSON.parse(data); } catch { return null; }
			if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
			const obj = parsed as Record<string, unknown>;
			if (obj.type !== "commit-attestation") return null;
			if (obj.schema_version !== 1) return null;
			return "commit-attestation";
		}
		return null;
	}

	/**
	 * Strictly validate a DSSE Pre-Authentication Encoding string before
	 * signing. The format (RFC-style):
	 *
	 *   `DSSEv1 <type-len> <payloadType> <payload-len> <payload>`
	 *
	 * with byte-counted lengths (UTF-8 byte counts, not character counts).
	 *
	 * Earlier passes only checked that the string roughly matched the PAE
	 * shape via regex. That accepted forged PAEs whose declared lengths didn't
	 * match the bytes that followed, and accepted any payloadType including
	 * non-in-toto values — turning the relay into a generic root-key signing
	 * oracle for anything DSSE-shaped.
	 *
	 * This implementation:
	 *   - parses both length tokens as UTF-8 byte counts
	 *   - confirms payloadType matches the in-toto Statement media type
	 *   - confirms the payload section is exactly the declared byte length
	 *   - decodes the payload as UTF-8 JSON and confirms it parses to an
	 *     object with `_type === "https://in-toto.io/Statement/v1"` (so a
	 *     hostile caller can't smuggle arbitrary canonical JSON through the
	 *     DSSE wrapper).
	 */
	private validateDssePae(data: string): boolean {
		const buf = Buffer.from(data, "utf8");
		const prefixLen = Buffer.byteLength(RelayDaemon.DSSE_PAE_PREFIX, "utf8");
		let pos = prefixLen;

		const readDecimal = (): { n: number; nextPos: number } | null => {
			let end = pos;
			while (end < buf.length && buf[end] >= 0x30 && buf[end] <= 0x39) end++;
			if (end === pos || end >= buf.length || buf[end] !== 0x20) return null;
			const n = Number.parseInt(buf.slice(pos, end).toString("utf8"), 10);
			if (!Number.isInteger(n) || n < 0 || n > RelayDaemon.SIGN_PAYLOAD_MAX_BYTES) return null;
			return { n, nextPos: end + 1 };
		};

		// type-len
		const typeLen = readDecimal();
		if (!typeLen) return false;
		pos = typeLen.nextPos;

		// type bytes (must equal in-toto media type) followed by SP
		if (pos + typeLen.n + 1 > buf.length) return false;
		const typeBytes = buf.slice(pos, pos + typeLen.n).toString("utf8");
		if (typeBytes !== RelayDaemon.INTOTO_PAYLOAD_TYPE) return false;
		if (buf[pos + typeLen.n] !== 0x20) return false;
		pos += typeLen.n + 1;

		// payload-len
		const payloadLen = readDecimal();
		if (!payloadLen) return false;
		pos = payloadLen.nextPos;

		// Payload section must be exactly payloadLen bytes and exhaust the
		// buffer (no trailing junk used to smuggle extra content past the
		// length-bound check).
		if (pos + payloadLen.n !== buf.length) return false;

		const payloadStr = buf.slice(pos, pos + payloadLen.n).toString("utf8");
		let stmt: unknown;
		try { stmt = JSON.parse(payloadStr); } catch { return false; }
		if (stmt === null || typeof stmt !== "object" || Array.isArray(stmt)) return false;
		const obj = stmt as Record<string, unknown>;
		if (obj._type !== "https://in-toto.io/Statement/v1") return false;

		// Subject must be a non-empty array of well-formed entries.
		if (!Array.isArray(obj.subject) || obj.subject.length === 0) return false;
		for (const entry of obj.subject) {
			if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return false;
			const e = entry as Record<string, unknown>;
			if (typeof e.name !== "string" || e.name.length === 0) return false;
			if (e.digest === null || typeof e.digest !== "object" || Array.isArray(e.digest)) return false;
			// Each digest entry must be `algo: <hex>` so a hostile attestation
			// can't smuggle binary or path-shaped values through the relay.
			let sawDigest = false;
			for (const [algo, hex] of Object.entries(e.digest as Record<string, unknown>)) {
				sawDigest = true;
				if (typeof algo !== "string" || !/^[a-z0-9_-]{1,32}$/.test(algo)) return false;
				if (typeof hex !== "string" || !/^[0-9a-f]{32,128}$/i.test(hex)) return false;
			}
			if (!sawDigest) return false;
		}

		// predicateType must be a non-empty URL-ish string and must come from
		// the allowlist of types Patchwork itself emits. Adding a new
		// predicateType requires a source-code change here, which is the right
		// place to add the matching predicate-shape check.
		if (typeof obj.predicateType !== "string" || obj.predicateType.length === 0) return false;
		if (!RelayDaemon.ALLOWED_PREDICATE_TYPES.has(obj.predicateType)) return false;

		// Predicate body must exist as an object so a trivial envelope is refused.
		if (obj.predicate === null || typeof obj.predicate !== "object" || Array.isArray(obj.predicate)) return false;

		return true;
	}

	/**
	 * predicateType values Patchwork legitimately produces. Anything else MUST
	 * NOT get a root-key signature via the relay — the right place to add a new
	 * predicate type is here, and at the same time you should add the
	 * predicate-shape check above so the daemon doesn't sign a trivial
	 * envelope around an attacker-chosen predicate body.
	 */
	private static readonly ALLOWED_PREDICATE_TYPES = new Set<string>([
		// Bespoke Patchwork commit-attestation wrapped as in-toto Statement —
		// see PATCHWORK_PREDICATE_TYPE in attestation/intoto.ts.
		"https://patchwork-audit.dev/ai-agent-session/v1",
	]);

	/**
	 * Handle a sign request — signs data with the root-owned keyring.
	 *
	 * Hardening (2026-05): see classifySignablePayload() for what we accept and
	 * why. The previous prefix-allowlist accepted seal-shaped payloads, which
	 * let any local socket user mint a forged seal signature. This pass
	 * removes seals from the accepted set entirely (the daemon signs its own
	 * seals from held state) and validates that JSON/DSSE payloads have the
	 * shape they claim.
	 */
	private handleSign(msg: RelayMessage): SignResponse {
		const payload = msg.payload as { data?: string; key_id?: string } | undefined;

		if (!payload?.data) {
			return { ok: false, error: "Missing sign payload.data" };
		}

		// Bound the payload size — daemon should never sign large blobs.
		if (payload.data.length > RelayDaemon.SIGN_PAYLOAD_MAX_BYTES) {
			return {
				ok: false,
				error: `sign payload exceeds ${RelayDaemon.SIGN_PAYLOAD_MAX_BYTES} bytes`,
			};
		}

		const kind = this.classifySignablePayload(payload.data);
		if (kind === null) {
			this.log(`SIGN REJECTED: payload is not a recognised commit-attestation JSON or DSSE PAE`);
			return {
				ok: false,
				error: "sign payload must be a commit-attestation JSON or DSSE PAE — seals and arbitrary text are refused",
			};
		}

		try {
			let key: Buffer;
			let keyId: string;

			if (payload.key_id) {
				// Sign with specific key — loadKeyById validates the keyId
				// shape so a traversal like `../../tmp/known` is rejected
				// at the seal layer.
				key = loadKeyById(this.keyringPath, payload.key_id);
				keyId = payload.key_id;
			} else {
				// Sign with active key
				const keyring = ensureKeyring(this.keyringPath);
				key = keyring.key;
				keyId = keyring.keyId;
			}

			const signature = signSeal(payload.data, key);
			const signedAt = new Date().toISOString();

			this.log(`SIGN: kind=${kind}, key=${keyId}, data=${payload.data.slice(0, 40)}...`);

			return {
				ok: true,
				signature,
				key_id: keyId,
				signed_at: signedAt,
			};
		} catch (err: unknown) {
			const errMsg = err instanceof Error ? err.message : String(err);
			this.log(`SIGN ERROR: ${errMsg}`);
			return { ok: false, error: `Sign failed: ${errMsg}` };
		}
	}

	/**
	 * Handle a verify request — checks a signature against the root-owned keyring.
	 *
	 * Returns ok=true with verified=true/false. Only returns ok=false when the
	 * request is malformed or the key does not exist in the root keyring.
	 */
	private handleVerify(msg: RelayMessage): VerifyResponse {
		const payload = msg.payload as
			| { data?: string; signature?: string; key_id?: string }
			| undefined;

		if (!payload?.data || !payload.signature || !payload.key_id) {
			return { ok: false, error: "Missing verify payload fields (data, signature, key_id)" };
		}

		let key: Buffer;
		try {
			key = loadKeyById(this.keyringPath, payload.key_id);
		} catch {
			return { ok: true, verified: false, reason: "unknown_key" };
		}

		const verified = verifySeal(payload.data, payload.signature, key);
		return {
			ok: true,
			verified,
			...(verified ? {} : { reason: "signature_mismatch" }),
		};
	}

	/** Maximum daemon log size before rotation (100 KB). */
	private static readonly LOG_MAX_BYTES = 100 * 1024;
	/** Number of rotated daemon logs to keep. */
	private static readonly LOG_MAX_FILES = 3;

	/** Log to the daemon log file with rotation. */
	private log(message: string): void {
		const ts = new Date().toISOString();
		const line = `${ts} [relay] ${message}\n`;
		try {
			const logDir = dirname(this.daemonLogPath);
			if (!existsSync(logDir)) {
				mkdirSync(logDir, { recursive: true, mode: 0o755 });
			}

			// Rotate if over size limit
			if (existsSync(this.daemonLogPath)) {
				try {
					const { size } = statSync(this.daemonLogPath);
					if (size > RelayDaemon.LOG_MAX_BYTES) {
						this.rotateDaemonLog();
					}
				} catch { /* stat failed — write anyway */ }
			}

			appendFileSync(this.daemonLogPath, line, "utf-8");
		} catch {
			// Fall back to stderr if we can't write the log
			process.stderr.write(line);
		}
	}

	/** Rotate daemon log: active -> .1, .1 -> .2, etc. */
	private rotateDaemonLog(): void {
		const max = RelayDaemon.LOG_MAX_FILES;
		const base = this.daemonLogPath;

		// Delete oldest
		const oldest = `${base}.${max}`;
		if (existsSync(oldest)) {
			try { unlinkSync(oldest); } catch { /* */ }
		}

		// Shift N-1 -> N, ..., 1 -> 2
		for (let i = max - 1; i >= 1; i--) {
			const src = `${base}.${i}`;
			const dst = `${base}.${i + 1}`;
			if (existsSync(src)) {
				try { renameSync(src, dst); } catch { /* */ }
			}
		}

		// Active -> .1
		try { renameSync(base, `${base}.1`); } catch { /* */ }
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
