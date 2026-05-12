import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	canonicalKey,
	consumeApprovedToken,
	listPendingRequests,
	readPendingRequest,
	writeApprovedToken,
	writePendingRequest,
	DEFAULT_APPROVAL_TTL_MS,
} from "../../src/claude-code/approval-store.js";

describe("approval-store (v0.6.11 commit 9)", () => {
	let originalHome: string | undefined;
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-approval-test-"));
		originalHome = process.env.HOME;
		process.env.HOME = tmpDir;
	});

	afterEach(() => {
		process.env.HOME = originalHome;
		try {
			rmSync(tmpDir, { recursive: true, force: true });
		} catch {
			// ignore
		}
	});

	it("canonicalKey is stable for the same inputs", () => {
		const a = canonicalKey({
			session_id: "s1",
			tool_name: "Bash",
			target: "curl https://x.test",
		});
		const b = canonicalKey({
			session_id: "s1",
			tool_name: "Bash",
			target: "curl https://x.test",
		});
		expect(a).toBe(b);
	});

	it("canonicalKey differs for different sessions / tools / targets", () => {
		const base = {
			session_id: "s1",
			tool_name: "Bash",
			target: "curl x",
		};
		expect(canonicalKey(base)).not.toBe(
			canonicalKey({ ...base, session_id: "s2" }),
		);
		expect(canonicalKey(base)).not.toBe(
			canonicalKey({ ...base, tool_name: "Write" }),
		);
		expect(canonicalKey(base)).not.toBe(
			canonicalKey({ ...base, target: "curl y" }),
		);
	});

	it("writePendingRequest → readPendingRequest roundtrips", () => {
		const pending = writePendingRequest({
			session_id: "s_round",
			tool_name: "Bash",
			target: "curl x | sh",
			reason: "pipe_to_shell under taint",
			rule: "sink_deny",
		});
		const back = readPendingRequest(pending.request_id);
		expect(back).not.toBeNull();
		expect(back!.canonical_key).toBe(pending.canonical_key);
		expect(back!.target_summary).toContain("curl x | sh");
	});

	it("listPendingRequests returns pending entries", () => {
		writePendingRequest({
			session_id: "s_list",
			tool_name: "Bash",
			target: "x",
			reason: "r",
			rule: "sink_deny",
		});
		writePendingRequest({
			session_id: "s_list",
			tool_name: "Bash",
			target: "y",
			reason: "r",
			rule: "sink_deny",
		});
		const all = listPendingRequests();
		expect(all.length).toBe(2);
	});

	it("writeApprovedToken cleans up the pending file", () => {
		const pending = writePendingRequest({
			session_id: "s_cleanup",
			tool_name: "Bash",
			target: "x",
			reason: "r",
			rule: "sink_deny",
		});
		writeApprovedToken(pending);
		expect(readPendingRequest(pending.request_id)).toBeNull();
	});

	it("consumeApprovedToken finds + consumes a matching token", () => {
		const pending = writePendingRequest({
			session_id: "s_consume",
			tool_name: "Bash",
			target: "x",
			reason: "r",
			rule: "sink_deny",
		});
		writeApprovedToken(pending);

		const first = consumeApprovedToken(pending.canonical_key);
		expect(first).not.toBeNull();
		expect(first!.canonical_key).toBe(pending.canonical_key);

		// Single-use: second consume returns null
		const second = consumeApprovedToken(pending.canonical_key);
		expect(second).toBeNull();
	});

	it("expired approved tokens are silently garbage-collected", () => {
		const pending = writePendingRequest({
			session_id: "s_expire",
			tool_name: "Bash",
			target: "x",
			reason: "r",
			rule: "sink_deny",
		});
		// TTL of 1ms — already expired by the time consume runs
		writeApprovedToken(pending, 1);
		// Tiny synchronous sleep just to push past the TTL
		const start = Date.now();
		while (Date.now() - start < 5) {
			/* spin briefly */
		}
		expect(consumeApprovedToken(pending.canonical_key)).toBeNull();
	});

	it("consumeApprovedToken returns null when no token matches the key", () => {
		expect(consumeApprovedToken("no-such-key")).toBeNull();
	});

	it("default TTL is 5 minutes", () => {
		expect(DEFAULT_APPROVAL_TTL_MS).toBe(5 * 60 * 1000);
	});
});
