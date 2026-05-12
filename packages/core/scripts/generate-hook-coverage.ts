#!/usr/bin/env node
/**
 * Generates `docs/hook-coverage.md` from the tool registry. Run via:
 *   pnpm --filter @patchwork/core exec tsx scripts/generate-hook-coverage.ts
 *
 * The doc is the user-facing coverage matrix promised by design 3.6: every
 * Claude Code tool × {pre/post phase, taint source, sink eligibility,
 * default safety mode, hook-failure behavior, malformed-payload behavior,
 * timeout}. It MUST stay in sync with `tool-registry.ts`; the invariant
 * test in `tests/core/tool-event-registry.test.ts` enforces the registry
 * contract, and this script regenerates the doc from the same source.
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	listToolRegistry,
	getMcpPrefixEntry,
	type ToolRegistryEntry,
} from "../src/core/tool-registry.js";
import { POLICY_VERSION } from "../src/core/normalize-tool-event.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const OUT = resolve(REPO_ROOT, "docs/hook-coverage.md");

function row(e: ToolRegistryEntry): string {
	const yn = (b: boolean) => (b ? "✅" : "❌");
	return `| \`${e.tool}\` | ${yn(e.pre_guarded)} | ${yn(e.post_logged)} | ${yn(e.taint_source)} | ${yn(e.sink_eligible)} | ${e.default_mode} | ${e.hook_failure} | ${e.malformed_payload} | ${e.timeout_ms}ms |`;
}

const entries = listToolRegistry();
const mcp = getMcpPrefixEntry();

const out = `# Patchwork hook coverage matrix

**Auto-generated** from \`packages/core/src/core/tool-registry.ts\` by
\`packages/core/scripts/generate-hook-coverage.ts\`. Do not edit by hand —
re-run the generator after registry changes.

**Policy version**: \`${POLICY_VERSION}\`

This doc is the answer to "for which Claude Code tools does Patchwork enforce
safety policy, and what happens if a hook fails or a payload is malformed?"
The registry is the single source of truth. An unknown tool name reaching
PreToolUse fails closed in enforce mode (release-gate scenario 14 in
\`DESIGN/v0.6.11.md\`).

## Column meanings

| Column | Meaning |
|---|---|
| pre | Patchwork hooks observe this tool's PreToolUse phase. Sink classifiers run here. |
| post | Patchwork hooks observe this tool's PostToolUse phase. Audit logging + taint registration run here. |
| taint | This tool's output can register taint (\`prompt\` / \`secret\` / \`network_content\` / \`mcp\` / \`generated_file\`) into the session. |
| sink | This tool can drive a sensitive sink (file write, command, network). |
| mode | Default safety mode at v0.6.11 ship. \`enforce\` = denials are blocking; \`advisory\` = denials are logged but not blocking. |
| hook fail | Behavior when a hook for this tool throws or times out. |
| malformed | Behavior when the hook payload is malformed (unknown schema fields, missing required field). |
| timeout | Hook execution timeout. Hooks exceeding this trip the \`hook fail\` behavior. |

## Tools

| tool | pre | post | taint | sink | mode | hook fail | malformed | timeout |
|---|---|---|---|---|---|---|---|---|
${entries.map(row).join("\n")}

## MCP tools (prefix matcher)

Any tool whose name starts with \`mcp:\` or \`mcp__\` falls through to this
entry. All MCP responses are tainted by default; any MCP tool that drives
filesystem/network/command effects is sink-eligible.

| tool | pre | post | taint | sink | mode | hook fail | malformed | timeout |
|---|---|---|---|---|---|---|---|---|
${row(mcp)}

## Tool descriptions

${entries.map((e) => `### \`${e.tool}\`\n\n${e.description}`).join("\n\n")}

### \`mcp:*\` (MCP prefix)

${mcp.description}

## What's NOT in this matrix (v0.6.11)

- **Subagent (\`Task\`) parent-session taint propagation** — child sessions
  start clean. Tracked for v0.7.0.
- **Cross-session persistent taint** — same-session only in v0.6.11.
  Tracked for v0.6.12.
- **Per-MCP-server trust profiles** — all MCP is treated identically as
  default-untrusted. Per-server granularity tracked for v0.6.12.
`;

writeFileSync(OUT, out);
process.stdout.write(`wrote ${OUT}\n`);
