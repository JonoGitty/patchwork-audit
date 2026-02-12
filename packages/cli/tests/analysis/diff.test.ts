import { describe, it, expect } from "vitest";
import { computeFileDiff } from "../../src/commands/diff.js";
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

describe("computeFileDiff", () => {
	it("detects CREATED files", () => {
		const events = [
			makeEvent({ action: "file_create", target: { type: "file", path: "src/new.ts" } }),
		];
		const changes = computeFileDiff(events);
		expect(changes).toHaveLength(1);
		expect(changes[0].path).toBe("src/new.ts");
		expect(changes[0].changeType).toBe("CREATED");
	});

	it("detects MODIFIED files", () => {
		const events = [
			makeEvent({ action: "file_edit", target: { type: "file", path: "src/existing.ts" } }),
		];
		const changes = computeFileDiff(events);
		expect(changes).toHaveLength(1);
		expect(changes[0].changeType).toBe("MODIFIED");
	});

	it("detects DELETED files", () => {
		const events = [
			makeEvent({ action: "file_delete", target: { type: "file", path: "src/old.ts" } }),
		];
		const changes = computeFileDiff(events);
		expect(changes).toHaveLength(1);
		expect(changes[0].changeType).toBe("DELETED");
	});

	it("excludes read-only files", () => {
		const events = [
			makeEvent({ action: "file_read", target: { type: "file", path: "src/read.ts" } }),
		];
		const changes = computeFileDiff(events);
		expect(changes).toHaveLength(0);
	});

	it("groups events by file path", () => {
		const events = [
			makeEvent({ action: "file_create", target: { type: "file", path: "src/a.ts" }, timestamp: "2026-01-15T10:00:00.000Z" }),
			makeEvent({ action: "file_edit", target: { type: "file", path: "src/a.ts" }, timestamp: "2026-01-15T10:01:00.000Z" }),
			makeEvent({ action: "file_write", target: { type: "file", path: "src/b.ts" }, timestamp: "2026-01-15T10:02:00.000Z" }),
		];
		const changes = computeFileDiff(events);
		expect(changes).toHaveLength(2);
		const aChange = changes.find((c) => c.path === "src/a.ts")!;
		expect(aChange.events).toHaveLength(2);
		expect(aChange.changeType).toBe("CREATED");
	});

	it("records event timestamps and hashes", () => {
		const events = [
			makeEvent({
				action: "file_write",
				target: { type: "file", path: "src/x.ts" },
				content: { hash: "sha256:abc123", size_bytes: 100, redacted: true },
			}),
		];
		const changes = computeFileDiff(events);
		expect(changes[0].events[0].hash).toBe("sha256:abc123");
		expect(changes[0].events[0].size).toBe(100);
	});

	it("sorts changes by path", () => {
		const events = [
			makeEvent({ action: "file_write", target: { type: "file", path: "src/z.ts" } }),
			makeEvent({ action: "file_write", target: { type: "file", path: "src/a.ts" } }),
			makeEvent({ action: "file_write", target: { type: "file", path: "src/m.ts" } }),
		];
		const changes = computeFileDiff(events);
		expect(changes.map((c) => c.path)).toEqual(["src/a.ts", "src/m.ts", "src/z.ts"]);
	});

	it("ignores events without target path", () => {
		const events = [
			makeEvent({ action: "command_execute", target: { type: "command", command: "npm test" } }),
			makeEvent({ action: "session_start" }),
		];
		const changes = computeFileDiff(events);
		expect(changes).toHaveLength(0);
	});

	it("handles empty events array", () => {
		const changes = computeFileDiff([]);
		expect(changes).toHaveLength(0);
	});
});
