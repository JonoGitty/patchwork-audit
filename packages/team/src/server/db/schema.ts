/**
 * Team server SQLite schema and database wrapper.
 *
 * Follows the SqliteStore pattern from @patchwork/core:
 * WAL mode, NORMAL sync, permission reconciliation, migration on init.
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync, chmodSync, statSync } from "node:fs";
import { dirname } from "node:path";

const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

function reconcileMode(path: string, mode: number): void {
	try {
		const stat = statSync(path);
		if ((stat.mode & 0o777) !== mode) chmodSync(path, mode);
	} catch { /* disappeared — safe to ignore */ }
}

export class TeamDb {
	readonly db: Database.Database;

	constructor(dbPath: string) {
		// Use :memory: for testing
		if (dbPath === ":memory:") {
			this.db = new Database(":memory:");
		} else {
			const dir = dirname(dbPath);
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true, mode: DIR_MODE });
			} else {
				reconcileMode(dir, DIR_MODE);
			}
			const isNew = !existsSync(dbPath);
			this.db = new Database(dbPath);
			if (isNew) chmodSync(dbPath, FILE_MODE);
			else reconcileMode(dbPath, FILE_MODE);
		}

		this.db.pragma("journal_mode = WAL");
		this.db.pragma("synchronous = NORMAL");
		this.migrate();
	}

	private migrate(): void {
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS teams (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL UNIQUE,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				settings TEXT NOT NULL DEFAULT '{}'
			);

			CREATE TABLE IF NOT EXISTS team_members (
				id TEXT PRIMARY KEY,
				team_id TEXT NOT NULL REFERENCES teams(id),
				email TEXT NOT NULL,
				name TEXT NOT NULL,
				role TEXT NOT NULL CHECK (role IN ('admin', 'lead', 'viewer')),
				password_hash TEXT NOT NULL,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				last_login TEXT,
				UNIQUE(team_id, email)
			);

			CREATE TABLE IF NOT EXISTS machines (
				id TEXT PRIMARY KEY,
				team_id TEXT NOT NULL REFERENCES teams(id),
				machine_id TEXT NOT NULL,
				machine_name TEXT NOT NULL,
				developer_name TEXT NOT NULL,
				developer_email TEXT,
				api_key_hash TEXT NOT NULL,
				enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
				last_seen_at TEXT,
				last_sync_at TEXT,
				last_chain_tip TEXT,
				last_seal_at TEXT,
				status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
				os TEXT,
				agent_version TEXT,
				UNIQUE(team_id, machine_id)
			);

			CREATE TABLE IF NOT EXISTS events (
				id TEXT NOT NULL,
				machine_id TEXT NOT NULL REFERENCES machines(id),
				team_id TEXT NOT NULL,
				session_id TEXT NOT NULL,
				timestamp TEXT NOT NULL,
				agent TEXT NOT NULL,
				action TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'completed',
				target_type TEXT,
				target_path TEXT,
				target_command TEXT,
				risk_level TEXT NOT NULL DEFAULT 'none',
				risk_flags TEXT,
				event_hash TEXT,
				prev_hash TEXT,
				relay_hash TEXT,
				project_name TEXT,
				raw_json TEXT NOT NULL,
				received_at TEXT NOT NULL DEFAULT (datetime('now')),
				PRIMARY KEY (machine_id, id)
			);

			CREATE INDEX IF NOT EXISTS idx_events_team_ts ON events(team_id, timestamp DESC);
			CREATE INDEX IF NOT EXISTS idx_events_machine ON events(machine_id, timestamp DESC);
			CREATE INDEX IF NOT EXISTS idx_events_session ON events(team_id, session_id);
			CREATE INDEX IF NOT EXISTS idx_events_risk ON events(team_id, risk_level);

			CREATE TABLE IF NOT EXISTS seals (
				id TEXT PRIMARY KEY,
				machine_id TEXT NOT NULL REFERENCES machines(id),
				team_id TEXT NOT NULL,
				sealed_at TEXT NOT NULL,
				tip_hash TEXT NOT NULL,
				chained_events INTEGER NOT NULL,
				signature TEXT NOT NULL,
				key_id TEXT,
				verified INTEGER NOT NULL DEFAULT 0,
				received_at TEXT NOT NULL DEFAULT (datetime('now')),
				UNIQUE(machine_id, tip_hash)
			);

			CREATE TABLE IF NOT EXISTS enrollment_tokens (
				id TEXT PRIMARY KEY,
				team_id TEXT NOT NULL REFERENCES teams(id),
				token_hash TEXT NOT NULL UNIQUE,
				created_by TEXT,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				expires_at TEXT NOT NULL,
				used_at TEXT,
				used_by_machine_id TEXT
			);
		`);
	}

	close(): void {
		this.db.close();
	}
}
