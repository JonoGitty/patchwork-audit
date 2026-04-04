import { describe, it, expect } from "vitest";
import { getMachineHardwareId, getMachineName, getMachineOS } from "../../src/sync/identity.js";

describe("machine identity", () => {
	it("getMachineHardwareId returns a non-empty string", () => {
		const id = getMachineHardwareId();
		expect(id).toBeTruthy();
		expect(typeof id).toBe("string");
		expect(id.length).toBeGreaterThan(0);
	});

	it("getMachineHardwareId is deterministic", () => {
		expect(getMachineHardwareId()).toBe(getMachineHardwareId());
	});

	it("getMachineName returns hostname", () => {
		const name = getMachineName();
		expect(name).toBeTruthy();
		expect(typeof name).toBe("string");
	});

	it("getMachineOS returns platform", () => {
		const os = getMachineOS();
		expect(["darwin", "linux", "win32"]).toContain(os);
	});
});
