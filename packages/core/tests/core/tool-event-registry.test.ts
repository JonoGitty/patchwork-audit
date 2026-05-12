import { describe, it, expect } from "vitest";
import {
	lookupToolRegistry,
	listToolRegistry,
	getMcpPrefixEntry,
} from "../../src/core/tool-registry.js";
import {
	normalizeToolEvent,
	POLICY_VERSION,
} from "../../src/core/normalize-tool-event.js";
import { ToolEventSchema } from "../../src/core/tool-event.js";

describe("tool registry", () => {
	it("covers every Claude Code tool Patchwork v0.6.11 must reason about", () => {
		const required = [
			"Bash",
			"Read",
			"Write",
			"Edit",
			"MultiEdit",
			"NotebookEdit",
			"WebFetch",
			"WebSearch",
			"Glob",
			"Grep",
			"Task",
			"TodoWrite",
			"ExitPlanMode",
		];
		for (const tool of required) {
			const entry = lookupToolRegistry(tool);
			expect(entry, `tool '${tool}' must be registered`).toBeDefined();
		}
	});

	it("registry entries have well-formed metadata for every required field", () => {
		for (const entry of listToolRegistry()) {
			expect(entry.tool.length).toBeGreaterThan(0);
			expect(entry.description.length).toBeGreaterThan(0);
			expect(typeof entry.pre_guarded).toBe("boolean");
			expect(typeof entry.post_logged).toBe("boolean");
			expect(typeof entry.taint_source).toBe("boolean");
			expect(typeof entry.sink_eligible).toBe("boolean");
			expect(["advisory", "enforce"]).toContain(entry.default_mode);
			expect(["fail_closed", "fail_open_with_audit"]).toContain(entry.hook_failure);
			expect(["fail_closed", "fail_open_with_audit"]).toContain(entry.malformed_payload);
			expect(entry.timeout_ms).toBeGreaterThan(0);
			expect(entry.timeout_ms).toBeLessThanOrEqual(10000);
		}
	});

	it("Bash registers as enforce + fail-closed (highest-risk tool)", () => {
		const bash = lookupToolRegistry("Bash");
		expect(bash?.default_mode).toBe("enforce");
		expect(bash?.hook_failure).toBe("fail_closed");
		expect(bash?.malformed_payload).toBe("fail_closed");
		expect(bash?.sink_eligible).toBe(true);
		expect(bash?.taint_source).toBe(true);
	});

	it("Write/Edit/MultiEdit/NotebookEdit are all sink-eligible (Claude-native persistence sinks)", () => {
		for (const tool of ["Write", "Edit", "MultiEdit", "NotebookEdit"]) {
			const entry = lookupToolRegistry(tool);
			expect(entry?.sink_eligible, `${tool} must be sink-eligible`).toBe(true);
			expect(entry?.default_mode).toBe("enforce");
			expect(entry?.hook_failure).toBe("fail_closed");
		}
	});

	it("Read is a taint source but not sink-eligible (it cannot mutate state directly)", () => {
		const read = lookupToolRegistry("Read");
		expect(read?.taint_source).toBe(true);
		expect(read?.sink_eligible).toBe(false);
	});

	it("WebFetch is both a taint source and a sink (network egress)", () => {
		const wf = lookupToolRegistry("WebFetch");
		expect(wf?.taint_source).toBe(true);
		expect(wf?.sink_eligible).toBe(true);
		expect(wf?.default_mode).toBe("enforce");
	});

	it("MCP tools route through the prefix entry (default-untrusted)", () => {
		const mcp = lookupToolRegistry("mcp:github:create_issue");
		expect(mcp).toBeDefined();
		expect(mcp?.taint_source).toBe(true);
		expect(mcp?.sink_eligible).toBe(true);
		expect(mcp?.default_mode).toBe("enforce");
		expect(mcp?.hook_failure).toBe("fail_closed");
	});

	it("MCP underscore-form names also resolve via prefix matcher", () => {
		const mcp = lookupToolRegistry("mcp__github__create_issue");
		expect(mcp).toBeDefined();
		expect(mcp?.taint_source).toBe(true);
		expect(mcp?.sink_eligible).toBe(true);
	});

	it("mcp prefix entry is exposed for docs generation", () => {
		const entry = getMcpPrefixEntry();
		expect(entry.tool).toBe("mcp:");
		expect(entry.taint_source).toBe(true);
	});

	it("unknown tool name returns undefined (forces caller to fail closed under enforce)", () => {
		expect(lookupToolRegistry("NotARealTool")).toBeUndefined();
		expect(lookupToolRegistry("Hostile")).toBeUndefined();
		expect(lookupToolRegistry("")).toBeUndefined();
	});
});

