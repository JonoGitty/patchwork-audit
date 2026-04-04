import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TeamDb } from "../../src/server/db/schema.js";
import {
	insertTeam,
	getTeam,
	getTeamCount,
	insertMachine,
	getMachineByApiKeyHash,
	getMachinesByTeam,
	insertEvents,
	getEventsByTeam,
	getTeamEventCount,
	type EventInsert,
} from "../../src/server/db/queries.js";

describe("TeamDb", () => {
	let db: TeamDb;

	beforeEach(() => {
		db = new TeamDb(":memory:");
	});

	afterEach(() => {
		db.close();
	});

	it("creates all tables on init", () => {
		const tables = db.db
			.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
			.all() as any[];
		const names = tables.map((t) => t.name);
		expect(names).toContain("teams");
		expect(names).toContain("team_members");
		expect(names).toContain("machines");
		expect(names).toContain("events");
		expect(names).toContain("seals");
		expect(names).toContain("enrollment_tokens");
	});

	it("sets WAL mode (falls back to memory for :memory: dbs)", () => {
		const mode = db.db.pragma("journal_mode") as any[];
		// :memory: databases use 'memory' journal mode; on-disk uses WAL
		expect(["wal", "memory"]).toContain(mode[0].journal_mode);
	});
});

describe("Team queries", () => {
	let db: TeamDb;

	beforeEach(() => {
		db = new TeamDb(":memory:");
	});

	afterEach(() => {
		db.close();
	});

	it("inserts and retrieves a team", () => {
		const id = insertTeam(db, "Engineering");
		const team = getTeam(db, id);
		expect(team).toBeDefined();
		expect(team.name).toBe("Engineering");
		expect(getTeamCount(db)).toBe(1);
	});

	it("enforces unique team names", () => {
		insertTeam(db, "Engineering");
		expect(() => insertTeam(db, "Engineering")).toThrow();
	});
});

describe("Machine queries", () => {
	let db: TeamDb;
	let teamId: string;

	beforeEach(() => {
		db = new TeamDb(":memory:");
		teamId = insertTeam(db, "TestTeam");
	});

	afterEach(() => {
		db.close();
	});

	it("inserts and retrieves a machine by API key hash", () => {
		insertMachine(db, teamId, "hw-abc", "test-host", "Jono", "sha256:keyhash", "darwin");
		const machine = getMachineByApiKeyHash(db, "sha256:keyhash");
		expect(machine).toBeDefined();
		expect(machine.machine_name).toBe("test-host");
		expect(machine.developer_name).toBe("Jono");
		expect(machine.status).toBe("active");
	});

	it("lists machines by team", () => {
		insertMachine(db, teamId, "hw-1", "host-1", "Dev1", "sha256:k1", "darwin");
		insertMachine(db, teamId, "hw-2", "host-2", "Dev2", "sha256:k2", "linux");
		const machines = getMachinesByTeam(db, teamId);
		expect(machines).toHaveLength(2);
	});

	it("enforces unique machine_id per team", () => {
		insertMachine(db, teamId, "hw-1", "host-1", "Dev1", "sha256:k1");
		expect(() => insertMachine(db, teamId, "hw-1", "host-2", "Dev2", "sha256:k2")).toThrow();
	});
});

describe("Event queries", () => {
	let db: TeamDb;
	let teamId: string;
	let machineDbId: string;

	beforeEach(() => {
		db = new TeamDb(":memory:");
		teamId = insertTeam(db, "TestTeam");
		machineDbId = insertMachine(db, teamId, "hw-1", "host", "Dev", "sha256:k");
	});

	afterEach(() => {
		db.close();
	});

	function makeEvent(id: string): EventInsert {
		return {
			id,
			machine_id: machineDbId,
			team_id: teamId,
			session_id: "ses_1",
			timestamp: new Date().toISOString(),
			agent: "claude-code",
			action: "file_read",
			status: "completed",
			risk_level: "low",
			raw_json: JSON.stringify({ id, action: "file_read" }),
		};
	}

	it("inserts and retrieves events", () => {
		const { accepted } = insertEvents(db, [makeEvent("evt_1"), makeEvent("evt_2")]);
		expect(accepted).toBe(2);
		const events = getEventsByTeam(db, teamId);
		expect(events).toHaveLength(2);
	});

	it("handles duplicates idempotently", () => {
		insertEvents(db, [makeEvent("evt_1")]);
		const { accepted, duplicates } = insertEvents(db, [makeEvent("evt_1"), makeEvent("evt_2")]);
		expect(accepted).toBe(1);
		expect(duplicates).toBe(1);
		expect(getTeamEventCount(db, teamId)).toBe(2);
	});

	it("bulk inserts in a transaction", () => {
		const events = Array.from({ length: 100 }, (_, i) => makeEvent(`evt_${i}`));
		const { accepted } = insertEvents(db, events);
		expect(accepted).toBe(100);
		expect(getTeamEventCount(db, teamId)).toBe(100);
	});
});
