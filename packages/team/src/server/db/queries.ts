/**
 * Prepared query builders for the team server database.
 */

import type { TeamDb } from "./schema.js";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export function insertTeam(db: TeamDb, name: string): string {
	const id = randomUUID();
	db.db.prepare("INSERT INTO teams (id, name) VALUES (?, ?)").run(id, name);
	return id;
}

export function getTeam(db: TeamDb, id: string) {
	return db.db.prepare("SELECT * FROM teams WHERE id = ?").get(id) as any | undefined;
}

export function getTeamCount(db: TeamDb): number {
	const row = db.db.prepare("SELECT COUNT(*) as count FROM teams").get() as any;
	return row.count;
}

// ---------------------------------------------------------------------------
// Team members
// ---------------------------------------------------------------------------

export function insertTeamMember(
	db: TeamDb,
	teamId: string,
	email: string,
	name: string,
	role: string,
	passwordHash: string,
): string {
	const id = randomUUID();
	db.db.prepare(
		"INSERT INTO team_members (id, team_id, email, name, role, password_hash) VALUES (?, ?, ?, ?, ?, ?)",
	).run(id, teamId, email, name, role, passwordHash);
	return id;
}

// ---------------------------------------------------------------------------
// Machines
// ---------------------------------------------------------------------------

export function insertMachine(
	db: TeamDb,
	teamId: string,
	machineId: string,
	machineName: string,
	developerName: string,
	apiKeyHash: string,
	os?: string,
): string {
	const id = randomUUID();
	db.db.prepare(
		`INSERT INTO machines (id, team_id, machine_id, machine_name, developer_name, api_key_hash, os)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
	).run(id, teamId, machineId, machineName, developerName, apiKeyHash, os ?? null);
	return id;
}

export function getMachineByApiKeyHash(db: TeamDb, apiKeyHash: string) {
	return db.db.prepare("SELECT * FROM machines WHERE api_key_hash = ?").get(apiKeyHash) as any | undefined;
}

export function getMachineByMachineId(db: TeamDb, teamId: string, machineId: string) {
	return db.db.prepare(
		"SELECT * FROM machines WHERE team_id = ? AND machine_id = ?",
	).get(teamId, machineId) as any | undefined;
}

export function getMachinesByTeam(db: TeamDb, teamId: string) {
	return db.db.prepare(
		"SELECT * FROM machines WHERE team_id = ? ORDER BY last_seen_at DESC",
	).all(teamId) as any[];
}

export function updateMachineSync(
	db: TeamDb,
	machineDbId: string,
	chainTip: string | null,
): void {
	const now = new Date().toISOString();
	db.db.prepare(
		"UPDATE machines SET last_seen_at = ?, last_sync_at = ?, last_chain_tip = ? WHERE id = ?",
	).run(now, now, chainTip, machineDbId);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface EventInsert {
	id: string;
	machine_id: string;
	team_id: string;
	session_id: string;
	timestamp: string;
	agent: string;
	action: string;
	status: string;
	target_type?: string;
	target_path?: string;
	target_command?: string;
	risk_level: string;
	risk_flags?: string;
	event_hash?: string;
	prev_hash?: string;
	relay_hash?: string;
	project_name?: string;
	raw_json: string;
}

/**
 * Bulk insert events in a transaction. Skips duplicates (ON CONFLICT DO NOTHING).
 * Returns the number of accepted (non-duplicate) events.
 */
export function insertEvents(db: TeamDb, events: EventInsert[]): { accepted: number; duplicates: number } {
	const stmt = db.db.prepare(
		`INSERT OR IGNORE INTO events
		 (id, machine_id, team_id, session_id, timestamp, agent, action, status,
		  target_type, target_path, target_command, risk_level, risk_flags,
		  event_hash, prev_hash, relay_hash, project_name, raw_json)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	);

	let accepted = 0;
	const run = db.db.transaction((rows: EventInsert[]) => {
		for (const e of rows) {
			const result = stmt.run(
				e.id, e.machine_id, e.team_id, e.session_id, e.timestamp,
				e.agent, e.action, e.status,
				e.target_type ?? null, e.target_path ?? null, e.target_command ?? null,
				e.risk_level, e.risk_flags ?? null,
				e.event_hash ?? null, e.prev_hash ?? null, e.relay_hash ?? null,
				e.project_name ?? null, e.raw_json,
			);
			if (result.changes > 0) accepted++;
		}
	});

	run(events);
	return { accepted, duplicates: events.length - accepted };
}

export function getEventsByTeam(db: TeamDb, teamId: string, limit = 100) {
	return db.db.prepare(
		"SELECT * FROM events WHERE team_id = ? ORDER BY timestamp DESC LIMIT ?",
	).all(teamId, limit) as any[];
}

export function getEventsByMachine(db: TeamDb, machineDbId: string, limit = 100) {
	return db.db.prepare(
		"SELECT * FROM events WHERE machine_id = ? ORDER BY timestamp DESC LIMIT ?",
	).all(machineDbId, limit) as any[];
}

export function getTeamEventCount(db: TeamDb, teamId: string): number {
	const row = db.db.prepare("SELECT COUNT(*) as count FROM events WHERE team_id = ?").get(teamId) as any;
	return row.count;
}

// ---------------------------------------------------------------------------
// Seals
// ---------------------------------------------------------------------------

export function insertSeal(
	db: TeamDb,
	machineDbId: string,
	teamId: string,
	seal: { sealed_at: string; tip_hash: string; chained_events: number; signature: string; key_id?: string },
): void {
	const id = randomUUID();
	db.db.prepare(
		`INSERT OR IGNORE INTO seals (id, machine_id, team_id, sealed_at, tip_hash, chained_events, signature, key_id)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(id, machineDbId, teamId, seal.sealed_at, seal.tip_hash, seal.chained_events, seal.signature, seal.key_id ?? null);
}

// ---------------------------------------------------------------------------
// Enrollment tokens
// ---------------------------------------------------------------------------

export function insertEnrollmentToken(
	db: TeamDb,
	teamId: string,
	tokenHash: string,
	expiresAt: string,
	createdBy?: string,
): string {
	const id = randomUUID();
	db.db.prepare(
		"INSERT INTO enrollment_tokens (id, team_id, token_hash, expires_at, created_by) VALUES (?, ?, ?, ?, ?)",
	).run(id, teamId, tokenHash, expiresAt, createdBy ?? null);
	return id;
}

export function getEnrollmentTokenByHash(db: TeamDb, tokenHash: string) {
	return db.db.prepare(
		"SELECT * FROM enrollment_tokens WHERE token_hash = ?",
	).get(tokenHash) as any | undefined;
}

export function markTokenUsed(db: TeamDb, tokenId: string, machineDbId: string): void {
	db.db.prepare(
		"UPDATE enrollment_tokens SET used_at = datetime('now'), used_by_machine_id = ? WHERE id = ?",
	).run(machineDbId, tokenId);
}
