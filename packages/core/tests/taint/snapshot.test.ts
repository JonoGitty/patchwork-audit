import { describe, it, expect } from "vitest";
import picomatch from "picomatch";
import {
	createSnapshot,
	registerTaint,
	registerGeneratedFile,
	clearTaint,
	forgetGeneratedFile,
	hasAnyTaint,
	hasKind,
	getActiveSources,
	getAllSources,
	isFileGenerated,
	getGeneratedFileSources,
	isPathUntrustedRepo,
	ALL_TAINT_KINDS,
	RAISES_FOR_TOOL,
	FORCE_UNTRUSTED_PATTERNS,
} from "../../src/taint/snapshot.js";

const matchGlob = (path: string, pattern: string): boolean =>
	picomatch(pattern, { nocase: true, dot: true })(path);

const SRC = (overrides: Partial<{ ts: number; ref: string; content_hash: string }> = {}) => ({
	ts: 1_700_000_000_000,
	ref: "https://example.test/x",
	content_hash: "deadbeef",
	...overrides,
});

describe("createSnapshot", () => {
	it("returns an empty snapshot with all five kinds initialized", () => {
		const s = createSnapshot("sess-1");
		expect(s.session_id).toBe("sess-1");
		for (const kind of ALL_TAINT_KINDS) {
			expect(s.by_kind[kind]).toEqual([]);
		}
		expect(s.generated_files).toEqual({});
	});

	it("ALL_TAINT_KINDS lists exactly five kinds in declaration order", () => {
		expect(ALL_TAINT_KINDS).toEqual([
			"prompt",
			"secret",
			"network_content",
			"mcp",
			"generated_file",
		]);
	});
});

describe("registerTaint", () => {
	it("appends a source to the matching kind", () => {
		const s0 = createSnapshot("sess");
		const s1 = registerTaint(s0, "prompt", SRC({ ref: "README.md" }));
		expect(s1.by_kind.prompt).toHaveLength(1);
		expect(s1.by_kind.prompt[0].ref).toBe("README.md");
	});

	it("does not mutate the input snapshot (immutability)", () => {
		const s0 = createSnapshot("sess");
		const s1 = registerTaint(s0, "prompt", SRC());
		expect(s0.by_kind.prompt).toEqual([]);
		expect(s1).not.toBe(s0);
	});

	it("rejects callers that try to seed a cleared field", () => {
		const s0 = createSnapshot("sess");
		expect(() =>
			registerTaint(s0, "prompt", {
				...SRC(),
				cleared: { ts: 0, method: "out_of_band", scope: ["prompt"] },
			} as any),
		).toThrow(/cleared field is reserved/);
	});

	it("supports all five kinds independently", () => {
		let s = createSnapshot("sess");
		for (const kind of ALL_TAINT_KINDS) {
			s = registerTaint(s, kind, SRC({ ref: `src-${kind}` }));
		}
		for (const kind of ALL_TAINT_KINDS) {
			expect(s.by_kind[kind]).toHaveLength(1);
		}
	});
});

describe("registerGeneratedFile", () => {
	it("tags a path with current taint provenance", () => {
		const s0 = createSnapshot("sess");
		const s1 = registerTaint(s0, "prompt", SRC({ ref: "README.md" }));
		const s2 = registerGeneratedFile(s1, "/repo/installer.sh", getActiveSources(s1, "prompt"));
		expect(isFileGenerated(s2, "/repo/installer.sh")).toBe(true);
		expect(getGeneratedFileSources(s2, "/repo/installer.sh")[0].ref).toBe("README.md");
	});

	it("mirrors generated-file provenance into by_kind.generated_file", () => {
		const s0 = createSnapshot("sess");
		const s1 = registerTaint(s0, "prompt", SRC({ ref: "README.md" }));
		const s2 = registerGeneratedFile(s1, "/repo/installer.sh", getActiveSources(s1, "prompt"));
		expect(hasKind(s2, "generated_file")).toBe(true);
		expect(getActiveSources(s2, "generated_file")[0].ref).toBe("/repo/installer.sh");
	});

	it("filters out cleared upstream sources from provenance", () => {
		const s0 = createSnapshot("sess");
		const s1 = registerTaint(s0, "prompt", SRC({ ref: "old" }));
		const s2 = clearTaint(s1, "prompt", { ts: 999, method: "out_of_band" });
		// Active list is empty, but generated-file should still record
		// nothing (cleared upstream). This tests that we filter.
		const s3 = registerGeneratedFile(s2, "/repo/x", s2.by_kind.prompt);
		expect(isFileGenerated(s3, "/repo/x")).toBe(false);
	});

	it("appends to existing path entry when same path is written twice", () => {
		let s = createSnapshot("sess");
		s = registerTaint(s, "prompt", SRC({ ref: "first" }));
		s = registerGeneratedFile(s, "/repo/x", getActiveSources(s, "prompt"));
		s = registerTaint(s, "network_content", SRC({ ref: "second" }));
		s = registerGeneratedFile(s, "/repo/x", getActiveSources(s, "network_content"));
		expect(getGeneratedFileSources(s, "/repo/x")).toHaveLength(2);
	});
});

