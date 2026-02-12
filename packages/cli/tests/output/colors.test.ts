import { describe, it, expect } from "vitest";
import { riskIcon, riskColor } from "../../src/output/colors.js";

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

describe("riskColor", () => {
	it("returns a callable function for critical", () => {
		const fn = riskColor("critical");
		expect(typeof fn).toBe("function");
		const result = fn("test");
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});

	it("returns a callable function for high", () => {
		const fn = riskColor("high");
		expect(typeof fn).toBe("function");
		expect(typeof fn("test")).toBe("string");
	});

	it("returns a callable function for medium", () => {
		const fn = riskColor("medium");
		expect(typeof fn).toBe("function");
		expect(typeof fn("test")).toBe("string");
	});

	it("returns a callable function for low", () => {
		const fn = riskColor("low");
		expect(typeof fn).toBe("function");
		expect(typeof fn("test")).toBe("string");
	});

	it("returns a callable function for none", () => {
		const fn = riskColor("none");
		expect(typeof fn).toBe("function");
		expect(typeof fn("test")).toBe("string");
	});

	it("handles unknown levels gracefully", () => {
		const fn = riskColor("unknown");
		expect(typeof fn).toBe("function");
		expect(typeof fn("test")).toBe("string");
	});
});
