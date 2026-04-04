/**
 * Sync agent — reads relay log, builds batches, pushes to team server.
 *
 * Runs as a background daemon on developer machines. Reads from the
 * tamper-proof relay log (root-owned), not the user log.
 */

import { RELAY_LOG_PATH } from "@patchwork/core";
import { SYNC_INTERVAL_MS } from "../constants.js";
import type { SyncEnvelope, TeamConfig, SyncCursor } from "../protocol.js";
import { signEnvelope, computeBatchHash } from "../crypto.js";
import { readCursor, writeCursor } from "./cursor.js";
import { readNewEvents } from "./reader.js";
import { readNewSeals } from "./seal-reader.js";
import { pushBatch } from "./transport.js";
import { computeBackoffMs } from "./backoff.js";

export interface SyncAgentOptions {
	config: TeamConfig;
	cursorPath?: string;
	logPath?: string;
	sealsPath?: string;
	intervalMs?: number;
	/** Called on each cycle for logging. */
	onCycle?: (result: CycleResult) => void;
}

export interface CycleResult {
	eventsPushed: number;
	sealsPushed: number;
	accepted: number;
	duplicates: number;
	error?: string;
	backoffMs: number;
}

export class SyncAgent {
	private timer: ReturnType<typeof setInterval> | null = null;
	private running = false;
	private readonly config: TeamConfig;
	private readonly cursorPath?: string;
	private readonly logPath?: string;
	private readonly sealsPath?: string;
	private readonly intervalMs: number;
	private readonly onCycle?: (result: CycleResult) => void;

	constructor(options: SyncAgentOptions) {
		this.config = options.config;
		this.cursorPath = options.cursorPath;
		this.logPath = options.logPath;
		this.sealsPath = options.sealsPath;
		this.intervalMs = options.intervalMs ?? SYNC_INTERVAL_MS;
		this.onCycle = options.onCycle;
	}

	/** Start the sync loop. */
	start(): void {
		if (this.running) return;
		this.running = true;

		// Run immediately on start
		this.cycle().catch(() => {});

		this.timer = setInterval(() => {
			this.cycle().catch(() => {});
		}, this.intervalMs);
	}

	/** Stop the sync loop. */
	stop(): void {
		this.running = false;
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	/** Run a single sync cycle. Exposed for testing. */
	async cycle(): Promise<CycleResult> {
		const cursor = readCursor(this.cursorPath);

		// Check backoff
		if (cursor.consecutive_failures > 0) {
			const backoffMs = computeBackoffMs(cursor.consecutive_failures);
			const lastFailure = cursor.last_synced_at ? new Date(cursor.last_synced_at).getTime() : 0;
			if (Date.now() - lastFailure < backoffMs) {
				const result: CycleResult = {
					eventsPushed: 0, sealsPushed: 0, accepted: 0, duplicates: 0,
					backoffMs, error: `Backing off (${cursor.consecutive_failures} failures)`,
				};
				this.onCycle?.(result);
				return result;
			}
		}

		// Read new events from relay log
		const { events, newByteOffset } = readNewEvents(
			this.logPath, cursor.last_synced_offset,
		);

		if (events.length === 0) {
			const result: CycleResult = {
				eventsPushed: 0, sealsPushed: 0, accepted: 0, duplicates: 0, backoffMs: 0,
			};
			this.onCycle?.(result);
			return result;
		}

		// Read new seals
		const seals = readNewSeals(this.sealsPath, cursor.last_seal_synced);

		// Build envelope
		const firstHash = (events[0] as any).event_hash ?? null;
		const lastHash = (events[events.length - 1] as any).event_hash ?? null;
		const relayTip = (events[events.length - 1] as any)._relay_hash ?? null;

		const envelope: SyncEnvelope = signEnvelope({
			schema_version: 1,
			type: "event-batch",
			machine_id: this.config.machine_id,
			machine_name: "",
			developer_id: this.config.developer_name,
			team_id: this.config.team_id,
			events,
			seals: seals.length > 0 ? seals : undefined,
			batch_hash: computeBatchHash(events),
			first_event_hash: firstHash,
			last_event_hash: lastHash,
			relay_chain_tip: relayTip,
			signature: "",
			signed_at: "",
			byte_offset_start: cursor.last_synced_offset,
			byte_offset_end: newByteOffset,
		}, this.config.api_key);

		// Push to server
		try {
			const resp = await pushBatch(
				this.config.server_url,
				this.config.api_key,
				envelope,
			);

			if (resp.ok) {
				// Advance cursor
				const lastSeal = seals.length > 0 ? (seals[seals.length - 1] as any).sealed_at : cursor.last_seal_synced;
				const newCursor: SyncCursor = {
					schema_version: 1,
					last_synced_offset: newByteOffset,
					last_synced_event_hash: lastHash,
					last_synced_at: new Date().toISOString(),
					last_seal_synced: lastSeal,
					consecutive_failures: 0,
				};
				writeCursor(newCursor, this.cursorPath);

				const result: CycleResult = {
					eventsPushed: events.length,
					sealsPushed: seals.length,
					accepted: resp.accepted ?? 0,
					duplicates: resp.duplicates ?? 0,
					backoffMs: 0,
				};
				this.onCycle?.(result);
				return result;
			}

			// Server rejected
			const newCursor: SyncCursor = {
				...cursor,
				consecutive_failures: cursor.consecutive_failures + 1,
				last_synced_at: new Date().toISOString(),
			};
			writeCursor(newCursor, this.cursorPath);

			const result: CycleResult = {
				eventsPushed: 0, sealsPushed: 0, accepted: 0, duplicates: 0,
				backoffMs: computeBackoffMs(newCursor.consecutive_failures),
				error: resp.error ?? "Server rejected batch",
			};
			this.onCycle?.(result);
			return result;
		} catch (err: unknown) {
			// Network error
			const newCursor: SyncCursor = {
				...cursor,
				consecutive_failures: cursor.consecutive_failures + 1,
				last_synced_at: new Date().toISOString(),
			};
			writeCursor(newCursor, this.cursorPath);

			const errMsg = err instanceof Error ? err.message : String(err);
			const result: CycleResult = {
				eventsPushed: 0, sealsPushed: 0, accepted: 0, duplicates: 0,
				backoffMs: computeBackoffMs(newCursor.consecutive_failures),
				error: errMsg,
			};
			this.onCycle?.(result);
			return result;
		}
	}
}