describe("clearTaint", () => {
	it("marks all current prompt sources as cleared (audit trail preserved)", () => {
		let s = createSnapshot("sess");
		s = registerTaint(s, "prompt", SRC({ ref: "a" }));
		s = registerTaint(s, "prompt", SRC({ ref: "b" }));
		const cleared = clearTaint(s, "prompt", { ts: 1234, method: "out_of_band" });
		expect(cleared.by_kind.prompt).toHaveLength(2);
		expect(cleared.by_kind.prompt[0].cleared?.ts).toBe(1234);
		expect(cleared.by_kind.prompt[1].cleared?.method).toBe("out_of_band");
		expect(hasKind(cleared, "prompt")).toBe(false);
	});

	it("rejects clearing secret without allowSecretClear flag", () => {
		let s = createSnapshot("sess");
		s = registerTaint(s, "secret", SRC({ ref: ".env" }));
		expect(() =>
			clearTaint(s, "secret", { ts: 1, method: "out_of_band" }),
		).toThrow(/allowSecretClear/);
	});

	it("clears secret only when allowSecretClear=true", () => {
		let s = createSnapshot("sess");
		s = registerTaint(s, "secret", SRC({ ref: ".env" }));
		const cleared = clearTaint(s, "secret", {
			ts: 1,
			method: "out_of_band",
			allowSecretClear: true,
		});
		expect(hasKind(cleared, "secret")).toBe(false);
	});

	it("does not double-clear an already-cleared source", () => {
		let s = createSnapshot("sess");
		s = registerTaint(s, "prompt", SRC());
		const c1 = clearTaint(s, "prompt", { ts: 100, method: "out_of_band" });
		const c2 = clearTaint(c1, "prompt", { ts: 200, method: "config_trusted" });
		expect(c2.by_kind.prompt[0].cleared?.ts).toBe(100);
		expect(c2.by_kind.prompt[0].cleared?.method).toBe("out_of_band");
	});

	it("clearing one kind does not affect others", () => {
		let s = createSnapshot("sess");
		s = registerTaint(s, "prompt", SRC());
		s = registerTaint(s, "network_content", SRC());
		const c = clearTaint(s, "prompt", { ts: 1, method: "out_of_band" });
		expect(hasKind(c, "prompt")).toBe(false);
		expect(hasKind(c, "network_content")).toBe(true);
	});

	it("does not mutate the input snapshot", () => {
		let s = createSnapshot("sess");
		s = registerTaint(s, "prompt", SRC());
		const original = JSON.parse(JSON.stringify(s));
		clearTaint(s, "prompt", { ts: 1, method: "out_of_band" });
		expect(s).toEqual(original);
	});
});

describe("forgetGeneratedFile", () => {
	it("removes path from generated_files", () => {
		let s = createSnapshot("sess");
		s = registerTaint(s, "prompt", SRC());
		s = registerGeneratedFile(s, "/repo/x", getActiveSources(s, "prompt"));
		const f = forgetGeneratedFile(s, "/repo/x", { ts: 1, method: "out_of_band" });
		expect(isFileGenerated(f, "/repo/x")).toBe(false);
		expect(f.generated_files["/repo/x"]).toBeUndefined();
	});

	it("tombstones the by_kind.generated_file entries scoped to that path", () => {
		let s = createSnapshot("sess");
		s = registerTaint(s, "prompt", SRC());
		s = registerGeneratedFile(s, "/repo/x", getActiveSources(s, "prompt"));
		s = registerGeneratedFile(s, "/repo/y", getActiveSources(s, "prompt"));
		const f = forgetGeneratedFile(s, "/repo/x", { ts: 999, method: "out_of_band" });
		const all = getAllSources(f, "generated_file");
		const xs = all.filter((src) => src.ref === "/repo/x");
		const ys = all.filter((src) => src.ref === "/repo/y");
		expect(xs.every((src) => !!src.cleared)).toBe(true);
		expect(ys.every((src) => !src.cleared)).toBe(true);
	});
});