describe("normalizeToolEvent", () => {
	const baseInput = {
		cwd: "/Users/test/project",
		project_root: "/Users/test/project",
		raw_input: { command: "ls" },
	} as const;

	it("produces a schema-valid ToolEvent for a covered tool", () => {
		const result = normalizeToolEvent({
			...baseInput,
			tool: "Bash",
			phase: "pre",
			safety_mode: "enforce",
		});
		expect(result.covered).toBe(true);
		expect(result.fail_closed).toBe(false);
		const parsed = ToolEventSchema.safeParse(result.event);
		expect(parsed.success).toBe(true);
		expect(result.event.policy_version).toBe(POLICY_VERSION);
		expect(result.event.tool).toBe("Bash");
		expect(result.event.phase).toBe("pre");
	});

	it("preserves raw_input verbatim (taint engine and approval tokens hash this)", () => {
		const raw = { command: "echo hi", custom_field: { nested: 42 } };
		const result = normalizeToolEvent({
			...baseInput,
			tool: "Bash",
			phase: "pre",
			raw_input: raw,
			safety_mode: "enforce",
		});
		expect(result.event.raw_input).toBe(raw);
	});

	it("FAIL-CLOSED: unknown tool in enforce mode (release-gate scenario 14)", () => {
		const result = normalizeToolEvent({
			...baseInput,
			tool: "FuturisticToolThatIsntInRegistry",
			phase: "pre",
			safety_mode: "enforce",
		});
		expect(result.covered).toBe(false);
		expect(result.fail_closed).toBe(true);
		expect(result.failure_reason).toContain("unknown tool");
		expect(result.failure_reason).toContain("FuturisticToolThatIsntInRegistry");
	});

	it("ADVISORY: unknown tool in advisory mode does not fail closed (still flags uncovered)", () => {
		const result = normalizeToolEvent({
			...baseInput,
			tool: "FuturisticToolThatIsntInRegistry",
			phase: "pre",
			safety_mode: "advisory",
		});
		expect(result.covered).toBe(false);
		expect(result.fail_closed).toBe(false);
		expect(result.failure_reason).toBeDefined();
	});

	it("PRE-only tool fired on POST is uncovered but does not fail closed", () => {
		const result = normalizeToolEvent({
			...baseInput,
			tool: "ExitPlanMode",
			phase: "pre",
			safety_mode: "enforce",
		});
		expect(result.covered).toBe(false);
		expect(result.fail_closed).toBe(false);
		expect(result.failure_reason).toContain("does not declare coverage for phase");
	});

	it("MCP tool routes through prefix matcher and is covered for both phases", () => {
		const pre = normalizeToolEvent({
			...baseInput,
			tool: "mcp:github:create_issue",
			phase: "pre",
			safety_mode: "enforce",
		});
		const post = normalizeToolEvent({
			...baseInput,
			tool: "mcp:github:create_issue",
			phase: "post",
			safety_mode: "enforce",
		});
		expect(pre.covered).toBe(true);
		expect(post.covered).toBe(true);
		expect(pre.fail_closed).toBe(false);
	});

	it("policy version is non-empty and stamped on every event", () => {
		expect(POLICY_VERSION.length).toBeGreaterThan(0);
		const result = normalizeToolEvent({
			...baseInput,
			tool: "Read",
			phase: "post",
			safety_mode: "enforce",
		});
		expect(result.event.policy_version).toBe(POLICY_VERSION);
	});

	it("ToolEventSchema accepts the minimal shape (target_paths/urls/hosts default to empty arrays)", () => {
		const result = normalizeToolEvent({
			...baseInput,
			tool: "Read",
			phase: "post",
			safety_mode: "enforce",
		});
		expect(result.event.target_paths).toEqual([]);
		expect(result.event.urls).toEqual([]);
		expect(result.event.hosts).toEqual([]);
	});
});

describe("registry coverage invariant", () => {
	it("EVERY entry that is sink_eligible defaults to enforce (high-confidence sinks ship enforced per design 3.7)", () => {
		for (const entry of listToolRegistry()) {
			if (entry.sink_eligible) {
				expect(
					entry.default_mode,
					`${entry.tool} is sink-eligible — must default to enforce per design 3.7`,
				).toBe("enforce");
				expect(
					entry.hook_failure,
					`${entry.tool} is sink-eligible — hook failure must be fail_closed`,
				).toBe("fail_closed");
				expect(
					entry.malformed_payload,
					`${entry.tool} is sink-eligible — malformed payload must be fail_closed`,
				).toBe("fail_closed");
			}
		}
	});

	it("EVERY entry that declares pre_guarded also declares post_logged (PreToolUse without PostToolUse is a coverage hole)", () => {
		for (const entry of listToolRegistry()) {
			if (entry.pre_guarded) {
				expect(
					entry.post_logged,
					`${entry.tool} is pre_guarded but not post_logged — sinks observed at PreToolUse must also be audit-logged at PostToolUse`,
				).toBe(true);
			}
		}
	});

	it("MCP prefix entry inherits the strictest defaults (all MCP output is untrusted)", () => {
		const mcp = getMcpPrefixEntry();
		expect(mcp.taint_source).toBe(true);
		expect(mcp.sink_eligible).toBe(true);
		expect(mcp.default_mode).toBe("enforce");
		expect(mcp.hook_failure).toBe("fail_closed");
		expect(mcp.malformed_payload).toBe("fail_closed");
	});

	it("no two registry entries share the same tool name", () => {
		const names = listToolRegistry().map((e) => e.tool);
		const unique = new Set(names);
		expect(unique.size).toBe(names.length);
	});
});
