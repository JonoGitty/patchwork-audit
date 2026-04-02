/**
 * Patchwork Relay Configuration — schema and loader for relay daemon settings.
 *
 * Config lives at /Library/Patchwork/relay-config.json (root-owned).
 * Controls auto-seal intervals, witness endpoints, and signing behavior.
 */

import { existsSync, readFileSync } from "node:fs";

/** Default config path (root-owned). */
export const RELAY_CONFIG_PATH = "/Library/Patchwork/relay-config.json";

/** Witness endpoint configuration. */
export interface WitnessEndpointConfig {
	/** URL to POST seal anchors to. */
	url: string;
	/** Human-readable name for this endpoint. */
	name: string;
	/** Optional bearer token for authenticated endpoints. */
	auth_token?: string;
}

/** Auto-seal configuration. */
export interface AutoSealConfig {
	/** Whether auto-sealing is enabled. Default: true. */
	enabled: boolean;
	/** Minutes between seal cycles. Default: 15. */
	interval_minutes: number;
	/** Minimum new events before sealing. Prevents sealing empty intervals. Default: 1. */
	min_events_between_seals: number;
}

/** Witness publishing configuration. */
export interface WitnessConfig {
	/** Whether witness publishing is enabled. Default: false (needs endpoints). */
	enabled: boolean;
	/** Witness endpoints to publish seals to. */
	endpoints: WitnessEndpointConfig[];
	/** Minimum successful witnesses for quorum. Default: 1. */
	quorum: number;
}

/** Full relay daemon configuration. */
export interface RelayConfig {
	auto_seal: AutoSealConfig;
	witness: WitnessConfig;
}

/** Default configuration when no config file exists. */
export const DEFAULT_RELAY_CONFIG: RelayConfig = {
	auto_seal: {
		enabled: true,
		interval_minutes: 15,
		min_events_between_seals: 1,
	},
	witness: {
		enabled: false,
		endpoints: [],
		quorum: 1,
	},
};

/**
 * Load relay configuration from disk.
 * Returns default config if file is missing or invalid.
 * Merges partial configs with defaults so missing fields are filled in.
 */
export function loadRelayConfig(configPath?: string): { config: RelayConfig; source: string } {
	const p = configPath ?? RELAY_CONFIG_PATH;

	if (!existsSync(p)) {
		return { config: DEFAULT_RELAY_CONFIG, source: "default" };
	}

	try {
		const raw = readFileSync(p, "utf-8");
		const parsed = JSON.parse(raw);

		// Deep merge with defaults
		const config: RelayConfig = {
			auto_seal: {
				...DEFAULT_RELAY_CONFIG.auto_seal,
				...(parsed.auto_seal || {}),
			},
			witness: {
				...DEFAULT_RELAY_CONFIG.witness,
				...(parsed.witness || {}),
				endpoints: Array.isArray(parsed.witness?.endpoints)
					? parsed.witness.endpoints.filter(
							(e: unknown) =>
								typeof e === "object" &&
								e !== null &&
								typeof (e as Record<string, unknown>).url === "string" &&
								typeof (e as Record<string, unknown>).name === "string",
						)
					: DEFAULT_RELAY_CONFIG.witness.endpoints,
			},
		};

		// Validate ranges
		if (config.auto_seal.interval_minutes < 1) config.auto_seal.interval_minutes = 1;
		if (config.auto_seal.min_events_between_seals < 0) config.auto_seal.min_events_between_seals = 0;
		if (config.witness.quorum < 1) config.witness.quorum = 1;

		return { config, source: p };
	} catch {
		return { config: DEFAULT_RELAY_CONFIG, source: "default (config parse error)" };
	}
}
