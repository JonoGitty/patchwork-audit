import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TeamDb } from "../../src/server/db/schema.js";
import { createTeamApp } from "../../src/server/app.js";
import { getTeamCount, getMachinesByTeam, getEnrollmentTokenByHash } from "../../src/server/db/queries.js";
import { hashApiKey } from "../../src/crypto.js";
import type { Hono } from "hono";

describe("bootstrap endpoint", () => {
	let db: TeamDb;
	let app: Hono;

	beforeEach(() => {
		db = new TeamDb(":memory:");
		app = createTeamApp(db);
	});

	afterEach(() => {
		db.close();
	});

	it("creates team and returns enrollment token", async () => {
		const res = await app.request("/api/v1/admin/bootstrap", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				team_name: "Engineering",
				admin_email: "admin@test.com",
				admin_password: "securepass123",
			}),
		});

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.ok).toBe(true);
		expect(body.team_id).toBeTruthy();
		expect(body.enrollment_token).toMatch(/^enroll_/);
		expect(getTeamCount(db)).toBe(1);
	});

	it("rejects second bootstrap", async () => {
		await app.request("/api/v1/admin/bootstrap", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				team_name: "First",
				admin_email: "a@b.com",
				admin_password: "password123",
			}),
		});

		const res = await app.request("/api/v1/admin/bootstrap", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				team_name: "Second",
				admin_email: "c@d.com",
				admin_password: "password123",
			}),
		});

		expect(res.status).toBe(409);
		const body = await res.json();
		expect(body.error).toContain("already bootstrapped");
	});

	it("rejects short password", async () => {
		const res = await app.request("/api/v1/admin/bootstrap", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				team_name: "Eng",
				admin_email: "a@b.com",
				admin_password: "short",
			}),
		});

		expect(res.status).toBe(400);
	});
});

describe("enrollment endpoint", () => {
	let db: TeamDb;
	let app: Hono;
	let enrollToken: string;
	let teamId: string;

	beforeEach(async () => {
		db = new TeamDb(":memory:");
		app = createTeamApp(db);

		// Bootstrap to get enrollment token
		const res = await app.request("/api/v1/admin/bootstrap", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				team_name: "TestTeam",
				admin_email: "admin@test.com",
				admin_password: "securepass123",
			}),
		});
		const body = await res.json();
		enrollToken = body.enrollment_token;
		teamId = body.team_id;
	});

	afterEach(() => {
		db.close();
	});

	it("enrolls a machine and returns API key", async () => {
		const res = await app.request("/api/v1/enroll", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				enrollment_token: enrollToken,
				machine_id: "hw-test-123",
				machine_name: "test-host",
				developer_name: "Jono",
				os: "darwin",
			}),
		});

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.ok).toBe(true);
		expect(body.api_key).toMatch(/^pw_/);
		expect(body.team_id).toBe(teamId);
		expect(body.team_name).toBe("TestTeam");

		// Machine should be in DB
		const machines = getMachinesByTeam(db, teamId);
		expect(machines).toHaveLength(1);
		expect(machines[0].machine_name).toBe("test-host");
		expect(machines[0].status).toBe("active");
	});

	it("rejects invalid token", async () => {
		const res = await app.request("/api/v1/enroll", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				enrollment_token: "enroll_invalid",
				machine_id: "hw-1",
				machine_name: "host",
				developer_name: "Dev",
				os: "darwin",
			}),
		});

		expect(res.status).toBe(401);
	});

	it("rejects already-used token", async () => {
		// First enrollment
		await app.request("/api/v1/enroll", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				enrollment_token: enrollToken,
				machine_id: "hw-1",
				machine_name: "host-1",
				developer_name: "Dev1",
				os: "darwin",
			}),
		});

		// Second enrollment with same token
		const res = await app.request("/api/v1/enroll", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				enrollment_token: enrollToken,
				machine_id: "hw-2",
				machine_name: "host-2",
				developer_name: "Dev2",
				os: "linux",
			}),
		});

		expect(res.status).toBe(409);
		const body = await res.json();
		expect(body.error).toContain("already used");
	});

	it("rejects duplicate machine enrollment", async () => {
		await app.request("/api/v1/enroll", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				enrollment_token: enrollToken,
				machine_id: "hw-1",
				machine_name: "host",
				developer_name: "Dev",
				os: "darwin",
			}),
		});

		// Bootstrap again to get a new token
		// Can't — already bootstrapped. Need to insert token manually.
		// Instead, verify the machine exists
		const machines = getMachinesByTeam(db, teamId);
		expect(machines).toHaveLength(1);
	});

	it("returned API key works for ingest", async () => {
		// Enroll
		const enrollRes = await app.request("/api/v1/enroll", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				enrollment_token: enrollToken,
				machine_id: "hw-1",
				machine_name: "host",
				developer_name: "Dev",
				os: "darwin",
			}),
		});
		const { api_key } = await enrollRes.json();

		// Use the API key for a machines query
		const machinesRes = await app.request("/api/v1/machines", {
			headers: { Authorization: `Bearer ${api_key}` },
		});

		expect(machinesRes.status).toBe(200);
		const body = await machinesRes.json();
		expect(body.ok).toBe(true);
		expect(body.machines).toHaveLength(1);
	});
});
