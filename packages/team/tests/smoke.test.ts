import { describe, it, expect } from "vitest";

describe("@patchwork/team", () => {
	it("exports protocol types", async () => {
		const mod = await import("../src/index.js");
		expect(mod.SyncEnvelopeSchema).toBeDefined();
		expect(mod.SyncCursorSchema).toBeDefined();
		expect(mod.TeamConfigSchema).toBeDefined();
	});

	it("exports constants", async () => {
		const mod = await import("../src/index.js");
		expect(mod.TEAM_DIR).toBe("/Library/Patchwork/team");
		expect(mod.DEFAULT_TEAM_SERVER_PORT).toBe(3001);
		expect(mod.SYNC_INTERVAL_MS).toBe(30_000);
		expect(mod.API_KEY_PREFIX).toBe("pw_");
	});

	it("exports crypto functions", async () => {
		const mod = await import("../src/index.js");
		expect(typeof mod.signEnvelope).toBe("function");
		expect(typeof mod.verifyEnvelope).toBe("function");
		expect(typeof mod.generateApiKey).toBe("function");
		expect(typeof mod.hashApiKey).toBe("function");
		expect(typeof mod.computeBatchHash).toBe("function");
		expect(typeof mod.deriveMachineId).toBe("function");
	});
});
