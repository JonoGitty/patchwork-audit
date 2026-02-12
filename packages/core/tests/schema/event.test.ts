import { describe, it, expect } from "vitest";
import { AuditEventSchema, RiskLevel, AgentType, EventStatus } from "../../src/schema/event.js";

describe("AuditEventSchema", () => {
	const validEvent = {
		id: "evt_01J8K000000000000000000000",
		session_id: "ses_01J8K000000000000000000000",
		timestamp: "2026-02-12T14:30:00.123Z",
		agent: "claude-code",
		action: "file_write",
		status: "completed",
		target: {
			type: "file",
			path: "src/auth/login.ts",
			abs_path: "/Users/test/project/src/auth/login.ts",
		},
		project: {
			root: "/Users/test/project",
			name: "project",
		},
		risk: {
			level: "medium",
			flags: [],
		},
		content: {
			hash: "sha256:abc123",
			size_bytes: 1024,
			redacted: true,
		},
		provenance: {
			hook_event: "PostToolUse",
			tool_name: "Write",
		},
	};

	it("validates a complete event", () => {
		const result = AuditEventSchema.safeParse(validEvent);
		expect(result.success).toBe(true);
	});

	it("validates a minimal event", () => {
		const minimal = {
			id: "evt_01J8K000000000000000000000",
			session_id: "ses_01J8K000000000000000000000",
			timestamp: "2026-02-12T14:30:00.123Z",
			agent: "claude-code",
			action: "session_start",
			risk: { level: "none", flags: [] },
		};
		const result = AuditEventSchema.safeParse(minimal);
		expect(result.success).toBe(true);
	});

	it("rejects invalid agent type", () => {
		const result = AuditEventSchema.safeParse({
			...validEvent,
			agent: "invalid-agent",
		});
		expect(result.success).toBe(false);
	});

	it("rejects invalid risk level", () => {
		const result = AuditEventSchema.safeParse({
			...validEvent,
			risk: { level: "extreme", flags: [] },
		});
		expect(result.success).toBe(false);
	});

	it("rejects missing timestamp", () => {
		const { timestamp, ...noTimestamp } = validEvent;
		const result = AuditEventSchema.safeParse(noTimestamp);
		expect(result.success).toBe(false);
	});

	it("defaults status to completed", () => {
		const { status, ...noStatus } = validEvent;
		const result = AuditEventSchema.safeParse(noStatus);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.status).toBe("completed");
		}
	});

	it("accepts all valid agent types", () => {
		for (const agent of ["claude-code", "codex", "cursor", "copilot", "custom"]) {
			const result = AgentType.safeParse(agent);
			expect(result.success).toBe(true);
		}
	});

	it("accepts all valid risk levels", () => {
		for (const level of ["none", "low", "medium", "high", "critical"]) {
			const result = RiskLevel.safeParse(level);
			expect(result.success).toBe(true);
		}
	});

	it("accepts all valid event statuses", () => {
		for (const status of ["pending", "completed", "denied", "failed"]) {
			const result = EventStatus.safeParse(status);
			expect(result.success).toBe(true);
		}
	});

	describe("schema_version contract", () => {
		const minimalEvent = {
			id: "evt_01",
			session_id: "ses_01",
			timestamp: "2026-02-12T14:30:00.123Z",
			agent: "claude-code",
			action: "session_start",
			risk: { level: "none", flags: [] },
		};

		it("accepts schema_version: undefined (legacy events)", () => {
			const result = AuditEventSchema.safeParse(minimalEvent);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.schema_version).toBeUndefined();
			}
		});

		it("accepts schema_version: 1", () => {
			const result = AuditEventSchema.safeParse({ ...minimalEvent, schema_version: 1 });
			expect(result.success).toBe(true);
		});

		it("rejects schema_version: 2", () => {
			const result = AuditEventSchema.safeParse({ ...minimalEvent, schema_version: 2 });
			expect(result.success).toBe(false);
		});

		it("rejects schema_version: 0", () => {
			const result = AuditEventSchema.safeParse({ ...minimalEvent, schema_version: 0 });
			expect(result.success).toBe(false);
		});

		it("rejects schema_version: 'one' (string)", () => {
			const result = AuditEventSchema.safeParse({ ...minimalEvent, schema_version: "one" });
			expect(result.success).toBe(false);
		});
	});
});
