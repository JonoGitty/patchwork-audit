/**
 * Patchwork Auto-Seal — periodic sealing of the relay chain for non-repudiation.
 *
 * The relay daemon calls performAutoSealCycle() on a timer. Each cycle:
 * 1. Checks if enough new events since last seal
 * 2. Seals the relay chain tip with HMAC-SHA256
 * 3. Appends seal record to the relay seals file
 * 4. Optionally publishes the seal to witness endpoints
 * 5. Returns the result for logging
 */

import { appendFileSync, existsSync, readFileSync, mkdirSync, chmodSync, chownSync } from "node:fs";
import { dirname, join } from "node:path";
import {
	computeSealPayload,
	signSeal,
	ensureKeyring,
	loadKeyById,
	type SealRecord,
} from "../hash/seal.js";
import type { AutoSealConfig, WitnessConfig, WitnessEndpointConfig } from "./config.js";

/** Path to the relay seals log (root-owned). */
export const RELAY_SEALS_PATH = "/Library/Patchwork/seals.relay.jsonl";

/** Path to the relay witness records (root-owned). */
export const RELAY_WITNESSES_PATH = "/Library/Patchwork/witnesses.relay.jsonl";

/** Root-owned keyring path. */
export const ROOT_KEYRING_PATH = "/Library/Patchwork/keys/seal";

/** Result of a single auto-seal cycle. */
export interface AutoSealResult {
	sealed: boolean;
	reason: string;
	seal?: SealRecord;
	witness?: WitnessResult;
}

/** Result of witness publishing. */
export interface WitnessResult {
	attempted: number;
	succeeded: number;
	failed: number;
	quorum_met: boolean;
	responses: WitnessEndpointResult[];
}

/** Result from a single witness endpoint. */
export interface WitnessEndpointResult {
	name: string;
	url: string;
	ok: boolean;
	status?: number;
	error?: string;
	response_hash?: string;
}

/** State needed to decide whether to seal. */
export interface SealState {
	chainTip: string | null;
	eventCount: number;
	lastSealEventCount: number;
	lastSealAt: number | null;
}

/**
 * Check if an auto-seal should be performed based on current state and config.
 */
export function shouldAutoSeal(state: SealState, config: AutoSealConfig): boolean {
	if (!config.enabled) return false;
	if (!state.chainTip) return false;

	const newEvents = state.eventCount - state.lastSealEventCount;
	return newEvents >= config.min_events_between_seals;
}

/**
 * Perform a seal on the relay chain tip.
 * Uses the root-owned keyring at /Library/Patchwork/keys/seal.
 *
 * @param state Current relay chain state
 * @param keyringPath Override keyring path (for testing)
 * @param sealsPath Override seals log path (for testing)
 */
export function performSeal(
	state: SealState,
	keyringPath?: string,
	sealsPath?: string,
): SealRecord {
	const kp = keyringPath ?? ROOT_KEYRING_PATH;
	const sp = sealsPath ?? RELAY_SEALS_PATH;

	if (!state.chainTip) {
		throw new Error("Cannot seal: no chain tip");
	}

	// Get or create keyring
	const { keyId, key } = ensureKeyring(kp);

	// Build seal
	const sealedAt = new Date().toISOString();
	const payload = computeSealPayload(state.chainTip, state.eventCount, sealedAt);
	const signature = signSeal(payload, key);

	const seal: SealRecord = {
		sealed_at: sealedAt,
		tip_hash: state.chainTip,
		chained_events: state.eventCount,
		signature,
		key_id: keyId,
	};

	// Append to seals log
	const dir = dirname(sp);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true, mode: 0o755 });
	}

	const isNew = !existsSync(sp);
	appendFileSync(sp, JSON.stringify(seal) + "\n", "utf-8");
	if (isNew) {
		try {
			chmodSync(sp, 0o644);
			chownSync(sp, 0, 0); // root:wheel
		} catch {
			// May fail in non-root test environments
		}
	}

	return seal;
}

/**
 * Publish a seal to witness endpoints for external anchoring.
 *
 * Each endpoint receives a POST with:
 * ```json
 * {
 *   "type": "patchwork-seal-anchor",
 *   "version": 1,
 *   "seal": { ...SealRecord },
 *   "relay_chain_tip": "sha256:...",
 *   "relay_event_count": 42,
 *   "anchored_at": "2026-04-02T..."
 * }
 * ```
 */
