import { existsSync } from "node:fs";
import { join } from "node:path";
import { JsonlStore, SqliteStore, type Store, type SearchableStore } from "@patchwork/core";

const DATA_DIR = join(process.env.HOME || "~", ".patchwork");
const EVENTS_PATH = join(DATA_DIR, "events.jsonl");
const DB_PATH = join(DATA_DIR, "db", "audit.db");
const SEAL_KEY_PATH = join(DATA_DIR, "keys", "seal.key");
const KEYRING_DIR = join(DATA_DIR, "keys", "seal");
const SEALS_PATH = join(DATA_DIR, "seals.jsonl");
const DIVERGENCE_MARKER_PATH = join(DATA_DIR, "state", "sqlite-divergence.json");

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

export { EVENTS_PATH, DB_PATH, DATA_DIR, SEAL_KEY_PATH, KEYRING_DIR, SEALS_PATH, DIVERGENCE_MARKER_PATH };
