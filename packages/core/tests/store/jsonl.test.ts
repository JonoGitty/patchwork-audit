import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JsonlStore } from "../../src/store/jsonl.js";
import type { AuditEvent } from "../../src/schema/event.js";

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
	return {
		id: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
		session_id: "ses_test",
		timestamp: new Date().toISOString(),
		agent: "claude-code",
		action: "file_read",
		status: "completed",
		risk: { level: "low", flags: [] },
		...overrides,
	};
}

describe("JsonlStore", () => {
	let tmpDir: string;
	let store: JsonlStore;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-test-"));
		store = new JsonlStore(join(tmpDir, "events.jsonl"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("starts empty", () => {
		expect(store.readAll()).toEqual([]);
	});

	it("appends and reads a single event", () => {
		const event = makeEvent();
		store.append(event);
		const events = store.readAll();
		expect(events).toHaveLength(1);
		expect(events[0].id).toBe(event.id);
	});

	it("appends multiple events in order", () => {
		const e1 = makeEvent({ action: "file_read" });
		const e2 = makeEvent({ action: "file_write" });
		const e3 = makeEvent({ action: "command_execute" });
		store.append(e1);
		store.append(e2);
		store.append(e3);

		const events = store.readAll();
		expect(events).toHaveLength(3);
		expect(events[0].action).toBe("file_read");
		expect(events[1].action).toBe("file_write");
		expect(events[2].action).toBe("command_execute");
	});

	it("readRecent returns last N events", () => {
		for (let i = 0; i < 10; i++) {
			store.append(makeEvent({ action: `action_${i}` as any }));
		}
		const recent = store.readRecent(3);
		expect(recent).toHaveLength(3);
		expect(recent[0].action).toBe("action_7");
		expect(recent[2].action).toBe("action_9");
	});

	describe("query", () => {
		beforeEach(() => {
			store.append(makeEvent({ agent: "claude-code", action: "file_read", risk: { level: "low", flags: [] } }));
			store.append(makeEvent({ agent: "claude-code", action: "file_write", risk: { level: "medium", flags: [] } }));
			store.append(makeEvent({ agent: "codex", action: "command_execute", risk: { level: "high", flags: ["dangerous_command"] } }));
			store.append(makeEvent({ agent: "claude-code", action: "web_fetch", risk: { level: "medium", flags: ["network_access"] } }));
		});

		it("filters by agent", () => {
			const results = store.query({ agent: "codex" });
			expect(results).toHaveLength(1);
			expect(results[0].action).toBe("command_execute");
		});

		it("filters by action", () => {
			const results = store.query({ action: "file_write" });
			expect(results).toHaveLength(1);
		});

		it("filters by minimum risk level", () => {
			const results = store.query({ minRisk: "medium" });
			expect(results).toHaveLength(3); // medium, high, medium
		});

		it("filters by high risk", () => {
			const results = store.query({ minRisk: "high" });
			expect(results).toHaveLength(1);
		});

		it("filters by session ID", () => {
			store.append(makeEvent({ session_id: "ses_other", action: "file_read" }));
			const results = store.query({ sessionId: "ses_other" });
			expect(results).toHaveLength(1);
		});

		it("respects limit", () => {
			const results = store.query({ limit: 2 });
			expect(results).toHaveLength(2);
		});

		it("filters by project name", () => {
			store.append(
				makeEvent({
					project: { root: "/test/my-project", name: "my-project" },
					action: "file_read",
				}),
			);
			const results = store.query({ projectName: "my-project" });
			expect(results).toHaveLength(1);
		});
	});
});
