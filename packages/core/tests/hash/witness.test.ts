import { describe, it, expect } from "vitest";
import {
	WitnessRecordSchema,
	buildWitnessPayload,
	validateWitnessResponse,
	hashWitnessPayload,
} from "../../src/hash/witness.js";

describe("WitnessRecordSchema", () => {
	it("accepts a complete valid record", () => {
		const record = {
			schema_version: 1,
			witnessed_at: "2026-01-01T00:00:00.000Z",
			tip_hash: "sha256:abc123",
			chained_events: 42,
			seal_signature: "hmac-sha256:def456",
			witness_url: "https://witness.example.com/anchor",
			anchor_id: "anchor_001",
		};
		const result = WitnessRecordSchema.safeParse(record);
		expect(result.success).toBe(true);
	});

	it("accepts a record with optional fields", () => {
		const record = {
			schema_version: 1,
			witnessed_at: "2026-01-01T00:00:00.000Z",
			tip_hash: "sha256:abc123",
			chained_events: 42,
			seal_signature: "hmac-sha256:def456",
			witness_url: "https://witness.example.com/anchor",
			anchor_id: "anchor_001",
			key_id: "key_abc123",
			receipt_hash: "sha256:receipt789",
		};
		const result = WitnessRecordSchema.safeParse(record);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.key_id).toBe("key_abc123");
			expect(result.data.receipt_hash).toBe("sha256:receipt789");
		}
	});

	it("rejects record with wrong schema_version", () => {
		const record = {
			schema_version: 2,
			witnessed_at: "2026-01-01T00:00:00.000Z",
			tip_hash: "sha256:abc123",
			chained_events: 42,
			seal_signature: "hmac-sha256:def456",
			witness_url: "https://witness.example.com/anchor",
			anchor_id: "anchor_001",
		};
		const result = WitnessRecordSchema.safeParse(record);
		expect(result.success).toBe(false);
	});

	it("rejects record with invalid witnessed_at (not ISO datetime)", () => {
		const record = {
			schema_version: 1,
			witnessed_at: "not-a-date",
			tip_hash: "sha256:abc123",
			chained_events: 42,
			seal_signature: "hmac-sha256:def456",
			witness_url: "https://witness.example.com/anchor",
			anchor_id: "anchor_001",
		};
		const result = WitnessRecordSchema.safeParse(record);
		expect(result.success).toBe(false);
	});

	it("rejects record with missing required fields", () => {
		const record = {
			schema_version: 1,
			witnessed_at: "2026-01-01T00:00:00.000Z",
			// missing tip_hash
			chained_events: 42,
			seal_signature: "hmac-sha256:def456",
			witness_url: "https://witness.example.com/anchor",
			anchor_id: "anchor_001",
		};
		const result = WitnessRecordSchema.safeParse(record);
		expect(result.success).toBe(false);
	});
});

describe("buildWitnessPayload", () => {
	it("produces deterministic JSON with required fields", () => {
		const payload = buildWitnessPayload({
			tip_hash: "sha256:abc",
			chained_events: 10,
			seal_signature: "hmac-sha256:sig",
			requested_at: "2026-01-15T12:00:00.000Z",
		});
		const parsed = JSON.parse(payload);
		expect(parsed.protocol).toBe("patchwork-witness-v1");
		expect(parsed.tip_hash).toBe("sha256:abc");
		expect(parsed.chained_events).toBe(10);
		expect(parsed.seal_signature).toBe("hmac-sha256:sig");
		expect(parsed.requested_at).toBe("2026-01-15T12:00:00.000Z");
	});

	it("includes key_id when provided", () => {
		const payload = buildWitnessPayload({
			tip_hash: "sha256:abc",
			chained_events: 10,
			seal_signature: "hmac-sha256:sig",
			key_id: "keyABC",
			requested_at: "2026-01-15T12:00:00.000Z",
		});
		const parsed = JSON.parse(payload);
		expect(parsed.key_id).toBe("keyABC");
	});

	it("omits key_id when not provided", () => {
		const payload = buildWitnessPayload({
			tip_hash: "sha256:abc",
			chained_events: 10,
			seal_signature: "hmac-sha256:sig",
			requested_at: "2026-01-15T12:00:00.000Z",
		});
		const parsed = JSON.parse(payload);
		expect(parsed.key_id).toBeUndefined();
	});

	it("same input always produces identical output (deterministic)", () => {
		const params = {
			tip_hash: "sha256:abc",
			chained_events: 10,
			seal_signature: "hmac-sha256:sig",
			key_id: "key1",
			requested_at: "2026-01-15T12:00:00.000Z",
		};
		const a = buildWitnessPayload(params);
		const b = buildWitnessPayload(params);
		expect(a).toBe(b);
	});

	it("same input produces identical hash via hashWitnessPayload", () => {
		const params = {
			tip_hash: "sha256:abc",
			chained_events: 10,
			seal_signature: "hmac-sha256:sig",
			requested_at: "2026-01-15T12:00:00.000Z",
		};
		const payloadA = buildWitnessPayload(params);
		const payloadB = buildWitnessPayload(params);
		expect(hashWitnessPayload(payloadA)).toBe(hashWitnessPayload(payloadB));
	});
});

