import { describe, it, expect } from "vitest";
import { computeStats } from "../../src/commands/stats.js";
import type { AuditEvent } from "@patchwork/core";

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
	return {
		id: `evt_${Math.random().toString(36).slice(2)}`,
		session_id: "ses_test",
		timestamp: "2026-01-15T10:00:00.000Z",
		agent: "claude-code",
		action: "file_read",
		status: "completed",
		risk: { level: "low", flags: [] },
		...overrides,
	};
}

describe("computeStats", () => {
	it("counts events by action", () => {
		const events = [
			makeEvent({ action: "file_read" }),
			makeEvent({ action: "file_read" }),
			makeEvent({ action: "file_write" }),
		];
		const stats = computeStats(events);
		expect(stats.byAction.file_read).toBe(2);
		expect(stats.byAction.file_write).toBe(1);
	});

	it("counts events by agent", () => {
		const events = [
			makeEvent({ agent: "claude-code" }),
			makeEvent({ agent: "codex" }),
			makeEvent({ agent: "claude-code" }),
		];
		const stats = computeStats(events);
		expect(stats.byAgent["claude-code"]).toBe(2);
		expect(stats.byAgent.codex).toBe(1);
	});

	it("counts events by risk level", () => {
		const events = [
			makeEvent({ risk: { level: "low", flags: [] } }),
			makeEvent({ risk: { level: "high", flags: ["dangerous"] } }),
			makeEvent({ risk: { level: "high", flags: ["sensitive"] } }),
		];
		const stats = computeStats(events);
		expect(stats.byRisk.low).toBe(1);
		expect(stats.byRisk.high).toBe(2);
	});

	it("counts events by day", () => {
		const events = [
			makeEvent({ timestamp: "2026-01-15T10:00:00.000Z" }),
			makeEvent({ timestamp: "2026-01-15T14:00:00.000Z" }),
			makeEvent({ timestamp: "2026-01-16T09:00:00.000Z" }),
		];
		const stats = computeStats(events);
		expect(stats.byDay["2026-01-15"]).toBe(2);
		expect(stats.byDay["2026-01-16"]).toBe(1);
	});

	it("tracks top modified files", () => {
		const events = [
			makeEvent({ action: "file_write", target: { type: "file", path: "src/a.ts" } }),
			makeEvent({ action: "file_edit", target: { type: "file", path: "src/a.ts" } }),
			makeEvent({ action: "file_write", target: { type: "file", path: "src/b.ts" } }),
		];
		const stats = computeStats(events);
		expect(stats.topFiles[0]).toEqual(["src/a.ts", 2]);
		expect(stats.topFiles[1]).toEqual(["src/b.ts", 1]);
	});

	it("tracks top commands", () => {
		const events = [
			makeEvent({ action: "command_execute", target: { type: "command", command: "npm test" } }),
			makeEvent({ action: "command_execute", target: { type: "command", command: "npm test" } }),
			makeEvent({ action: "command_execute", target: { type: "command", command: "npm build" } }),
		];
		const stats = computeStats(events);
		expect(stats.topCommands[0]).toEqual(["npm test", 2]);
		expect(stats.topCommands[1]).toEqual(["npm build", 1]);
	});

	it("returns totalEvents count", () => {
		const events = [makeEvent(), makeEvent(), makeEvent()];
		const stats = computeStats(events);
		expect(stats.totalEvents).toBe(3);
	});

	it("handles empty events", () => {
		const stats = computeStats([]);
		expect(stats.totalEvents).toBe(0);
		expect(stats.topFiles).toEqual([]);
		expect(stats.topCommands).toEqual([]);
	});

	it("limits top files to 10", () => {
		const events: AuditEvent[] = [];
		for (let i = 0; i < 15; i++) {
			events.push(makeEvent({
				action: "file_write",
				target: { type: "file", path: `src/file${i}.ts` },
			}));
		}
		const stats = computeStats(events);
		expect(stats.topFiles.length).toBe(10);
	});
});