describe("hasAnyTaint / hasKind / getActiveSources", () => {
	it("hasAnyTaint is false on empty snapshot", () => {
		expect(hasAnyTaint(createSnapshot("sess"))).toBe(false);
	});

	it("hasAnyTaint becomes true after registering any kind", () => {
		const s = registerTaint(createSnapshot("sess"), "mcp", SRC());
		expect(hasAnyTaint(s)).toBe(true);
	});

	it("hasAnyTaint is false again after clearing the only kind", () => {
		let s = createSnapshot("sess");
		s = registerTaint(s, "prompt", SRC());
		s = clearTaint(s, "prompt", { ts: 1, method: "out_of_band" });
		expect(hasAnyTaint(s)).toBe(false);
	});

	it("getActiveSources returns only non-cleared sources", () => {
		let s = createSnapshot("sess");
		s = registerTaint(s, "prompt", SRC({ ref: "a" }));
		s = clearTaint(s, "prompt", { ts: 1, method: "out_of_band" });
		s = registerTaint(s, "prompt", SRC({ ref: "b" }));
		expect(getActiveSources(s, "prompt").map((x) => x.ref)).toEqual(["b"]);
	});

	it("getAllSources returns cleared and non-cleared", () => {
		let s = createSnapshot("sess");
		s = registerTaint(s, "prompt", SRC({ ref: "a" }));
		s = clearTaint(s, "prompt", { ts: 1, method: "out_of_band" });
		s = registerTaint(s, "prompt", SRC({ ref: "b" }));
		expect(getAllSources(s, "prompt")).toHaveLength(2);
	});
});

describe("isPathUntrustedRepo", () => {
	const projectRoot = "/repo";

	it("treats README inside the project as untrusted (default-untrusted)", () => {
		expect(
			isPathUntrustedRepo("/repo/README.md", { projectRoot, matchGlob }),
		).toBe(true);
	});

	it("treats /repo/docs/foo.md as untrusted (default-untrusted)", () => {
		expect(
			isPathUntrustedRepo("/repo/docs/foo.md", { projectRoot, matchGlob }),
		).toBe(true);
	});

	it("treats node_modules contents as untrusted even with broad trusted_paths", () => {
		expect(
			isPathUntrustedRepo("/repo/node_modules/foo/index.js", {
				projectRoot,
				matchGlob,
				trustedPaths: ["**"],
			}),
		).toBe(true);
	});

	it("treats CHANGELOG.md as untrusted regardless of trusted_paths whitelist", () => {
		expect(
			isPathUntrustedRepo("/repo/CHANGELOG.md", {
				projectRoot,
				matchGlob,
				trustedPaths: ["**"],
			}),
		).toBe(true);
	});

	it("treats out-of-project paths as untrusted", () => {
		expect(
			isPathUntrustedRepo("/var/log/system.log", { projectRoot, matchGlob }),
		).toBe(true);
	});

	it("trusts a path matched by trustedPaths if no force-untrusted hits", () => {
		expect(
			isPathUntrustedRepo("/repo/src/index.ts", {
				projectRoot,
				matchGlob,
				trustedPaths: ["**/src/**"],
			}),
		).toBe(false);
	});

	it("untrusts an in-repo path when no trustedPaths configured", () => {
		expect(
			isPathUntrustedRepo("/repo/src/index.ts", { projectRoot, matchGlob }),
		).toBe(true);
	});

	it("untrusts an in-repo path that doesn't match any trustedPaths pattern", () => {
		expect(
			isPathUntrustedRepo("/repo/src/index.ts", {
				projectRoot,
				matchGlob,
				trustedPaths: ["**/lib/**"],
			}),
		).toBe(true);
	});

	it("FORCE_UNTRUSTED_PATTERNS includes README, docs, node_modules, CHANGELOG", () => {
		const patterns = FORCE_UNTRUSTED_PATTERNS.join("|");
		expect(patterns).toMatch(/README/);
		expect(patterns).toMatch(/docs/);
		expect(patterns).toMatch(/node_modules/);
		expect(patterns).toMatch(/CHANGELOG/);
	});
});

describe("RAISES_FOR_TOOL", () => {
	it("WebFetch raises network_content + prompt", () => {
		expect(RAISES_FOR_TOOL.WebFetch).toEqual(["network_content", "prompt"]);
	});

	it("MCP prefix raises mcp + prompt", () => {
		expect(RAISES_FOR_TOOL["mcp:"]).toEqual(["mcp", "prompt"]);
	});

	it("Read raises prompt + secret (handler narrows)", () => {
		expect(RAISES_FOR_TOOL.Read).toEqual(["prompt", "secret"]);
	});

	it("all four Claude-native write tools raise generated_file", () => {
		for (const tool of ["Write", "Edit", "MultiEdit", "NotebookEdit"]) {
			expect(RAISES_FOR_TOOL[tool]).toEqual(["generated_file"]);
		}
	});

	it("Bash is intentionally empty until shell recognizer lands (commit 4)", () => {
		expect(RAISES_FOR_TOOL.Bash).toEqual([]);
	});
});
