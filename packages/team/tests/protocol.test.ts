import { describe, it, expect } from "vitest";
import {
	SyncEnvelopeSchema,
	SyncCursorSchema,
	IngestResponseSchema,
	EnrollRequestSchema,
	EnrollResponseSchema,
	TeamConfigSchema,
	BootstrapRequestSchema,
	DEFAULT_SYNC_CURSOR,
} from "../src/protocol.js";

describe("SyncCursorSchema", () => {
	it("validates default cursor", () => {
		const result = SyncCursorSchema.safeParse(DEFAULT_SYNC_CURSOR);
		expect(result.success).toBe(true);
	});

	it("rejects wrong schema_version", () => {
		const result = SyncCursorSchema.safeParse({ ...DEFAULT_SYNC_CURSOR, schema_version: 2 });
		expect(result.success).toBe(false);
	});

	it("rejects negative offset", () => {
		const result = SyncCursorSchema.safeParse({ ...DEFAULT_SYNC_CURSOR, last_synced_offset: -1 });
		expect(result.success).toBe(false);
	});
});

describe("SyncEnvelopeSchema", () => {
	const validEnvelope = {
		schema_version: 1,
		type: "event-batch",
		machine_id: "abc123",
		machine_name: "test-machine",
		developer_id: "dev1",
		team_id: "team1",
		events: [{ id: "evt_1", action: "file_read" }],
		batch_hash: "sha256:abc",
		first_event_hash: "sha256:def",
		last_event_hash: "sha256:ghi",
		relay_chain_tip: "sha256:jkl",
		signature: "hmac-sha256:xyz",
		signed_at: "2026-04-04T00:00:00Z",
		byte_offset_start: 0,
		byte_offset_end: 1024,
	};

	it("validates a correct envelope", () => {
		const result = SyncEnvelopeSchema.safeParse(validEnvelope);
		expect(result.success).toBe(true);
	});

	it("rejects missing machine_id", () => {
		const { machine_id, ...rest } = validEnvelope;
		const result = SyncEnvelopeSchema.safeParse(rest);
		expect(result.success).toBe(false);
	});

	it("rejects invalid type", () => {
		const result = SyncEnvelopeSchema.safeParse({ ...validEnvelope, type: "invalid" });
		expect(result.success).toBe(false);
	});

	it("allows null chain tip", () => {
		const result = SyncEnvelopeSchema.safeParse({ ...validEnvelope, relay_chain_tip: null });
		expect(result.success).toBe(true);
	});

	it("allows optional seals", () => {
		const result = SyncEnvelopeSchema.safeParse({
			...validEnvelope,
			seals: [{ sealed_at: "2026-04-04T00:00:00Z", tip_hash: "sha256:abc" }],
		});
		expect(result.success).toBe(true);
	});
});

describe("IngestResponseSchema", () => {
	it("validates success response", () => {
		const result = IngestResponseSchema.safeParse({ ok: true, accepted: 5, duplicates: 0 });
		expect(result.success).toBe(true);
	});

	it("validates error response", () => {
		const result = IngestResponseSchema.safeParse({ ok: false, error: "Unauthorized" });
		expect(result.success).toBe(true);
	});
});

describe("EnrollRequestSchema", () => {
	it("validates a correct request", () => {
		const result = EnrollRequestSchema.safeParse({
			enrollment_token: "enroll_abc123",
			machine_id: "machine1",
			machine_name: "test-pc",
			developer_name: "Jono",
			os: "darwin",
		});
		expect(result.success).toBe(true);
	});

	it("rejects missing machine_name", () => {
		const result = EnrollRequestSchema.safeParse({
			enrollment_token: "enroll_abc",
			machine_id: "m1",
			developer_name: "Jono",
			os: "darwin",
		});
		expect(result.success).toBe(false);
	});
});

describe("EnrollResponseSchema", () => {
	it("validates success", () => {
		const result = EnrollResponseSchema.safeParse({
			ok: true,
			api_key: "pw_abc123",
			machine_id: "m1",
			team_id: "t1",
			team_name: "Engineering",
		});
		expect(result.success).toBe(true);
	});
});

describe("TeamConfigSchema", () => {
	it("validates a full config", () => {
		const result = TeamConfigSchema.safeParse({
			schema_version: 1,
			team_id: "t1",
			team_name: "Engineering",
			server_url: "https://patchwork.company.com",
			machine_id: "m1",
			developer_name: "Jono",
			api_key: "pw_abc123",
			enrolled_at: "2026-04-04T00:00:00Z",
		});
		expect(result.success).toBe(true);
	});

	it("rejects invalid server_url", () => {
		const result = TeamConfigSchema.safeParse({
			schema_version: 1,
			team_id: "t1",
			team_name: "Eng",
			server_url: "not-a-url",
			machine_id: "m1",
			developer_name: "Jono",
			api_key: "pw_abc",
			enrolled_at: "2026-04-04T00:00:00Z",
		});
		expect(result.success).toBe(false);
	});
});

describe("BootstrapRequestSchema", () => {
	it("validates a correct request", () => {
		const result = BootstrapRequestSchema.safeParse({
			team_name: "Engineering",
			admin_email: "admin@company.com",
			admin_password: "securepass",
		});
		expect(result.success).toBe(true);
	});

	it("rejects short password", () => {
		const result = BootstrapRequestSchema.safeParse({
			team_name: "Eng",
			admin_email: "admin@company.com",
			admin_password: "short",
		});
		expect(result.success).toBe(false);
	});

	it("rejects invalid email", () => {
		const result = BootstrapRequestSchema.safeParse({
			team_name: "Eng",
			admin_email: "not-email",
			admin_password: "securepass",
		});
		expect(result.success).toBe(false);
	});
});
