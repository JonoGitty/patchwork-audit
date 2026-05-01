# Patchwork hook coverage matrix

**Auto-generated** from `packages/core/src/core/tool-registry.ts` by
`packages/core/scripts/generate-hook-coverage.ts`. Do not edit by hand —
re-run the generator after registry changes.

**Policy version**: `v0.6.11-pre.1`

This doc is the answer to "for which Claude Code tools does Patchwork enforce
safety policy, and what happens if a hook fails or a payload is malformed?"
The registry is the single source of truth. An unknown tool name reaching
PreToolUse fails closed in enforce mode (release-gate scenario 14 in
`DESIGN/v0.6.11.md`).

## Column meanings

| Column | Meaning |
|---|---|
| pre | Patchwork hooks observe this tool's PreToolUse phase. Sink classifiers run here. |
| post | Patchwork hooks observe this tool's PostToolUse phase. Audit logging + taint registration run here. |
| taint | This tool's output can register taint (`prompt` / `secret` / `network_content` / `mcp` / `generated_file`) into the session. |
| sink | This tool can drive a sensitive sink (file write, command, network). |
| mode | Default safety mode at v0.6.11 ship. `enforce` = denials are blocking; `advisory` = denials are logged but not blocking. |
| hook fail | Behavior when a hook for this tool throws or times out. |
| malformed | Behavior when the hook payload is malformed (unknown schema fields, missing required field). |
| timeout | Hook execution timeout. Hooks exceeding this trip the `hook fail` behavior. |

## Tools

| tool | pre | post | taint | sink | mode | hook fail | malformed | timeout |
|---|---|---|---|---|---|---|---|---|
| `Bash` | ✅ | ✅ | ✅ | ✅ | enforce | fail_closed | fail_closed | 5000ms |
| `Read` | ✅ | ✅ | ✅ | ❌ | enforce | fail_closed | fail_closed | 3000ms |
| `Write` | ✅ | ✅ | ❌ | ✅ | enforce | fail_closed | fail_closed | 3000ms |
| `Edit` | ✅ | ✅ | ❌ | ✅ | enforce | fail_closed | fail_closed | 3000ms |
| `MultiEdit` | ✅ | ✅ | ❌ | ✅ | enforce | fail_closed | fail_closed | 3000ms |
| `NotebookEdit` | ✅ | ✅ | ❌ | ✅ | enforce | fail_closed | fail_closed | 3000ms |
| `WebFetch` | ✅ | ✅ | ✅ | ✅ | enforce | fail_closed | fail_closed | 3000ms |
| `WebSearch` | ❌ | ✅ | ✅ | ❌ | advisory | fail_open_with_audit | fail_open_with_audit | 3000ms |
| `Glob` | ❌ | ✅ | ❌ | ❌ | advisory | fail_open_with_audit | fail_open_with_audit | 3000ms |
| `Grep` | ❌ | ✅ | ❌ | ❌ | advisory | fail_open_with_audit | fail_open_with_audit | 3000ms |
| `TodoWrite` | ❌ | ✅ | ❌ | ❌ | advisory | fail_open_with_audit | fail_open_with_audit | 1000ms |
| `Task` | ✅ | ✅ | ❌ | ❌ | advisory | fail_closed | fail_closed | 5000ms |
| `ExitPlanMode` | ❌ | ❌ | ❌ | ❌ | advisory | fail_open_with_audit | fail_open_with_audit | 1000ms |

## MCP tools (prefix matcher)

Any tool whose name starts with `mcp:` or `mcp__` falls through to this
entry. All MCP responses are tainted by default; any MCP tool that drives
filesystem/network/command effects is sink-eligible.

| tool | pre | post | taint | sink | mode | hook fail | malformed | timeout |
|---|---|---|---|---|---|---|---|---|
| `mcp:` | ✅ | ✅ | ✅ | ✅ | enforce | fail_closed | fail_closed | 5000ms |

## Tool descriptions

### `Bash`

Shell command execution. Highest-risk surface — all sink classes can route through it.

### `Read`

File read. Source of `prompt` taint for untrusted-content paths and `secret` taint for credential-class paths.

### `Write`

File write. First-class sink for `claude_file_write_persistence` (shell rc, git hooks, CI config, etc).

### `Edit`

Single-file edit. Same sink class as Write.

### `MultiEdit`

Multi-edit on a single file. Same sink class as Write.

### `NotebookEdit`

Jupyter notebook cell edit. Same sink class as Write.

### `WebFetch`

External HTTP fetch. Source of `network_content` and `prompt` taint; also subject to network egress allowlist.

### `WebSearch`

External search. Result content registers `network_content` taint at PostToolUse.

### `Glob`

Filesystem glob. Read-only listing; no taint registration in v0.6.11.

### `Grep`

Filesystem grep. Read-only; no taint registration in v0.6.11 (matched lines are arguably untrusted but tracking that is deferred to v0.6.12).

### `TodoWrite`

Internal todo-list updates. No filesystem or network effect.

### `Task`

Subagent spawn. The subagent runs its own session — Patchwork does not currently propagate parent-session taint into the child (deferred to v0.7.0).

### `ExitPlanMode`

Plan-mode exit signal. No effect on filesystem or network.

### `mcp:*` (MCP prefix)

MCP server tool (any). Default-untrusted: response registers `mcp` and `prompt` taint. MCP tools that drive filesystem/network/command effects are sink-eligible.

## What's NOT in this matrix (v0.6.11)

- **Subagent (`Task`) parent-session taint propagation** — child sessions
  start clean. Tracked for v0.7.0.
- **Cross-session persistent taint** — same-session only in v0.6.11.
  Tracked for v0.6.12.
- **Per-MCP-server trust profiles** — all MCP is treated identically as
  default-untrusted. Per-server granularity tracked for v0.6.12.