export async function publishToWitnesses(
	seal: SealRecord,
	config: WitnessConfig,
	witnessesPath?: string,
): Promise<WitnessResult> {
	const wp = witnessesPath ?? RELAY_WITNESSES_PATH;

	if (!config.enabled || config.endpoints.length === 0) {
		return {
			attempted: 0,
			succeeded: 0,
			failed: 0,
			quorum_met: true, // vacuously true — no witnesses required
			responses: [],
		};
	}

	const anchoredAt = new Date().toISOString();
	const body = JSON.stringify({
		type: "patchwork-seal-anchor",
		version: 1,
		seal,
		relay_chain_tip: seal.tip_hash,
		relay_event_count: seal.chained_events,
		anchored_at: anchoredAt,
	});

	const responses: WitnessEndpointResult[] = [];

	// Publish to all endpoints in parallel
	const promises = config.endpoints.map(async (endpoint) => {
		const result = await publishToEndpoint(endpoint, body);
		responses.push(result);
	});

	await Promise.allSettled(promises);

	const succeeded = responses.filter((r) => r.ok).length;
	const failed = responses.filter((r) => !r.ok).length;

	const witnessResult: WitnessResult = {
		attempted: config.endpoints.length,
		succeeded,
		failed,
		quorum_met: succeeded >= config.quorum,
		responses,
	};

	// Append witness record
	try {
		const dir = dirname(wp);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true, mode: 0o755 });
		}
		const record = {
			timestamp: anchoredAt,
			seal_tip: seal.tip_hash,
			...witnessResult,
		};
		const isNew = !existsSync(wp);
		appendFileSync(wp, JSON.stringify(record) + "\n", "utf-8");
		if (isNew) {
			try {
				chmodSync(wp, 0o644);
				chownSync(wp, 0, 0);
			} catch { /* non-root test */ }
		}
	} catch {
		// Best effort — witness record write failure is non-fatal
	}

	return witnessResult;
}

/** Publish to a single witness endpoint. */
async function publishToEndpoint(
	endpoint: WitnessEndpointConfig,
	body: string,
): Promise<WitnessEndpointResult> {
	try {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (endpoint.auth_token) {
			headers["Authorization"] = `Bearer ${endpoint.auth_token}`;
		}

		const resp = await fetch(endpoint.url, {
			method: "POST",
			headers,
			body,
			signal: AbortSignal.timeout(10_000),
		});

		if (resp.ok) {
			return {
				name: endpoint.name,
				url: endpoint.url,
				ok: true,
				status: resp.status,
			};
		}

		return {
			name: endpoint.name,
			url: endpoint.url,
			ok: false,
			status: resp.status,
			error: `HTTP ${resp.status}`,
		};
	} catch (err: unknown) {
		return {
			name: endpoint.name,
			url: endpoint.url,
			ok: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Full auto-seal cycle: check → seal → witness.
 * Called by the relay daemon on a timer.
 */
export async function performAutoSealCycle(
	state: SealState,
	autoSealConfig: AutoSealConfig,
	witnessConfig: WitnessConfig,
	keyringPath?: string,
	sealsPath?: string,
	witnessesPath?: string,
): Promise<AutoSealResult> {
	if (!shouldAutoSeal(state, autoSealConfig)) {
		return {
			sealed: false,
			reason: !state.chainTip
				? "No events to seal"
				: `Only ${state.eventCount - state.lastSealEventCount} new events (need ${autoSealConfig.min_events_between_seals})`,
		};
	}

	try {
		const seal = performSeal(state, keyringPath, sealsPath);

		let witness: WitnessResult | undefined;
		if (witnessConfig.enabled && witnessConfig.endpoints.length > 0) {
			witness = await publishToWitnesses(seal, witnessConfig, witnessesPath);
		}

		return {
			sealed: true,
			reason: "OK",
			seal,
			witness,
		};
	} catch (err: unknown) {
		return {
			sealed: false,
			reason: `Seal failed: ${err instanceof Error ? err.message : String(err)}`,
		};
	}
}

/**
 * Read the last seal from the seals log.
 * Returns null if no seals exist.
 */
export function readLastSeal(sealsPath?: string): SealRecord | null {
	const sp = sealsPath ?? RELAY_SEALS_PATH;
	if (!existsSync(sp)) return null;

	try {
		const content = readFileSync(sp, "utf-8");
		const lines = content.split("\n").filter((l) => l.trim());
		if (lines.length === 0) return null;

		return JSON.parse(lines[lines.length - 1]) as SealRecord;
	} catch {
		return null;
	}
}
