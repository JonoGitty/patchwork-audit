/**
 * Patchwork Relay Protocol — shared constants and types for the
 * root-owned audit relay (layer 2 tamper-proof architecture).
 *
 * The relay receives copies of audit events over a Unix domain socket
 * and writes them to a root-owned, append-only log that user-level
 * processes (including AI agents) cannot modify or delete.
 */

/** Default path for the relay Unix domain socket (root-owned). */
export const RELAY_SOCKET_PATH = "/Library/Patchwork/relay.sock";

/** Default path for the root-owned append-only event log. */
export const RELAY_LOG_PATH = "/Library/Patchwork/events.relay.jsonl";

/** Default path for the relay daemon log. */
export const RELAY_DAEMON_LOG_PATH = "/Library/Patchwork/relay.log";

/** Default path for the relay PID file. */
export const RELAY_PID_PATH = "/Library/Patchwork/relay.pid";

/** Heartbeat interval in milliseconds. */
export const HEARTBEAT_INTERVAL_MS = 30_000;

/** Maximum message size from a client (64 KB — single event should be well under this). */
export const MAX_MESSAGE_SIZE = 65_536;

/** Protocol version for relay messages. */
export const RELAY_PROTOCOL_VERSION = 1;

/**
 * A relay message wraps an audit event with protocol metadata.
 * Sent as a single line of JSON over the Unix socket.
 */
export interface RelayMessage {
	protocol_version: number;
	type: "event" | "heartbeat" | "ping";
	timestamp: string;
	/** The serialized audit event (for type=event). */
	payload?: Record<string, unknown>;
}

/**
 * Relay response sent back to the client.
 * Single line of JSON terminated by newline.
 */
export interface RelayResponse {
	ok: boolean;
	error?: string;
	/** The relay's chain tip hash after processing. */
	relay_hash?: string;
}

/** Heartbeat record written to the relay log. */
export interface HeartbeatRecord {
	type: "heartbeat";
	timestamp: string;
	relay_chain_tip: string | null;
	relay_event_count: number;
	user_chain_tip?: string | null;
	uptime_ms: number;
}