describe("validateWitnessResponse", () => {
	it("returns a valid WitnessRecord for good response", () => {
		const result = validateWitnessResponse(
			{ anchor_id: "anc_001", witnessed_at: "2026-01-01T00:00:00.000Z" },
			"https://witness.example.com",
			"sha256:tip",
			10,
			"hmac-sha256:sig",
		);
		expect("error" in result).toBe(false);
		if (!("error" in result)) {
			expect(result.schema_version).toBe(1);
			expect(result.anchor_id).toBe("anc_001");
			expect(result.tip_hash).toBe("sha256:tip");
			expect(result.witness_url).toBe("https://witness.example.com");
		}
	});

	it("includes key_id when provided", () => {
		const result = validateWitnessResponse(
			{ anchor_id: "anc_002", witnessed_at: "2026-01-01T00:00:00.000Z" },
			"https://witness.example.com",
			"sha256:tip",
			10,
			"hmac-sha256:sig",
			"key_123",
		);
		expect("error" in result).toBe(false);
		if (!("error" in result)) {
			expect(result.key_id).toBe("key_123");
		}
	});

	it("uses fallbackWitnessedAt when response has no witnessed_at", () => {
		const result = validateWitnessResponse(
			{ anchor_id: "anc_fallback" },
			"https://witness.example.com",
			"sha256:tip",
			10,
			"hmac-sha256:sig",
			undefined,
			"2026-01-01T00:00:00.000Z",
		);
		expect("error" in result).toBe(false);
		if (!("error" in result)) {
			expect(result.witnessed_at).toBe("2026-01-01T00:00:00.000Z");
		}
	});

	it("returns error when no witnessed_at and no fallback", () => {
		const result = validateWitnessResponse(
			{ anchor_id: "anc_nots" },
			"https://witness.example.com",
			"sha256:tip",
			10,
			"hmac-sha256:sig",
		);
		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toContain("witnessed_at");
		}
	});

	it("returns error for invalid witnessed_at in response", () => {
		const result = validateWitnessResponse(
			{ anchor_id: "anc_bad_ts", witnessed_at: "not-a-date" },
			"https://witness.example.com",
			"sha256:tip",
			10,
			"hmac-sha256:sig",
		);
		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toContain("Invalid witnessed_at");
		}
	});

	it("includes receipt_hash from response", () => {
		const result = validateWitnessResponse(
			{ anchor_id: "anc_003", receipt_hash: "sha256:receipt", witnessed_at: "2026-01-01T00:00:00.000Z" },
			"https://witness.example.com",
			"sha256:tip",
			10,
			"hmac-sha256:sig",
		);
		expect("error" in result).toBe(false);
		if (!("error" in result)) {
			expect(result.receipt_hash).toBe("sha256:receipt");
		}
	});

	it("returns error for missing anchor_id", () => {
		const result = validateWitnessResponse(
			{ some: "data" },
			"https://witness.example.com",
			"sha256:tip",
			10,
			"hmac-sha256:sig",
		);
		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toContain("anchor_id");
		}
	});

	it("returns error for null response", () => {
		const result = validateWitnessResponse(
			null,
			"https://witness.example.com",
			"sha256:tip",
			10,
			"hmac-sha256:sig",
		);
		expect("error" in result).toBe(true);
	});

	it("returns error for empty anchor_id", () => {
		const result = validateWitnessResponse(
			{ anchor_id: "" },
			"https://witness.example.com",
			"sha256:tip",
			10,
			"hmac-sha256:sig",
		);
		expect("error" in result).toBe(true);
	});
});

describe("hashWitnessPayload", () => {
	it("returns sha256-prefixed hash", () => {
		const hash = hashWitnessPayload("test-payload");
		expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
	});

	it("is deterministic", () => {
		const a = hashWitnessPayload("same-input");
		const b = hashWitnessPayload("same-input");
		expect(a).toBe(b);
	});

	it("differs for different inputs", () => {
		const a = hashWitnessPayload("input-a");
		const b = hashWitnessPayload("input-b");
		expect(a).not.toBe(b);
	});
});
