import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TeamDb } from "../../src/server/db/schema.js";
import { createTeamApp } from "../../src/server/app.js";
import { insertTeam, insertMachine, getTeamEventCount, getMachineByApiKeyHash } from "../../src/server/db/queries.js";
import { generateApiKey, hashApiKey, signEnvelope, computeBatchHash } from "../../src/crypto.js";
import type { SyncEnvelope } from "../../src/protocol.js";
import type { Hono } from "hono";

function makeEnvelope(machineId: string, teamId: string, events: any[]): Omit<SyncEnvelope, "signature" | "signed_at"> {
	return {
		schema_version: 1,
		type: "event-batch",
		machine_id: machineId,
		machine_name: "test-host",
		developer_id: "dev1",
		team_id: teamId,
		events,
		batch_hash: computeBatchHash(events),
		first_event_hash: events[0]?.event_hash ?? null,
		last_event_hash: events[events.length - 1]?.event_hash ?? null,
		relay_chain_tip: "sha256:tip123",
		byte_offset_start: 0,
		byte_offset_end: 1024,
	};
}

function makeEvent(id: string) {
	return {
		id,
		session_id: "ses_test",
		timestamp: new Date().toISOString(),
		agent: "claude-code",
		action: "file_read",
		status: "completed",
		risk: { level: "low", flags: [] },
		target: { type: "file", path: "test.ts" },
		project: { root: "/tmp", name: "test" },
	};
}

describe("ingest endpoint", () => {
	let db: TeamDb;
	let app: Hono;
	let teamId: string;
	let apiKey: string;
	let machineHwId: string;

	beforeEach(() => {
		db = new TeamDb(":memory:");
		app = createTeamApp(db);

		teamId = insertTeam(db, "TestTeam");
		apiKey = generateApiKey();
		machineHwId = "hw-test-123";
		insertMachine(db, teamId, machineHwId, "test-host", "Tester", hashApiKey(apiKey), "darwin");
	});

	afterEach(() => {
		db.close();
	});

	it("accepts a valid event batch", async () => {
		const events = [makeEvent("evt_1"), makeEvent("evt_2")];
		const envelope = signEnvelope(
			makeEnvelope(machineHwId, teamId, events) as SyncEnvelope,
			apiKey,
		);

		const res = await app.request("/api/v1/ingest", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(envelope),
		});

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.ok).toBe(true);
		expect(body.accepted).toBe(2);
		expect(body.duplicates).toBe(0);
		expect(getTeamEventCount(db, teamId)).toBe(2);
	});

	it("rejects without auth header", async () => {
		const res = await app.request("/api/v1/ingest", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{}",
		});
		expect(res.status).toBe(401);
	});

	it("rejects with wrong API key", async () => {
		const events = [makeEvent("evt_1")];
		const wrongKey = generateApiKey();
		const envelope = signEnvelope(
			makeEnvelope(machineHwId, teamId, events) as SyncEnvelope,
			wrongKey,
		);

		const res = await app.request("/api/v1/ingest", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${wrongKey}`,
			},
			body: JSON.stringify(envelope),
		});

		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.error).toContain("Unknown API key");
	});

	it("rejects tampered envelope signature", async () => {
		const events = [makeEvent("evt_1")];
		const envelope = signEnvelope(
			makeEnvelope(machineHwId, teamId, events) as SyncEnvelope,
			apiKey,
		);
		// Tamper with events after signing
		envelope.events = [makeEvent("evt_tampered")];

		const res = await app.request("/api/v1/ingest", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(envelope),
		});

		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.error).toContain("signature");
	});

	it("rejects mismatched batch hash", async () => {
		const events = [makeEvent("evt_1")];
		const raw = makeEnvelope(machineHwId, teamId, events);
		raw.batch_hash = "sha256:wrong";
		const envelope = signEnvelope(raw as SyncEnvelope, apiKey);

		const res = await app.request("/api/v1/ingest", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(envelope),
		});

		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("hash mismatch");
	});

	it("handles duplicate events idempotently", async () => {
		const events = [makeEvent("evt_1")];
		const envelope = signEnvelope(
			makeEnvelope(machineHwId, teamId, events) as SyncEnvelope,
			apiKey,
		);

		// First push
		await app.request("/api/v1/ingest", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(envelope),
		});

		// Second push (same events)
		const res = await app.request("/api/v1/ingest", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(envelope),
		});

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.ok).toBe(true);
		expect(body.accepted).toBe(0);
		expect(body.duplicates).toBe(1);
		expect(getTeamEventCount(db, teamId)).toBe(1);
	});

	it("rejects suspended machine", async () => {
		// Suspend the machine
		db.db.prepare("UPDATE machines SET status = 'suspended' WHERE machine_id = ?").run(machineHwId);

		const events = [makeEvent("evt_1")];
		const envelope = signEnvelope(
			makeEnvelope(machineHwId, teamId, events) as SyncEnvelope,
			apiKey,
		);

		const res = await app.request("/api/v1/ingest", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(envelope),
		});

		expect(res.status).toBe(403);
	});

	it("updates machine last_seen_at after ingest", async () => {
		const events = [makeEvent("evt_1")];
		const envelope = signEnvelope(
			makeEnvelope(machineHwId, teamId, events) as SyncEnvelope,
			apiKey,
		);

		await app.request("/api/v1/ingest", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(envelope),
		});

		const machine = getMachineByApiKeyHash(db, hashApiKey(apiKey));
		expect(machine.last_seen_at).toBeTruthy();
		expect(machine.last_sync_at).toBeTruthy();
		expect(machine.last_chain_tip).toBe("sha256:tip123");
	});
});
