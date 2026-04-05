import { existsSync } from "node:fs";
import { join } from "node:path";
import { JsonlStore, SqliteStore, type Store, type SearchableStore, getHomeDir } from "@patchwork/core";

const DATA_DIR = join(getHomeDir(), ".patchwork");
const EVENTS_PATH = join(DATA_DIR, "events.jsonl");
const DB_PATH = join(DATA_DIR, "db", "audit.db");
const SEAL_KEY_PATH = join(DATA_DIR, "keys", "seal.key");
const KEYRING_DIR = join(DATA_DIR, "keys", "seal");
const SEALS_PATH = join(DATA_DIR, "seals.jsonl");
const DIVERGENCE_MARKER_PATH = join(DATA_DIR, "state", "sqlite-divergence.json");
const SYNC_REPORT_PATH = join(DATA_DIR, "state", "sync-db-last-failures.json");
const PRETOOL_TELEMETRY_PATH = join(DATA_DIR, "telemetry", "pretool.jsonl");
const WITNESSES_PATH = join(DATA_DIR, "witnesses.jsonl");
const ATTESTATIONS_DIR = join(DATA_DIR, "attestations");
const ATTESTATION_PATH = join(ATTESTATIONS_DIR, "latest.json");
const COMMIT_ATTESTATIONS_DIR = join(DATA_DIR, "commit-attestations");
const COMMIT_ATTESTATION_INDEX = join(COMMIT_ATTESTATIONS_DIR, "index.jsonl");
const REPORTS_DIR = join(DATA_DIR, "reports");

export function getReadStore(): Store {
	if (existsSync(DB_PATH)) {
		try {
			return new SqliteStore(DB_PATH);
		} catch {
			// Fall back to JSONL
		}
	}
	return new JsonlStore(EVENTS_PATH);
}

export function getSearchStore(): SearchableStore | null {
	if (existsSync(DB_PATH)) {
		try {
			return new SqliteStore(DB_PATH);
		} catch {
			return null;
		}
	}
	return null;
}

export { EVENTS_PATH, DB_PATH, DATA_DIR, SEAL_KEY_PATH, KEYRING_DIR, SEALS_PATH, DIVERGENCE_MARKER_PATH, SYNC_REPORT_PATH, PRETOOL_TELEMETRY_PATH, WITNESSES_PATH, ATTESTATIONS_DIR, ATTESTATION_PATH, COMMIT_ATTESTATIONS_DIR, COMMIT_ATTESTATION_INDEX, REPORTS_DIR };
