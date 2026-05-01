/**
 * Patchwork Signing Proxy — request signatures from the relay daemon.
 *
 * Layer 5: user-level code never touches raw key material. Instead,
 * it sends signing requests to the root-owned relay daemon over the
 * Unix socket. The daemon signs with its root-owned keyring and
 * returns the signature.
 *
 * Falls back to local keyring if the relay is unavailable.
 */

import { connect } from "node:net";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getHomeDir } from "../path/home.js";
import { loadKeyById, ensureKeyring, signSeal, verifySeal } from "../hash/seal.js";
import {
	RELAY_SOCKET_PATH,
	RELAY_PROTOCOL_VERSION,
	type RelayMessage,
	type SignResponse,
	type VerifyResponse,
} from "./protocol.js";

/** Timeout for signing requests in milliseconds. */
const SIGN_TIMEOUT_MS = 2_000;

/** Default local keyring path (user-owned, fallback). */
function getLocalKeyringPath(): string {
	return join(getHomeDir(), ".patchwork", "keys", "seal");
}

/** Result of a signature request. */
export interface SignatureResult {
	signature: string;
	key_id: string;
	signed_at: string;
	source: "relay" | "local";
}

/**
 * Request a signature from the relay daemon.
 *
 * Failure modes:
 *   - default: relay unavailable → fall back to local keyring (legacy behaviour
 *     for solo developers without a daemon installed). The result's
 *     `source` is `"local"` so downstream verifiers can see the
 *     downgrade and treat it as untrusted-root.
 *   - `requireRelay: true` (or env `PATCHWORK_REQUIRE_RELAY=1`): never fall back.
 *     Throws `RelayUnavailableError` if the relay is missing or refuses the
 *     request. Use this for compliance contexts where attestations must be
 *     produced by the root-owned keyring or not produced at all — otherwise
 *     an attacker who blocks the socket downgrades to the user keyring.
 *
 * @param data - The payload to sign (e.g., seal payload string)
 * @param options - Override socket path, keyring, or require relay
 */
export class RelayUnavailableError extends Error {
	constructor(reason: string) {
		super(`relay-required signing failed: ${reason}`);
		this.name = "RelayUnavailableError";
	}
}

export async function requestSignature(
	data: string,
	options?: {
		socketPath?: string;
		localKeyringPath?: string;
		keyId?: string;
		/** Refuse to fall back to local keyring on relay failure. */
		requireRelay?: boolean;
	},
): Promise<SignatureResult> {
	const sockPath = options?.socketPath ?? RELAY_SOCKET_PATH;
	const requireRelay = options?.requireRelay
		?? process.env.PATCHWORK_REQUIRE_RELAY === "1";

	// Try relay first
	if (existsSync(sockPath)) {
		try {
			const resp = await sendSignRequest(sockPath, data, options?.keyId);
			if (resp.ok && resp.signature && resp.key_id && resp.signed_at) {
				return {
					signature: resp.signature,
					key_id: resp.key_id,
					signed_at: resp.signed_at,
					source: "relay",
				};
			}
			if (requireRelay) {
				throw new RelayUnavailableError(`relay refused: ${resp.error ?? "unknown error"}`);
			}
		} catch (err) {
			if (requireRelay) {
				if (err instanceof RelayUnavailableError) throw err;
				const msg = err instanceof Error ? err.message : String(err);
				throw new RelayUnavailableError(`relay error: ${msg}`);
			}
			// Best-effort: fall through to local
		}
	} else if (requireRelay) {
		throw new RelayUnavailableError(`relay socket not present at ${sockPath}`);
	}

	// Fallback: sign locally. Loud in the logs because verifiers who care
	// about the root-keyring trust model should reject `source: "local"`.
	if (process.env.PATCHWORK_DEBUG === "1") {
		console.warn(
			`patchwork: signing locally (relay at ${sockPath} unavailable). ` +
			`Verifiers expecting root-keyring signatures will reject this attestation. ` +
			`Set PATCHWORK_REQUIRE_RELAY=1 to refuse the downgrade.`,
		);
	}
	const localKeyring = options?.localKeyringPath ?? getLocalKeyringPath();
	const { keyId, key } = ensureKeyring(localKeyring);
	const signature = signSeal(data, key);

	return {
		signature,
		key_id: keyId,
		signed_at: new Date().toISOString(),
		source: "local",
	};
}

/** Send a sign request to the relay daemon over Unix socket. */
function sendSignRequest(
	socketPath: string,
	data: string,
	keyId?: string,
): Promise<SignResponse> {
	return sendRelayRequest<SignResponse>(socketPath, {
		protocol_version: RELAY_PROTOCOL_VERSION,
		type: "sign",
		timestamp: new Date().toISOString(),
		payload: {
			data,
			...(keyId ? { key_id: keyId } : {}),
		},
	});
}

/** Result of a verification request. */
export interface VerifyResult {
	verified: boolean;
	source: "relay" | "local";
	/** Set when verification fails — "unknown_key" or "signature_mismatch" or "no_key_available". */
	reason?: string;
}

/**
 * Verify a signature against a payload.
 *
 * Tries the local keyring first (for locally-signed attestations), then
 * falls back to the relay daemon (for root-keyring-signed attestations).
 * This ordering avoids unnecessary socket roundtrips for the common case
 * while still supporting signatures produced by the root-owned keyring.
 */
export async function requestVerification(
	data: string,
	signature: string,
	keyId: string,
	options?: {
		socketPath?: string;
		localKeyringPath?: string;
	},
): Promise<VerifyResult> {
	// Try local keyring first
	const localKeyring = options?.localKeyringPath ?? getLocalKeyringPath();
	try {
		const key = loadKeyById(localKeyring, keyId);
		const verified = verifySeal(data, signature, key);
		return {
			verified,
			source: "local",
			...(verified ? {} : { reason: "signature_mismatch" }),
		};
	} catch {
		// Key not in local keyring — may be in root keyring. Fall through.
	}

	// Fall back to relay daemon (root keyring)
	const sockPath = options?.socketPath ?? RELAY_SOCKET_PATH;
	if (existsSync(sockPath)) {
		try {
			const resp = await sendVerifyRequest(sockPath, data, signature, keyId);
			if (resp.ok) {
				return {
					verified: resp.verified === true,
					source: "relay",
					...(resp.reason ? { reason: resp.reason } : {}),
				};
			}
		} catch {
			// Relay unreachable — no way to verify
		}
	}

	return { verified: false, source: "local", reason: "no_key_available" };
}

/** Send a verify request to the relay daemon over Unix socket. */
function sendVerifyRequest(
	socketPath: string,
	data: string,
	signature: string,
	keyId: string,
): Promise<VerifyResponse> {
	return sendRelayRequest<VerifyResponse>(socketPath, {
		protocol_version: RELAY_PROTOCOL_VERSION,
		type: "verify",
		timestamp: new Date().toISOString(),
		payload: { data, signature, key_id: keyId },
	});
}

/** Generic newline-delimited JSON request/response over a Unix socket. */
function sendRelayRequest<T>(socketPath: string, msg: RelayMessage): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new Error("Relay request timed out"));
		}, SIGN_TIMEOUT_MS);

		const socket = connect(socketPath, () => {
			socket.write(JSON.stringify(msg) + "\n");
		});

		socket.on("data", (chunk) => {
			clearTimeout(timer);
			try {
				resolve(JSON.parse(chunk.toString().trim()) as T);
			} catch {
				reject(new Error("Invalid relay response"));
			}
			socket.destroy();
		});

		socket.on("error", (err) => {
			clearTimeout(timer);
			reject(err);
		});
	});
}
