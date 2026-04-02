import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	shouldAutoSeal,
	performSeal,
	readLastSeal,
	performAutoSealCycle,
	type SealState,
} from "../../src/relay/auto-seal.js";
import type { AutoSealConfig, WitnessConfig } from "../../src/relay/config.js";

function makeSealState(overrides: Partial<SealState> = {}): SealState {
	return {
		chainTip: "sha256:abc123",
		eventCount: 10,
		lastSealEventCount: 0,
		lastSealAt: null,
		...overrides,
	};
}

const defaultAutoSealConfig: AutoSealConfig = {
	enabled: true,
	interval_minutes: 15,
	min_events_between_seals: 1,
};

const disabledWitnessConfig: WitnessConfig = {
	enabled: false,
	endpoints: [],
	quorum: 1,
};

describe("Auto-Seal", () => {
	let tmpDir: string;
	let keyringPath: string;
	let sealsPath: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-autoseal-test-"));
		keyringPath = join(tmpDir, "keys", "seal");
		sealsPath = join(tmpDir, "seals.relay.jsonl");
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	describe("shouldAutoSeal", () => {
		it("returns false when disabled", () => {
			expect(shouldAutoSeal(makeSealState(), { ...defaultAutoSealConfig, enabled: false })).toBe(false);
		});

		it("returns false when no chain tip", () => {
			expect(shouldAutoSeal(makeSealState({ chainTip: null }), defaultAutoSealConfig)).toBe(false);
		});

		it("returns false when not enough new events", () => {
			const state = makeSealState({ eventCount: 5, lastSealEventCount: 5 });
			expect(shouldAutoSeal(state, { ...defaultAutoSealConfig, min_events_between_seals: 3 })).toBe(false);
		});

		it("returns true when enough new events", () => {
			const state = makeSealState({ eventCount: 10, lastSealEventCount: 5 });
			expect(shouldAutoSeal(state, { ...defaultAutoSealConfig, min_events_between_seals: 3 })).toBe(true);
		});

		it("returns true when min_events is 0 and chain tip exists", () => {
			const state = makeSealState({ eventCount: 5, lastSealEventCount: 5 });
			expect(shouldAutoSeal(state, { ...defaultAutoSealConfig, min_events_between_seals: 0 })).toBe(true);
		});
	});

	describe("performSeal", () => {
		it("creates a valid seal record", () => {
			const state = makeSealState();
			const seal = performSeal(state, keyringPath, sealsPath);

			expect(seal.tip_hash).toBe("sha256:abc123");
			expect(seal.chained_events).toBe(10);
			expect(seal.signature).toMatch(/^hmac-sha256:/);
			expect(seal.key_id).toBeDefined();
			expect(seal.sealed_at).toBeDefined();
		});

		it("writes seal to seals log", () => {
			const state = makeSealState();
			performSeal(state, keyringPath, sealsPath);

			expect(existsSync(sealsPath)).toBe(true);
			const content = readFileSync(sealsPath, "utf-8").trim();
			const parsed = JSON.parse(content);
			expect(parsed.tip_hash).toBe("sha256:abc123");
		});

		it("appends multiple seals", () => {
			performSeal(makeSealState({ chainTip: "sha256:aaa", eventCount: 5 }), keyringPath, sealsPath);
			performSeal(makeSealState({ chainTip: "sha256:bbb", eventCount: 10 }), keyringPath, sealsPath);

			const lines = readFileSync(sealsPath, "utf-8").trim().split("\n");
			expect(lines).toHaveLength(2);
			expect(JSON.parse(lines[0]).tip_hash).toBe("sha256:aaa");
			expect(JSON.parse(lines[1]).tip_hash).toBe("sha256:bbb");
		});

		it("throws when no chain tip", () => {
			expect(() => performSeal(makeSealState({ chainTip: null }), keyringPath, sealsPath))
				.toThrow("Cannot seal: no chain tip");
		});

		it("uses same key across seals", () => {
			const s1 = performSeal(makeSealState({ chainTip: "sha256:aaa" }), keyringPath, sealsPath);
			const s2 = performSeal(makeSealState({ chainTip: "sha256:bbb" }), keyringPath, sealsPath);
			expect(s1.key_id).toBe(s2.key_id);
		});
	});

	describe("readLastSeal", () => {
		it("returns null when no seals file", () => {
			expect(readLastSeal(join(tmpDir, "no-seals.jsonl"))).toBeNull();
		});

		it("returns the last seal", () => {
			performSeal(makeSealState({ chainTip: "sha256:first", eventCount: 5 }), keyringPath, sealsPath);
			performSeal(makeSealState({ chainTip: "sha256:second", eventCount: 10 }), keyringPath, sealsPath);

			const last = readLastSeal(sealsPath);
			expect(last).not.toBeNull();
			expect(last!.tip_hash).toBe("sha256:second");
			expect(last!.chained_events).toBe(10);
		});
	});

	describe("performAutoSealCycle", () => {
		it("seals when conditions are met", async () => {
			const state = makeSealState({ eventCount: 5, lastSealEventCount: 0 });
			const result = await performAutoSealCycle(
				state, defaultAutoSealConfig, disabledWitnessConfig,
				keyringPath, sealsPath,
			);

			expect(result.sealed).toBe(true);
			expect(result.seal).toBeDefined();
			expect(result.seal!.chained_events).toBe(5);
		});

		it("skips when not enough events", async () => {
			const state = makeSealState({ eventCount: 5, lastSealEventCount: 5 });
			const result = await performAutoSealCycle(
				state, defaultAutoSealConfig, disabledWitnessConfig,
				keyringPath, sealsPath,
			);

			expect(result.sealed).toBe(false);
			expect(result.reason).toContain("0 new events");
		});

		it("skips when no chain tip", async () => {
			const state = makeSealState({ chainTip: null });
			const result = await performAutoSealCycle(
				state, defaultAutoSealConfig, disabledWitnessConfig,
				keyringPath, sealsPath,
			);

			expect(result.sealed).toBe(false);
			expect(result.reason).toContain("No events");
		});
	});
});
