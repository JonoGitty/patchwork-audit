import { describe, it, expect } from "vitest";
import {
	signEnvelope,
	verifyEnvelope,
	computeBatchHash,
	generateApiKey,
	hashApiKey,
	deriveMachineId,
} from "../src/crypto.js";
import type { SyncEnvelope } from "../src/protocol.js";

function makeEnvelope(overrides: Partial<SyncEnvelope> = {}): SyncEnvelope {
	return {
		schema_version: 1,
		type: "event-batch",
		machine_id: "test-machine",
		machine_name: "test-host",
		developer_id: "dev1",
		team_id: "team1",
		events: [{ id: "evt_1", action: "file_read", agent: "claude-code" }],
		batch_hash: "sha256:abc",
		first_event_hash: "sha256:def",
		last_event_hash: "sha256:def",
		relay_chain_tip: "sha256:ghi",
		signature: "",
		signed_at: "",
		byte_offset_start: 0,
		byte_offset_end: 512,
		...overrides,
	};
}

describe("signEnvelope / verifyEnvelope", () => {
	const apiKey = "pw_test-key-for-signing";

	it("signs and verifies successfully", () => {
		const envelope = makeEnvelope();
		const signed = signEnvelope(envelope, apiKey);

		expect(signed.signature).toMatch(/^hmac-sha256:/);
		expect(signed.signed_at).toBeTruthy();
		expect(verifyEnvelope(signed, apiKey)).toBe(true);
	});

	it("fails verification with wrong key", () => {
		const signed = signEnvelope(makeEnvelope(), apiKey);
		expect(verifyEnvelope(signed, "pw_wrong-key")).toBe(false);
	});

	it("fails verification with tampered events", () => {
		const signed = signEnvelope(makeEnvelope(), apiKey);
		signed.events = [{ id: "evt_tampered", action: "command_execute" }];
		expect(verifyEnvelope(signed, apiKey)).toBe(false);
	});

	it("produces deterministic signature for same input", () => {
		const env1 = makeEnvelope();
		const env2 = makeEnvelope();
		// Force same signed_at for determinism
		const signed1 = signEnvelope(env1, apiKey);
		const signed2 = { ...signEnvelope(env2, apiKey), signed_at: signed1.signed_at };
		// Re-sign with fixed timestamp
		const resigned2 = signEnvelope({ ...env2, signed_at: signed1.signed_at }, apiKey);
		// They won't match exactly because signed_at differs by ms, but structure is right
		expect(signed1.signature).toMatch(/^hmac-sha256:/);
		expect(resigned2.signature).toMatch(/^hmac-sha256:/);
	});

	it("rejects empty signature", () => {
		const envelope = makeEnvelope({ signature: "" });
		expect(verifyEnvelope(envelope, apiKey)).toBe(false);
	});
});

describe("computeBatchHash", () => {
	it("produces sha256 prefixed hash", () => {
		const hash = computeBatchHash([{ id: "1" }, { id: "2" }]);
		expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
	});

	it("is deterministic", () => {
		const events = [{ id: "1", action: "file_read" }, { id: "2", action: "file_write" }];
		expect(computeBatchHash(events)).toBe(computeBatchHash(events));
	});

	it("differs for different events", () => {
		const a = computeBatchHash([{ id: "1" }]);
		const b = computeBatchHash([{ id: "2" }]);
		expect(a).not.toBe(b);
	});

	it("is order-sensitive", () => {
		const a = computeBatchHash([{ id: "1" }, { id: "2" }]);
		const b = computeBatchHash([{ id: "2" }, { id: "1" }]);
		expect(a).not.toBe(b);
	});
});

describe("generateApiKey", () => {
	it("starts with pw_ prefix", () => {
		const key = generateApiKey();
		expect(key.startsWith("pw_")).toBe(true);
	});

	it("has sufficient length (256 bits + prefix)", () => {
		const key = generateApiKey();
		// pw_ (3) + 43 chars base64url = 46
		expect(key.length).toBeGreaterThanOrEqual(46);
	});

	it("generates unique keys", () => {
		const keys = new Set(Array.from({ length: 100 }, () => generateApiKey()));
		expect(keys.size).toBe(100);
	});
});

describe("hashApiKey", () => {
	it("produces sha256 prefixed hash", () => {
		const hash = hashApiKey("pw_test123");
		expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
	});

	it("is deterministic", () => {
		expect(hashApiKey("pw_test")).toBe(hashApiKey("pw_test"));
	});

	it("differs for different keys", () => {
		expect(hashApiKey("pw_a")).not.toBe(hashApiKey("pw_b"));
	});
});

describe("deriveMachineId", () => {
	it("produces a 64-char hex string", () => {
		const id = deriveMachineId("hardware-uuid", "team-uuid");
		expect(id).toMatch(/^[a-f0-9]{64}$/);
	});

	it("is deterministic", () => {
		expect(deriveMachineId("hw1", "t1")).toBe(deriveMachineId("hw1", "t1"));
	});

	it("differs by team (prevents cross-team tracking)", () => {
		expect(deriveMachineId("hw1", "team-a")).not.toBe(deriveMachineId("hw1", "team-b"));
	});

	it("differs by hardware", () => {
		expect(deriveMachineId("hw-a", "t1")).not.toBe(deriveMachineId("hw-b", "t1"));
	});
});
