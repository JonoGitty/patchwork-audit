import { describe, it, expect } from "vitest";
import { computeBackoffMs } from "../../src/sync/backoff.js";

describe("computeBackoffMs", () => {
	it("returns 0 for 0 failures", () => {
		expect(computeBackoffMs(0)).toBe(0);
	});

	it("returns 30s for 1 failure", () => {
		expect(computeBackoffMs(1)).toBe(30_000);
	});

	it("returns 60s for 2 failures", () => {
		expect(computeBackoffMs(2)).toBe(60_000);
	});

	it("returns 120s for 3 failures", () => {
		expect(computeBackoffMs(3)).toBe(120_000);
	});

	it("returns 300s for 4 failures", () => {
		expect(computeBackoffMs(4)).toBe(300_000);
	});

	it("caps at 600s for 5+ failures", () => {
		expect(computeBackoffMs(5)).toBe(600_000);
		expect(computeBackoffMs(10)).toBe(600_000);
		expect(computeBackoffMs(100)).toBe(600_000);
	});
});
