import { describe, it, expect, beforeAll } from "vitest";
import { Hono } from "hono";
import { JsonlStore, type Store, type SearchableStore } from "@patchwork/core";
import { createApp } from "../src/server.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const testDir = join(tmpdir(), `patchwork-web-test-${Date.now()}`);
const eventsPath = join(testDir, "events.jsonl");

function makeEvent(overrides: Record<string, any> = {}) {
	return {
		id: `evt_${Math.random().toString(36).slice(2)}`,
		session_id: "ses_test_001",
		timestamp: new Date().toISOString(),
		agent: "claude-code",
		action: "file_read",
		status: "completed",
		target: { type: "file", path: "src/index.ts" },
		project: { root: "/tmp/test", name: "test-project" },
		risk: { level: "low", flags: [] },
		...overrides,
	};
}

let app: Hono;

beforeAll(() => {
	mkdirSync(testDir, { recursive: true });

	const events = [
		makeEvent({ action: "session_start", risk: { level: "none", flags: [] } }),
		makeEvent({ action: "file_read", target: { type: "file", path: "src/main.ts" } }),
		makeEvent({ action: "file_write", target: { type: "file", path: "src/out.ts" }, risk: { level: "medium", flags: [] } }),
		makeEvent({ action: "command_execute", target: { type: "command", command: "npm test" }, risk: { level: "medium", flags: [] } }),
		makeEvent({ action: "command_execute", target: { type: "command", command: "rm -rf /" }, risk: { level: "critical", flags: ["dangerous_command"] }, status: "denied" }),
		makeEvent({ action: "session_end", risk: { level: "none", flags: [] } }),
	];

	writeFileSync(eventsPath, events.map(e => JSON.stringify(e)).join("\n") + "\n");

	const store = new JsonlStore(eventsPath);
	app = createApp(store, null, testDir);
});

describe("dashboard routes", () => {
	it("GET / returns 200 with overview page", async () => {
		const res = await app.request("/");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("Dashboard");
		expect(html).toContain("Total Events");
	});

	it("GET /events returns 200 with event table", async () => {
		const res = await app.request("/events");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("Event Log");
		expect(html).toContain("file_read");
	});

	it("GET /sessions returns 200 with session list", async () => {
		const res = await app.request("/sessions");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("Sessions");
		expect(html).toContain("ses_test_001");
	});

	it("GET /sessions/:id returns session detail", async () => {
		const res = await app.request("/sessions/ses_test_001");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("Timeline");
		expect(html).toContain("file_read");
	});

	it("GET /risk returns 200 with risk dashboard", async () => {
		const res = await app.request("/risk");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("Risk Dashboard");
		expect(html).toContain("Critical");
	});

	it("GET /search returns 200", async () => {
		const res = await app.request("/search");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("Search");
	});

	it("GET /settings returns 200 with status", async () => {
		const res = await app.request("/settings");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("Settings");
		expect(html).toContain("Total Events");
	});

	it("GET /api/stats returns JSON", async () => {
		const res = await app.request("/api/stats");
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.totalEvents).toBe(6);
		expect(json.byAction).toBeDefined();
		expect(json.byRisk).toBeDefined();
	});

	it("GET /api/sessions returns JSON", async () => {
		const res = await app.request("/api/sessions");
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json).toHaveLength(1);
		expect(json[0].id).toBe("ses_test_001");
	});

	it("GET /api/events returns JSON with filtering", async () => {
		const res = await app.request("/api/events?risk=critical");
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.length).toBeGreaterThanOrEqual(1);
		expect(json[0].risk.level).toBe("critical");
	});

	it("htmx partial GET /partials/events returns HTML fragment", async () => {
		const res = await app.request("/partials/events");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("file_read");
		expect(html).not.toContain("<!DOCTYPE");
	});

	it("denied events show on risk dashboard", async () => {
		const res = await app.request("/risk");
		const html = await res.text();
		expect(html).toContain("Denied");
		expect(html).toContain("rm -rf /");
	});
});
