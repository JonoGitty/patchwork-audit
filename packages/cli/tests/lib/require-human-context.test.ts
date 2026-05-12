import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkHumanContext } from "../../src/lib/require-human-context.js";

describe("checkHumanContext (R2-001/002 fix)", () => {
	let savedStdinTTY: boolean | undefined;
	let savedStdoutTTY: boolean | undefined;
	let savedEnv: string | undefined;

	beforeEach(() => {
		// Stash the real flags; we'll overwrite per test.
		savedStdinTTY = process.stdin.isTTY;
		savedStdoutTTY = process.stdout.isTTY;
		savedEnv = process.env.PATCHWORK_HUMAN_CONTEXT;
	});

	afterEach(() => {
		// Restore on a per-property basis. `isTTY` is configurable.
		Object.defineProperty(process.stdin, "isTTY", {
			configurable: true,
			value: savedStdinTTY,
		});
		Object.defineProperty(process.stdout, "isTTY", {
			configurable: true,
			value: savedStdoutTTY,
		});
		if (savedEnv === undefined) delete process.env.PATCHWORK_HUMAN_CONTEXT;
		else process.env.PATCHWORK_HUMAN_CONTEXT = savedEnv;
	});

	it("ok when both stdin and stdout are TTYs", () => {
		Object.defineProperty(process.stdin, "isTTY", {
			configurable: true,
			value: true,
		});
		Object.defineProperty(process.stdout, "isTTY", {
			configurable: true,
			value: true,
		});
		delete process.env.PATCHWORK_HUMAN_CONTEXT;
		expect(checkHumanContext().ok).toBe(true);
	});

	it("NOT ok when stdin is not a TTY (typical agent subprocess)", () => {
		Object.defineProperty(process.stdin, "isTTY", {
			configurable: true,
			value: false,
		});
		Object.defineProperty(process.stdout, "isTTY", {
			configurable: true,
			value: true,
		});
		delete process.env.PATCHWORK_HUMAN_CONTEXT;
		const r = checkHumanContext();
		expect(r.ok).toBe(false);
		expect(r.reason).toMatch(/terminal|TTY|stdin/i);
	});

	it("NOT ok when stdout is not a TTY (output captured to a pipe)", () => {
		Object.defineProperty(process.stdin, "isTTY", {
			configurable: true,
			value: true,
		});
		Object.defineProperty(process.stdout, "isTTY", {
			configurable: true,
			value: false,
		});
		delete process.env.PATCHWORK_HUMAN_CONTEXT;
		expect(checkHumanContext().ok).toBe(false);
	});

	it("PATCHWORK_HUMAN_CONTEXT=1 override bypasses both TTY checks", () => {
		Object.defineProperty(process.stdin, "isTTY", {
			configurable: true,
			value: false,
		});
		Object.defineProperty(process.stdout, "isTTY", {
			configurable: true,
			value: false,
		});
		process.env.PATCHWORK_HUMAN_CONTEXT = "1";
		expect(checkHumanContext().ok).toBe(true);
	});

	it("PATCHWORK_HUMAN_CONTEXT=anything-else does NOT bypass", () => {
		Object.defineProperty(process.stdin, "isTTY", {
			configurable: true,
			value: false,
		});
		process.env.PATCHWORK_HUMAN_CONTEXT = "0";
		expect(checkHumanContext().ok).toBe(false);
		process.env.PATCHWORK_HUMAN_CONTEXT = "true";
		// Strict equality to "1" — anything else is rejected.
		expect(checkHumanContext().ok).toBe(false);
	});
});
