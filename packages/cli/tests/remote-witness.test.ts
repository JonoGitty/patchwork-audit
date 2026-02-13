import { describe, it, expect, vi, beforeEach } from "vitest";
import * as httpClient from "../src/http-client.js";
import { checkRemoteWitnesses, emptyRemoteWitnessResult } from "../src/remote-witness.js";

vi.spyOn(httpClient, "fetchJson");

beforeEach(() => {
	vi.mocked(httpClient.fetchJson).mockReset();
});

describe("checkRemoteWitnesses", () => {
	const baseOpts = { quorum: 1, timeoutMs: 5000 };

	it("returns verified when endpoint returns 200 with matching anchor_id", async () => {
		vi.mocked(httpClient.fetchJson).mockResolvedValueOnce({
			status: 200,
			body: { anchor_id: "abc123", tip_hash: "deadbeef" },
		});

		const result = await checkRemoteWitnesses({
			...baseOpts,
			witnessRecords: [{ witness_url: "https://witness.example.com", anchor_id: "abc123" }],
		});

		expect(result.remote_witness_checked).toBe(true);
		expect(result.remote_witness_verified_count).toBe(1);
		expect(result.remote_witness_quorum_met).toBe(true);
		expect(result.remote_witness_failure_reason).toBeNull();
		expect(result.remote_witness_proof_results).toHaveLength(1);
		expect(result.remote_witness_proof_results[0].verified).toBe(true);
	});

	it("strips trailing slashes from witness_url when building proof URL", async () => {
		vi.mocked(httpClient.fetchJson).mockResolvedValueOnce({
			status: 200,
			body: { anchor_id: "abc123" },
		});

		await checkRemoteWitnesses({
			...baseOpts,
			witnessRecords: [{ witness_url: "https://witness.example.com///", anchor_id: "abc123" }],
		});

		expect(httpClient.fetchJson).toHaveBeenCalledWith(
			"https://witness.example.com/anchors/abc123",
			expect.any(Object),
		);
	});

	it("fails when quorum not met", async () => {
		vi.mocked(httpClient.fetchJson).mockResolvedValueOnce({
			status: 404,
			body: { error: "not found" },
		});

		const result = await checkRemoteWitnesses({
			...baseOpts,
			quorum: 1,
			witnessRecords: [{ witness_url: "https://witness.example.com", anchor_id: "abc123" }],
		});

		expect(result.remote_witness_quorum_met).toBe(false);
		expect(result.remote_witness_failure_reason).toContain("quorum not met");
		expect(result.remote_witness_proof_results[0].verified).toBe(false);
		expect(result.remote_witness_proof_results[0].error).toContain("HTTP 404");
	});

	it("handles fetchJson throwing (timeout/network error)", async () => {
		vi.mocked(httpClient.fetchJson).mockRejectedValueOnce(new Error("The operation was aborted"));

		const result = await checkRemoteWitnesses({
			...baseOpts,
			witnessRecords: [{ witness_url: "https://witness.example.com", anchor_id: "abc123" }],
		});

		expect(result.remote_witness_verified_count).toBe(0);
		expect(result.remote_witness_quorum_met).toBe(false);
		expect(result.remote_witness_proof_results[0].verified).toBe(false);
		expect(result.remote_witness_proof_results[0].error).toContain("aborted");
	});

	it("returns failure reason when no witness records available", async () => {
		const result = await checkRemoteWitnesses({
			...baseOpts,
			witnessRecords: [],
		});

		expect(result.remote_witness_checked).toBe(true);
		expect(result.remote_witness_verified_count).toBe(0);
		expect(result.remote_witness_quorum_met).toBe(false);
		expect(result.remote_witness_failure_reason).toContain("No witness records");
	});

	it("handles mixed results correctly", async () => {
		vi.mocked(httpClient.fetchJson)
			.mockResolvedValueOnce({ status: 200, body: { anchor_id: "a1" } })
			.mockResolvedValueOnce({ status: 500, body: { error: "server error" } })
			.mockResolvedValueOnce({ status: 200, body: { anchor_id: "a3" } });

		const result = await checkRemoteWitnesses({
			quorum: 2,
			timeoutMs: 5000,
			witnessRecords: [
				{ witness_url: "https://w1.example.com", anchor_id: "a1" },
				{ witness_url: "https://w2.example.com", anchor_id: "a2" },
				{ witness_url: "https://w3.example.com", anchor_id: "a3" },
			],
		});

		expect(result.remote_witness_verified_count).toBe(2);
		expect(result.remote_witness_quorum_met).toBe(true);
		expect(result.remote_witness_failure_reason).toBeNull();
	});

	it("fails when response body has mismatched anchor_id", async () => {
		vi.mocked(httpClient.fetchJson).mockResolvedValueOnce({
			status: 200,
			body: { anchor_id: "wrong_id", tip_hash: "deadbeef" },
		});

		const result = await checkRemoteWitnesses({
			...baseOpts,
			witnessRecords: [{ witness_url: "https://witness.example.com", anchor_id: "abc123" }],
		});

		expect(result.remote_witness_verified_count).toBe(0);
		expect(result.remote_witness_proof_results[0].verified).toBe(false);
		expect(result.remote_witness_proof_results[0].error).toContain("matching anchor_id");
	});

	it("passes bearer token through to fetchJson", async () => {
		vi.mocked(httpClient.fetchJson).mockResolvedValueOnce({
			status: 200,
			body: { anchor_id: "abc123" },
		});

		await checkRemoteWitnesses({
			...baseOpts,
			bearerToken: "my-secret-token",
			witnessRecords: [{ witness_url: "https://witness.example.com", anchor_id: "abc123" }],
		});

		expect(httpClient.fetchJson).toHaveBeenCalledWith(
			expect.any(String),
			{ timeoutMs: 5000, bearerToken: "my-secret-token" },
		);
	});

	it("quorum=2 with only 1 verified returns failure", async () => {
		vi.mocked(httpClient.fetchJson)
			.mockResolvedValueOnce({ status: 200, body: { anchor_id: "a1" } })
			.mockRejectedValueOnce(new Error("timeout"));

		const result = await checkRemoteWitnesses({
			quorum: 2,
			timeoutMs: 5000,
			witnessRecords: [
				{ witness_url: "https://w1.example.com", anchor_id: "a1" },
				{ witness_url: "https://w2.example.com", anchor_id: "a2" },
			],
		});

		expect(result.remote_witness_verified_count).toBe(1);
		expect(result.remote_witness_quorum_met).toBe(false);
		expect(result.remote_witness_failure_reason).toContain("need 2");
	});
});

describe("emptyRemoteWitnessResult", () => {
	it("returns default unchecked state", () => {
		const r = emptyRemoteWitnessResult();
		expect(r.remote_witness_checked).toBe(false);
		expect(r.remote_witness_proof_results).toEqual([]);
		expect(r.remote_witness_verified_count).toBe(0);
		expect(r.remote_witness_quorum_met).toBe(false);
		expect(r.remote_witness_failure_reason).toBeNull();
	});
});
