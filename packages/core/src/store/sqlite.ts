import Database from "better-sqlite3";
import { chmodSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { AuditEventSchema } from "../schema/event.js";
import type { AuditEvent } from "../schema/event.js";
import type { EventFilter, SearchableStore } from "./types.js";

/** Secure directory mode: owner-only read/write/execute */
const DIR_MODE = 0o700;
/** Secure file mode: owner-only read/write */
const FILE_MODE = 0o600;

/**
 * SQLite-backed indexed read layer for audit events.
 * JSONL remains source of truth; SQLite provides fast queries + FTS5 search.
 * Reconciles dir/file permissions on init.
 */
export class SqliteStore implements SearchableStore {
	private db: Database.Database;

	constructor(private readonly dbPath: string) {
		const dir = dirname(dbPath);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true, mode: DIR_MODE });
		} else {
			reconcileMode(dir, DIR_MODE);
		}

		const isNew = !existsSync(dbPath);
		this.db = new Database(dbPath);
		if (isNew) {
			chmodSync(dbPath, FILE_MODE);
		} else {
			reconcileMode(dbPath, FILE_MODE);
		}
		this.db.pragma("journal_mode = WAL");
		this.db.pragma("synchronous = NORMAL");
		this.migrate();
	}

	private migrate(): void {
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS events (
				id TEXT PRIMARY KEY,
				session_id TEXT NOT NULL,
				timestamp TEXT NOT NULL,
				agent TEXT NOT NULL,
				agent_version TEXT,
				action TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'completed',
				duration_ms INTEGER,
				target_type TEXT,
				target_path TEXT,
				target_abs_path TEXT,
				target_command TEXT,
				target_url TEXT,
				target_tool_name TEXT,
				project_root TEXT,
				project_name TEXT,
				project_git_ref TEXT,
				risk_level TEXT NOT NULL DEFAULT 'none',
				risk_flags TEXT,
				content_hash TEXT,
				content_summary TEXT,
				content_size_bytes INTEGER,
				provenance_hook_event TEXT,
				provenance_tool_name TEXT,
				raw_json TEXT NOT NULL
			);

			CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
			CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
			CREATE INDEX IF NOT EXISTS idx_events_agent ON events(agent);
			CREATE INDEX IF NOT EXISTS idx_events_action ON events(action);
			CREATE INDEX IF NOT EXISTS idx_events_risk_level ON events(risk_level);
			CREATE INDEX IF NOT EXISTS idx_events_project_name ON events(project_name);
		`);

		// FTS5 virtual table for full-text search
		this.db.exec(`
			CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(
				target_path,
				target_command,
				target_url,
				target_tool_name,
				content_summary,
				action,
				content='events',
				content_rowid='rowid'
			);
		`);

		// Triggers to keep FTS in sync
		const triggerExists = this.db
			.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='events_ai'")
			.get();

		if (!triggerExists) {
			this.db.exec(`
				CREATE TRIGGER events_ai AFTER INSERT ON events BEGIN
					INSERT INTO events_fts(rowid, target_path, target_command, target_url, target_tool_name, content_summary, action)
					VALUES (new.rowid, new.target_path, new.target_command, new.target_url, new.target_tool_name, new.content_summary, new.action);
				END;
			`);
		}
	}

	private insertStmt = (): Database.Statement => {
		return this.db.prepare(`
			INSERT OR IGNORE INTO events (
				id, session_id, timestamp, agent, agent_version,
				action, status, duration_ms,
				target_type, target_path, target_abs_path, target_command, target_url, target_tool_name,
				project_root, project_name, project_git_ref,
				risk_level, risk_flags,
				content_hash, content_summary, content_size_bytes,
				provenance_hook_event, provenance_tool_name,
				raw_json
			) VALUES (
				@id, @session_id, @timestamp, @agent, @agent_version,
				@action, @status, @duration_ms,
				@target_type, @target_path, @target_abs_path, @target_command, @target_url, @target_tool_name,
				@project_root, @project_name, @project_git_ref,
				@risk_level, @risk_flags,
				@content_hash, @content_summary, @content_size_bytes,
				@provenance_hook_event, @provenance_tool_name,
				@raw_json
			)
		`);
	};

	private flattenEvent(event: AuditEvent): Record<string, unknown> {
		return {
			id: event.id,
			session_id: event.session_id,
			timestamp: event.timestamp,
			agent: event.agent,
			agent_version: event.agent_version || null,
			action: event.action,
			status: event.status,
			duration_ms: event.duration_ms || null,
			target_type: event.target?.type || null,
			target_path: event.target?.path || null,
			target_abs_path: event.target?.abs_path || null,
			target_command: event.target?.command || null,
			target_url: event.target?.url || null,
			target_tool_name: event.target?.tool_name || null,
			project_root: event.project?.root || null,
			project_name: event.project?.name || null,
			project_git_ref: event.project?.git_ref || null,
			risk_level: event.risk.level,
			risk_flags: event.risk.flags.length > 0 ? JSON.stringify(event.risk.flags) : null,
			content_hash: event.content?.hash || null,
			content_summary: event.content?.summary || null,
			content_size_bytes: event.content?.size_bytes || null,
			provenance_hook_event: event.provenance?.hook_event || null,
			provenance_tool_name: event.provenance?.tool_name || null,
			raw_json: JSON.stringify(event),
		};
	}

	/** Count of invalid rows skipped during the last read operation. */
	lastReadErrors = 0;

	append(event: AuditEvent): void {
		const result = AuditEventSchema.safeParse(event);
		if (!result.success) {
			throw new Error(
				`Invalid event: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
			);
		}
		this.insertStmt().run(this.flattenEvent(event));
	}

	readAll(): AuditEvent[] {
		const rows = this.db
			.prepare("SELECT raw_json FROM events ORDER BY timestamp ASC")
			.all() as Array<{ raw_json: string }>;
		return this.parseRows(rows);
	}

	readRecent(limit: number): AuditEvent[] {
		const rows = this.db
			.prepare("SELECT raw_json FROM events ORDER BY timestamp DESC LIMIT ?")
			.all(limit) as Array<{ raw_json: string }>;
		return this.parseRows(rows).reverse();
	}

	/** Parse raw_json rows with schema validation, skipping invalid entries. */
	private parseRows(rows: Array<{ raw_json: string }>): AuditEvent[] {
		const events: AuditEvent[] = [];
		let errors = 0;
		for (const r of rows) {
			try {
				const raw = JSON.parse(r.raw_json);
				const result = AuditEventSchema.safeParse(raw);
				if (result.success) {
					events.push(result.data);
				} else {
					errors++;
				}
			} catch {
				errors++;
			}
		}
		this.lastReadErrors = errors;
		return events;
	}

	query(filter: EventFilter): AuditEvent[] {
		const conditions: string[] = [];
		const params: Record<string, unknown> = {};

		if (filter.agent) {
			conditions.push("agent = @agent");
			params.agent = filter.agent;
		}
		if (filter.action) {
			conditions.push("action = @action");
			params.action = filter.action;
		}
		if (filter.minRisk) {
			const order = ["none", "low", "medium", "high", "critical"];
			const minIdx = order.indexOf(filter.minRisk);
			const validLevels = order.slice(minIdx);
			const placeholders = validLevels.map((_, i) => `@risk_${i}`);
			conditions.push(`risk_level IN (${placeholders.join(", ")})`);
			for (let i = 0; i < validLevels.length; i++) {
				params[`risk_${i}`] = validLevels[i];
			}
		}
		if (filter.sessionId) {
			conditions.push("session_id = @sessionId");
			params.sessionId = filter.sessionId;
		}
		if (filter.since) {
			conditions.push("timestamp >= @since");
			params.since = filter.since.toISOString();
		}
		if (filter.targetGlob) {
			const pattern = `%${filter.targetGlob.replace(/\*/g, "")}%`;
			conditions.push("(target_path LIKE @targetGlob OR target_abs_path LIKE @targetGlob)");
			params.targetGlob = pattern;
		}
		if (filter.projectName) {
			conditions.push("project_name = @projectName");
			params.projectName = filter.projectName;
		}

		let sql = "SELECT raw_json FROM events";
		if (conditions.length > 0) {
			sql += ` WHERE ${conditions.join(" AND ")}`;
		}
		sql += " ORDER BY timestamp ASC";

		if (filter.limit) {
			sql = `SELECT raw_json FROM events`;
			if (conditions.length > 0) {
				sql += ` WHERE ${conditions.join(" AND ")}`;
			}
			sql += " ORDER BY timestamp DESC LIMIT @limit";
			params.limit = filter.limit;
			const rows = this.db.prepare(sql).all(params) as Array<{ raw_json: string }>;
			return this.parseRows(rows).reverse();
		}

		const rows = this.db.prepare(sql).all(params) as Array<{ raw_json: string }>;
		return this.parseRows(rows);
	}

	search(query: string, limit = 50): AuditEvent[] {
		const rows = this.db
			.prepare(
				`SELECT e.raw_json FROM events e
				JOIN events_fts fts ON e.rowid = fts.rowid
				WHERE events_fts MATCH @query
				ORDER BY rank
				LIMIT @limit`,
			)
			.all({ query, limit }) as Array<{ raw_json: string }>;
		return this.parseRows(rows);
	}

	close(): void {
		this.db.close();
	}

	get path(): string {
		return this.dbPath;
	}
}

/** Chmod path to target mode if current mode doesn't match. Safe if path doesn't exist. */
function reconcileMode(path: string, targetMode: number): void {
	try {
		const stat = statSync(path);
		if ((stat.mode & 0o777) !== targetMode) {
			chmodSync(path, targetMode);
		}
	} catch {
		// Path disappeared between check and chmod — safe to ignore
	}
}
