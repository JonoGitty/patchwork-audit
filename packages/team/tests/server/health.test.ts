import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TeamDb } from "../../src/server/db/schema.js";
import { createTeamApp } from "../../src/server/app.js";
import type { Hono } from "hono";

describe("health endpoint", () => {
	let db: TeamDb;
	let app: Hono;

	beforeEach(() => {
		db = new TeamDb(":memory:");
		app = createTeamApp(db);
	});

	afterEach(() => {
		db.close();
	});

	it("returns 200 with ok:true", async () => {
		const res = await app.request("/api/v1/health");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.ok).toBe(true);
		expect(body.version).toBeDefined();
		expect(body.uptime_ms).toBeGreaterThanOrEqual(0);
	});
});
