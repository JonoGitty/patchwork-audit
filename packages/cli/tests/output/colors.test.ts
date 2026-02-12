import { describe, it, expect } from "vitest";
import { riskIcon } from "../../src/output/colors.js";

describe("riskIcon", () => {
	it("returns CRITICAL badge for critical", () => {
		expect(riskIcon("critical")).toContain("CRITICAL");
	});

	it("returns HIGH badge for high", () => {
		expect(riskIcon("high")).toContain("HIGH");
	});

	it("returns a string for medium", () => {
		expect(typeof riskIcon("medium")).toBe("string");
		expect(riskIcon("medium").length).toBeGreaterThan(0);
	});

	it("returns a string for low", () => {
		expect(typeof riskIcon("low")).toBe("string");
	});

	it("returns a string for none", () => {
		expect(typeof riskIcon("none")).toBe("string");
	});

	it("handles unknown levels gracefully", () => {
		expect(typeof riskIcon("unknown")).toBe("string");
	});
});
