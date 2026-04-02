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
import { ensureKeyring, signSeal } from "../hash/seal.js";
import {
	RELAY_SOCKET_PATH,
	RELAY_PROTOCOL_VERSION,
	type RelayMessage,
	type SignResponse,
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
 * Falls back to local keyring if relay is unavailable.
 *
 * @param data - The payload to sign (e.g., seal payload string)
 * @param options - Override socket path or keyring (for testing)
 */
export async function requestSignature(
	data: string,
	options?: {
		socketPath?: string;
		localKeyringPath?: string;
		keyId?: string;
	},
): Promise<SignatureResult> {
	const sockPath = options?.socketPath ?? RELAY_SOCKET_PATH;

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
		} catch {
			// Relay failed — fall through to local
		}
	}

	// Fallback: sign locally
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
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new Error("Sign request timed out"));
		}, SIGN_TIMEOUT_MS);

		const msg: RelayMessage = {
			protocol_version: RELAY_PROTOCOL_VERSION,
			type: "sign",
			timestamp: new Date().toISOString(),
			payload: {
				data,
				...(keyId ? { key_id: keyId } : {}),
			},
		};

		const socket = connect(socketPath, () => {
			socket.write(JSON.stringify(msg) + "\n");
		});

		socket.on("data", (chunk) => {
			clearTimeout(timer);
			try {
				resolve(JSON.parse(chunk.toString().trim()));
			} catch {
				reject(new Error("Invalid sign response"));
			}
			socket.destroy();
		});

		socket.on("error", (err) => {
			clearTimeout(timer);
			reject(err);
		});
	});
}
