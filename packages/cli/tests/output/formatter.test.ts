import { describe, it, expect } from "vitest";
import { formatEvent, formatEventCompact } from "../../src/output/formatter.js";
import type { AuditEvent } from "@patchwork/core";

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
	return {
		id: "evt_test",
		session_id: "ses_test",
		timestamp: "2026-02-12T14:30:00.000Z",
		agent: "claude-code",
		action: "file_write",
		status: "completed",
		target: { type: "file", path: "src/index.ts" },
		risk: { level: "medium", flags: [] },
		...overrides,
	};
}

describe("formatEvent", () => {
	it("includes the action in output", () => {
		const output = formatEvent(makeEvent());
		expect(output).toContain("file_write");
	});

	it("includes the target path", () => {
		const output = formatEvent(makeEvent({ target: { type: "file", path: "src/auth.ts" } }));
		expect(output).toContain("src/auth.ts");
	});

	it("includes the agent name", () => {
		const output = formatEvent(makeEvent());
		expect(output).toContain("claude-code");
	});

	it("shows command targets", () => {
		const output = formatEvent(
			makeEvent({
				action: "command_execute",
				target: { type: "command", command: "npm test" },
			}),
		);
		expect(output).toContain("npm test");
	});

	it("shows URL targets", () => {
		const output = formatEvent(
			makeEvent({
				action: "web_fetch",
				target: { type: "url", url: "https://example.com" },
			}),
		);
		expect(output).toContain("https://example.com");
	});

	it("handles events with no target", () => {
		const output = formatEvent(makeEvent({ target: undefined }));
		expect(typeof output).toBe("string");
	});
});

describe("formatEventCompact", () => {
	it("returns a single line", () => {
		const output = formatEventCompact(makeEvent());
		expect(output.split("\n")).toHaveLength(1);
	});

	it("includes action and target", () => {
		const output = formatEventCompact(makeEvent());
		expect(output).toContain("file_write");
		expect(output).toContain("src/index.ts");
	});
});
