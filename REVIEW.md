# Patchwork Strategy Review — Staff Engineer + Security

---

## 1. Top 10 Risks by Severity

### R1. CRITICAL — No tamper evidence whatsoever

The audit trail is trivially forgeable. Events are stored as plain JSON lines. SHA-256 hashes in `content.hash` only cover file content, not the event itself. An attacker (or the AI agent itself) can modify `events.jsonl`, recompute the content hash, and leave zero trace.

**No event signing. No hash chaining. No Merkle root. No HMAC.**

The strategy claims "append-only" and "immutable" (Section 2, Principle 5). This is marketing, not engineering. `appendFileSync` does not make a file immutable. Any process with write access can truncate, reorder, or rewrite the file.

For a product selling to "Enterprise security/compliance" and claiming EU AI Act / SOC 2 relevance, this is a disqualifying gap. A compliance auditor will ask "how do you prove this log wasn't tampered with?" and the answer today is "we can't."

**Where:** `packages/core/src/store/jsonl.ts:18-20`, `packages/core/src/hash/content.ts`

---

### R2. CRITICAL — Data files may be too broadly readable (umask-dependent; commonly 0644)

Both `~/.patchwork/events.jsonl` and `~/.patchwork/db/audit.db` are created with default umask permissions. On many developer systems this results in `-rw-r--r--` (0644), which allows any local user or process to read:

- Every command the developer executed via AI
- Every file path accessed (including credentials files)
- Session metadata, project structure, risk classifications
- Prompt hashes (and their sizes, which leak prompt length)

On a shared dev server, CI runner, or container environment, this is a data leak. For an audit product, leaking the audit trail is an own-goal.

**Where:** `packages/core/src/store/jsonl.ts:13-14`, `packages/core/src/store/sqlite.ts:16-17` — `mkdirSync` and file creation use default umask.

---

### R3. HIGH — Zod schemas are defined but never enforced at runtime

`AuditEventSchema` exists. It is never called with `.parse()` or `.safeParse()` anywhere in the codebase. Every read path uses `JSON.parse(line) as AuditEvent` — a TypeScript type assertion that evaporates at runtime.

This means:
- Corrupted JSONL lines produce undefined behavior, not validation errors
- A future schema change silently breaks old event reads
- There is no schema versioning — no `schema_version` field, no migration path
- The `raw_input`/`raw_output` fields in `ProvenanceSchema` accept `z.record(z.unknown())` — anything goes, no depth limit, no size limit

**Where:** `packages/core/src/store/jsonl.ts:31`, `packages/core/src/store/sqlite.ts:154`, `packages/cli/src/commands/hook.ts:19`

---

### R4. HIGH — Dual-write creates silent data divergence

The adapter writes to JSONL (primary) then SQLite (secondary). If SQLite fails, the error is swallowed with an empty `catch {}`. No log, no metric, no counter. The CLI reads from SQLite when it exists, JSONL when it doesn't.

Scenarios that cause divergence:
- SQLite disk full → events exist in JSONL but not SQLite
- SQLite locked by concurrent reader → write silently dropped
- SQLite schema migration fails on upgrade → all subsequent writes silently fail

The `sync db` command exists to rebuild, but nothing tells the user it's needed.

**Where:** `packages/agents/src/claude-code/adapter.ts:31-35`

---

### R5. HIGH — No idempotency key or deduplication contract

Events have a ULID `id` but no stable idempotency key. If a hook fires twice for the same tool use (network retry, process restart), two distinct events with different IDs are created. The Codex history parser deduplicates on `timestamp:content_hash` which collides when two different events have the same timestamp and no content (see `history-parser.ts:44`).

SQLite uses `INSERT OR IGNORE` on the primary key, but JSONL has no dedup at all. This means JSONL (the "source of truth") can contain duplicates that SQLite doesn't have. Running `sync db` would then skip the dupes. The two stores disagree on event count.

**Where:** `packages/agents/src/codex/history-parser.ts:44`, `packages/core/src/store/sqlite.ts:95`

---

### R6. HIGH — Privacy design is aspirational, not implemented

The strategy says "Privacy-safe defaults. Content hashing by default. Full content capture opt-in." (Section 2, Principle 4). Reality:

- **Absolute file paths** are stored in every file event, leaking `/Users/jonogompels/...` to the audit trail. No path normalization or redaction.
- **Full command strings** are stored verbatim, including arguments that may contain secrets (e.g., `curl -H "Authorization: Bearer sk-..."`)
- **Prompt size** is stored (`size_bytes`), which leaks prompt length even when content is "redacted"
- **`raw_input`/`raw_output`** fields exist in the schema with no guard — a future code change enabling them would capture passwords, API keys, file contents
- No retention policy is implemented. Events accumulate forever.
- No data deletion or right-to-erasure mechanism exists.

**Where:** `packages/agents/src/claude-code/adapter.ts:267`, `packages/core/src/schema/event.ts:53-58`

---

### R7. MEDIUM — Policy engine regex allows ReDoS

The command rule matcher creates a `new RegExp(rule.regex)` from user-supplied policy YAML. A catastrophic backtracking pattern like `(a+)+b` would block the PreToolUse hook, which has a 1000ms timeout. During that time, the AI agent hangs waiting for allow/deny.

On a busy machine with many policy evaluations, this is a denial-of-service vector against the AI agent itself.

**Where:** `packages/core/src/policy/engine.ts:248-253`

---

### R8. MEDIUM — No concurrency control between sessions

Multiple Claude Code sessions (different terminal windows, CI runners, VS Code instances) write to the same `events.jsonl` simultaneously. There is no application-level file locking around `appendFileSync`, so concurrent writes can interleave or corrupt lines under contention (especially with larger payloads or non-local filesystems).

SQLite handles this better via WAL mode, but the constructor opens a new connection per hook invocation (no connection pooling), which means lock contention under concurrent use.

**Where:** `packages/core/src/store/jsonl.ts:19`, `packages/agents/src/claude-code/adapter.ts:53-57`

---

### R9. MEDIUM — Hook timeout creates allow-by-default bypass

If the patchwork hook process takes longer than 1000ms (PreToolUse timeout in `installer.ts`), Claude Code receives no response. The default Claude Code behavior on hook timeout is to **proceed with the action**. This means:

- Policy enforcement is best-effort, not guaranteed
- Any I/O latency (slow disk, SQLite lock) silently bypasses policy
- The strategy positions policy enforcement as a paid enterprise feature — it doesn't actually enforce

The strategy should be explicit: Patchwork is audit-only by default. Policy is advisory, not a security boundary.

**Where:** `packages/agents/src/claude-code/installer.ts:19` (timeout: 1000)

---

### R10. MEDIUM — `readAll()` loads entire event history into memory

Every CLI command except `tail` calls `store.readAll()` or `store.query()` which reads the entire JSONL file into memory. After a few months of active use, this file could be 10-100MB. On a resource-constrained machine or CI environment, this causes:

- Slow startup for every CLI command
- OOM on large histories
- Blocked I/O during reads

SQLite mitigates this for indexed queries, but `readAll()` on the JSONL store has no pagination, streaming, or size guard.

**Where:** `packages/core/src/store/jsonl.ts:22-31`

---

## 2. STRATEGY.md Redline Edits

### Section 2: Architecture — Replace Core Design Principles

**Replace lines 86-92 with:**

```markdown
### Core Design Principles

1. **Local-first.** Everything works offline. Cloud sync is additive, never required.
2. **Zero-config start.** `patchwork init` sets up hooks for detected agents. That's it.
3. **Agent-agnostic schema.** One unified event format, regardless of which agent produced it.
4. **Privacy by default.** File paths are relative to project root. Absolute paths, prompt content, and tool I/O are never stored unless explicitly opted in. Content is hashed, not captured. Events have a configurable retention period (default: 90 days).
5. **Append-only with tamper evidence.** Events are cryptographically chained. Each event includes a `prev_hash` covering the previous event. Periodic Merkle roots are written to enable efficient integrity verification. JSONL files and directories are created with mode 0600/0700.
6. **Audit, not enforcement.** Policy evaluation is advisory. Hook timeouts and crashes default to allow. Patchwork is not a security boundary — it is an observability layer. Policy enforcement is documented as best-effort.
```

---

### Section 3: Unified Event Schema — Replace with versioned schema

**Replace lines 99-153 with:**

```markdown
### Unified Event Schema (v1)

Every action from every agent is normalized into one schema. The schema is versioned
to enable forward-compatible evolution.

```jsonc
{
  // Schema
  "schema_version": 1,             // Integer, bumped on breaking changes

  // Identity
  "id": "evt_01J8K...",            // ULID — unique, time-sortable
  "idempotency_key": "ses_01J8K...:PostToolUse:Write:abc123",
                                    // session:hook_event:tool:tool_use_id — stable across retries
  "session_id": "ses_01J8K...",
  "timestamp": "2026-02-12T14:30:00.123Z",

  // Tamper evidence
  "prev_hash": "sha256:...",       // SHA-256 of the previous event's JSON (chain)
  "event_hash": "sha256:...",      // SHA-256 of this event excluding event_hash field

  // Agent
  "agent": "claude-code",
  "agent_version": "2.1.39",

  // Action
  "action": "file_write",
  "status": "completed",
  "duration_ms": 45,

  // Target
  "target": {
    "type": "file",
    "path": "src/auth/login.ts",   // Relative to project root (ALWAYS)
    // abs_path intentionally omitted from default schema
  },

  // Context
  "project": {
    "root_hash": "sha256:...",     // Hash of project root path (not the path itself)
    "name": "my-project",
    "git_ref": "abc1234"
  },

  // Risk
  "risk": {
    "level": "low",
    "flags": ["sensitive_path"]
  },

  // Content (opt-in detail, redacted by default)
  "content": {
    "hash": "sha256:abc123...",    // Always present for file ops
    "before_hash": "sha256:...",   // For edits
    "size_bytes": 1842,
    "redacted": true
    // "summary" field available when opted in
  }

  // Provenance
  "provenance": {
    "hook_event": "PostToolUse",
    "tool_name": "Write"
    // raw_input/raw_output intentionally excluded from default schema
  }
}
```

**Privacy rules:**
- `abs_path` is NEVER stored by default. Only `path` relative to `project.root`.
- `project.root` is stored as a hash, not a path. `project.name` is the directory basename.
- `content.summary` and `provenance.raw_input/raw_output` require explicit opt-in via config.
- `content.size_bytes` is omitted for prompts (leaks prompt length).
```

---

### Section 9: MVP Feature Roadmap — Replace with realistic scope

**Replace lines 604-666 with:**

```markdown
## 9. Release Roadmap

### v0.1 — "Auditable Record" (4 weeks)

**Ship criterion:** A developer installs patchwork, runs a Claude Code session,
and can verify the audit trail is correct, tamper-evident, and private.

Core:
- [ ] Event schema v1 with schema_version, idempotency_key, prev_hash, event_hash
- [ ] JSONL store with 0600 file permissions
- [ ] SHA-256 content hashing
- [ ] Event hash chaining (prev_hash)
- [ ] Risk classifier
- [ ] Zod validation on write AND read (safeParse, skip invalid)

Claude Code integration:
- [ ] Hook handler for all 8 events
- [ ] `patchwork init claude-code`
- [ ] Policy engine (audit-only mode, no enforcement)

CLI (read-only):
- [ ] `patchwork log` with filters (--agent, --risk, --session, --since)
- [ ] `patchwork show <id>` (event and session detail)
- [ ] `patchwork sessions`
- [ ] `patchwork status`
- [ ] `patchwork export --format json`
- [ ] `patchwork verify` (validate hash chain integrity)

Privacy:
- [ ] Relative paths only (no abs_path in default config)
- [ ] No prompt content or size stored by default
- [ ] No raw_input/raw_output by default
- [ ] 0600 file permissions on all data files
- [ ] 0700 directory permissions on ~/.patchwork

Tests:
- [ ] 200+ unit tests passing
- [ ] Integration test: full Claude Code session round-trip

NOT in v0.1 (explicitly deferred):
- SQLite store (JSONL is sufficient for local use at v0.1 scale)
- `patchwork search` (requires SQLite FTS)
- `patchwork tail` (nice-to-have, not core)
- `patchwork diff`, `patchwork stats` (analysis features)
- Codex integration (Claude Code first, prove the model)
- Cloud sync, web dashboard, team features
- npm publish, Homebrew (ship to early testers via git clone first)

### v0.2 — "Query and Understand" (Weeks 5-8)

- SQLite indexed store (read-only layer, rebuilt from JSONL)
- `patchwork search` (FTS5)
- `patchwork tail`
- `patchwork summary`, `patchwork stats`, `patchwork diff`
- Codex history parser
- `patchwork export --format csv`
- Retention policy (auto-rotate JSONL after N days)
- npm publish

### v0.3 — "Teams" (Weeks 9-12)

- Policy enforcement mode (best-effort, documented limitations)
- Cloud sync foundation
- SARIF export
- Cursor integration (if hooks stabilize)
- Homebrew formula
- Launch: blog post, Show HN
```

---

### Section 2: Architecture Diagram — Replace

**Replace lines 36-83 with:**

````markdown
```text
                    LOCAL MACHINE
 ┌──────────────────────────────────────────────────┐
 │                                                  │
 │  ┌──────────┐  hooks   ┌─────────────────────┐  │
 │  │Claude    │────────→ │ patchwork hook       │  │
 │  │Code      │          │ (per-invocation CLI) │  │
 │  └──────────┘          │                      │  │
 │                        │  - validates input    │  │
 │  ┌──────────┐  parse   │  - normalizes schema  │  │
 │  │Codex     │────────→ │  - classifies risk    │  │
 │  │CLI       │          │  - chains event hash  │  │
 │  └──────────┘          │  - appends JSONL      │  │
 │                        └────────┬─────────────┘  │
 │                                 │                │
 │                        ┌────────▼────────────┐   │
 │                        │  ~/.patchwork/       │   │
 │                        │  ├── events.jsonl    │   │
 │                        │  └── config.toml     │   │
 │                        │  (mode 0700/0600)    │   │
 │                        └────────┬────────────┘   │
 │                                 │                │
 │                        ┌────────▼────────────┐   │
 │                        │  patchwork CLI       │   │
 │                        │  - log / show        │   │
 │                        │  - sessions / status │   │
 │                        │  - export / verify   │   │
 │                        └─────────────────────┘   │
 │                                                  │
 └──────────────────────────────────────────────────┘
```

Remove "patchwork daemon" — there is no daemon. Each hook invocation is a
standalone CLI process. Be honest about the architecture.

Remove `sessions.jsonl` — it doesn't exist in the implementation.

Remove SQLite from the v0.1 architecture diagram — it's a v0.2 feature.
````

---

### Section 6: Technology Choices — Fix the Ink claim

**Replace line 442:**

```markdown
| **CLI framework** | Commander.js | Commander for command parsing. chalk for colored output. No dependency on Ink/React — keep it simple. |
```

---

### Section 14: Risks — Add the actual risks

**Replace lines 810-820 with:**

```markdown
## 14. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Tamper evidence is weak** | Certain (current state) | Critical — invalidates compliance claims | Implement hash chaining before any compliance marketing. Do not claim SOC 2 or EU AI Act readiness until independently verified. |
| **Hook timeout bypasses policy** | High (any I/O latency) | High — "enforced" policies silently unenforced | Document clearly: policy is advisory. Patchwork is not a security boundary. Enforcement mode is best-effort with known timeout gaps. |
| **Data privacy leaks** | High (abs_path, commands stored) | Medium-High — GDPR/PII exposure | Ship relative paths only. Scrub secrets from commands. Add retention/deletion. |
| AI tool makers add native audit | High (12-18mo) | High | Ship fast, build community. Native audit will be per-tool; cross-tool unified view is the moat. |
| Gryph adds cloud features | Medium | Medium | Move faster on enterprise features. |
| Claude Code hook API changes | Medium | Low | Adapter pattern isolates changes. |
| Low developer adoption | Medium | High | Free tier must be genuinely useful. |
| **JSONL doesn't scale past 100K events** | Medium (after months of use) | Medium — CLI becomes unusably slow | Add SQLite in v0.2. Add `readAll()` memory guards. Add retention rotation. |
| Enterprise sales cycle too long | High | Medium | Focus on bottom-up adoption. |
```

---

## 3. Reduced v0.1 Scope (4 Weeks)

### Week 1: Schema + Store + Tamper Evidence
- Event schema v1 with `schema_version`, `idempotency_key`, `prev_hash`, `event_hash`
- JSONL store with 0600 permissions, 0700 directory
- Zod validation on write (`safeParse` — reject invalid events)
- Zod validation on read (`safeParse` — skip corrupt lines, count errors)
- SHA-256 content hashing
- Hash chaining (each event includes prev_hash of prior event)
- Risk classifier (existing, proven by tests)
- Unit tests for all of the above

### Week 2: Claude Code Integration
- Hook handler for all 8 events
- `patchwork init claude-code`
- Idempotency key generation from `session_id:hook_event:tool_name:tool_use_id`
- Relative path normalization (strip project root from abs paths)
- Privacy: omit `abs_path`, omit `size_bytes` from prompts, omit `raw_input`/`raw_output`
- Integration test: install hooks, simulate session, verify events

### Week 3: CLI + Policy
- `patchwork log` with filters (--agent, --risk, --session, --since, --action, --limit)
- `patchwork show <event-id>` and `patchwork show <session-id>`
- `patchwork sessions`
- `patchwork status`
- `patchwork export --format json`
- `patchwork verify` — new command, validates hash chain integrity
- `patchwork policy show` + `patchwork policy init`
- Policy engine (audit-only, no enforcement)

### Week 4: Harden + Ship
- Fix all file permission issues
- Fuzz testing on event parsing (malformed JSONL, oversized events)
- Test concurrent writes (two sessions writing simultaneously)
- Test hook timeout behavior (verify graceful degradation)
- End-to-end smoke test with real Claude Code session
- Write README with honest security properties section
- Tag v0.1.0 — distribute via git clone, not npm (npm publish at v0.2)

### Explicitly Cut from v0.1
| Feature | Reason |
|---------|--------|
| SQLite store | JSONL is sufficient at v0.1 event volumes. Eliminates native module dep. |
| `patchwork search` | Requires SQLite FTS. Defer to v0.2. |
| `patchwork tail` | Nice-to-have. Not core audit functionality. |
| `patchwork diff` | Analysis feature. Not needed for audit trail validation. |
| `patchwork stats` | Analysis feature. Defer. |
| Codex integration | Prove the model with one agent first. |
| `patchwork sync` | Only needed when Codex ships. |
| npm publish / Homebrew | Ship to 10 early testers via git clone first. |
| Policy enforcement | Audit-only is the honest v0.1 posture. |
| Cloud sync / web dashboard | Obviously deferred. |

---

## 4. Event Schema v1

```typescript
// packages/core/src/schema/event.ts — v1

import { z } from "zod";

export const SCHEMA_VERSION = 1;

export const AuditEventSchemaV1 = z.object({
  // Schema
  schema_version: z.literal(1),

  // Identity
  id: z.string().startsWith("evt_"),
  idempotency_key: z.string(),       // session:hook_event:tool:tool_use_id
  session_id: z.string(),
  timestamp: z.string().datetime(),

  // Tamper evidence
  prev_hash: z.string().nullable(),   // null for first event in chain
  event_hash: z.string(),             // SHA-256 of event JSON (excluding event_hash)

  // Agent
  agent: z.enum(["claude-code", "codex", "cursor", "copilot", "custom"]),
  agent_version: z.string().optional(),

  // Action
  action: z.string(),
  status: z.enum(["pending", "completed", "denied", "failed"]).default("completed"),
  duration_ms: z.number().optional(),

  // Target
  target: z.object({
    type: z.enum(["file", "command", "url", "mcp_tool", "prompt"]),
    path: z.string().optional(),       // ALWAYS relative to project root
    command: z.string().optional(),
    url: z.string().optional(),
    tool_name: z.string().optional(),
  }).optional(),

  // Context
  project: z.object({
    root_hash: z.string(),            // SHA-256 of absolute path (privacy)
    name: z.string(),
    git_ref: z.string().optional(),
  }).optional(),

  // Risk
  risk: z.object({
    level: z.enum(["none", "low", "medium", "high", "critical"]),
    flags: z.array(z.string()).default([]),
  }),

  // Content
  content: z.object({
    hash: z.string(),
    before_hash: z.string().optional(),
    size_bytes: z.number().optional(), // Omitted for prompts
    redacted: z.boolean().default(true),
  }).optional(),

  // Provenance (minimal by default)
  provenance: z.object({
    hook_event: z.string(),
    tool_name: z.string().optional(),
    // raw_input/raw_output removed from default schema
    // Available only via explicit config: capture_raw: true
  }).optional(),
});

export type AuditEventV1 = z.infer<typeof AuditEventSchemaV1>;
```

### Tamper-evidence approach

**Hash chaining** (lightweight Merkle chain):

```
Event 0:  prev_hash = null,         event_hash = H(event_0_json)
Event 1:  prev_hash = H(event_0),   event_hash = H(event_1_json)
Event 2:  prev_hash = H(event_1),   event_hash = H(event_2_json)
...
```

Where `H(event)` = `SHA-256(JSON.stringify(event_without_event_hash_field))`.

**Verification** (`patchwork verify`):
1. Read all events from JSONL
2. For each event N (N > 0): compute `SHA-256(event[N-1])`, compare to `event[N].prev_hash`
3. For each event: remove `event_hash`, compute `SHA-256(remaining)`, compare to stored `event_hash`
4. Report: chain valid/broken, first broken link, total events verified

**Properties:**
- Insertion detection: inserting an event breaks the chain at the insertion point
- Deletion detection: deleting an event breaks the chain at the deletion point
- Modification detection: modifying any field changes the event_hash and breaks the next event's prev_hash
- Append-only verification: the chain only grows; valid chains cannot shrink

**Limitations (documented honestly):**
- An attacker with write access can rewrite the entire chain (no external anchor)
- Future improvement: periodic Merkle root published to external service (git tag, remote API)
- This is tamper *evidence*, not tamper *proof*

### Idempotency key construction

```typescript
function buildIdempotencyKey(input: ClaudeCodeHookInput): string {
  const parts = [
    input.session_id,
    input.hook_event_name,
    input.tool_name || "_",
    input.tool_use_id || "_",
  ];
  return parts.join(":");
}
```

If `tool_use_id` is unavailable (older Claude Code versions), falls back to `session_id:hook_event:tool_name:timestamp_ms`. Deduplication checks the idempotency_key in JSONL before appending.

---

## 5. Privacy Defaults Matrix

| Field | Default | Stored? | Retention | Redaction Rule |
|-------|---------|---------|-----------|----------------|
| `id` | Generated | Yes | Until rotation | Never redacted — needed for dedup |
| `idempotency_key` | Generated | Yes | Until rotation | Never redacted — needed for dedup |
| `session_id` | From agent | Yes | Until rotation | Never redacted |
| `timestamp` | Current time | Yes | Until rotation | Never redacted |
| `schema_version` | 1 | Yes | Until rotation | Never redacted |
| `prev_hash` | Computed | Yes | Until rotation | Never redacted — needed for chain |
| `event_hash` | Computed | Yes | Until rotation | Never redacted — needed for chain |
| `agent` | From hook | Yes | Until rotation | Never redacted |
| `agent_version` | From hook | Yes | Until rotation | Never redacted |
| `action` | Mapped | Yes | Until rotation | Never redacted |
| `status` | From hook | Yes | Until rotation | Never redacted |
| `duration_ms` | Measured | Yes | Until rotation | Never redacted |
| `target.type` | Mapped | Yes | Until rotation | Never redacted |
| `target.path` | **Relative** | Yes | Until rotation | Stripped to relative path. Project root is never stored as-is. |
| `target.abs_path` | **OMITTED** | **No** | N/A | Never stored in default config. Opt-in via `capture_abs_path: true`. |
| `target.command` | From hook | Yes | Until rotation | **Secrets scrubbed**: env vars, `-H "Auth..."`, tokens matching `(sk\|pk\|ghp\|Bearer)_[A-Za-z0-9]+` replaced with `[REDACTED]`. |
| `target.url` | From hook | Yes | Until rotation | Query params stripped by default. Full URL opt-in. |
| `project.root` | **Hashed** | Hash only | Until rotation | Stored as `SHA-256(abs_path)`, not the path itself. |
| `project.name` | Directory name | Yes | Until rotation | Just the basename, not the full path. |
| `project.git_ref` | From git | Yes | Until rotation | Short SHA only. |
| `risk.level` | Classified | Yes | Until rotation | Never redacted |
| `risk.flags` | Classified | Yes | Until rotation | Never redacted |
| `content.hash` | Computed | Yes | Until rotation | Hash of content, not the content. |
| `content.before_hash` | Computed | Yes | Until rotation | Hash of previous content, not the content. |
| `content.size_bytes` | Measured | **Conditional** | Until rotation | **Omitted for prompts** (leaks prompt length). Stored for file ops only. |
| `content.summary` | **OMITTED** | **No** | N/A | Never stored in default config. Opt-in via `capture_summary: true`. |
| `content.redacted` | true | Yes | Until rotation | Always true in default config. |
| `provenance.hook_event` | From hook | Yes | Until rotation | Never redacted |
| `provenance.tool_name` | From hook | Yes | Until rotation | Never redacted |
| `provenance.raw_input` | **OMITTED** | **No** | N/A | **Never stored in default config.** Opt-in via `capture_raw: true`. Contains passwords, API keys, file contents. |
| `provenance.raw_output` | **OMITTED** | **No** | N/A | **Never stored in default config.** Same as raw_input. |

### Retention defaults

| Tier | Default retention | Configurable? |
|------|-------------------|---------------|
| Local (v0.1) | **90 days** | Yes, via `~/.patchwork/config.toml` |
| Local (manual) | `patchwork rotate` deletes events older than retention period | N/A |
| Cloud (v0.3+) | Per plan (30/90/365 days) | Yes |

### Opt-in escalation levels

```toml
# ~/.patchwork/config.toml

[privacy]
# Level 1 (default): hashes only, relative paths, no raw data
capture_abs_path = false
capture_raw = false
capture_summary = false
capture_prompt_size = false

# Level 2 (team/debug): adds summaries and abs paths
# capture_abs_path = true
# capture_summary = true

# Level 3 (full capture): everything, for incident investigation
# capture_raw = true
# capture_prompt_size = true
```

---

## 6. Pass/Fail Acceptance Criteria for v0.1

Every criterion is binary. All must pass to ship.

### Functional

| # | Criterion | Verification |
|---|-----------|-------------|
| F1 | `patchwork init claude-code` installs 8 hooks into `.claude/settings.json` | Run command, parse JSON, count hook entries = 8 |
| F2 | `patchwork hook <event>` accepts JSON on stdin and writes a valid event to `events.jsonl` | Pipe synthetic JSON, read last line of JSONL, validate with `AuditEventSchemaV1.parse()` |
| F3 | Every event has `schema_version: 1` | `grep -c '"schema_version":1' events.jsonl` = total line count |
| F4 | Every event has a non-empty `idempotency_key` | Parse all events, assert field present and non-empty |
| F5 | Every event (except the first) has a valid `prev_hash` matching the prior event's hash | `patchwork verify` exits 0 |
| F6 | `patchwork log` displays events with risk icons and timestamps | Run with synthetic data, verify output contains expected actions |
| F7 | `patchwork log --risk high` returns only high and critical events | Insert mixed-risk events, verify filter |
| F8 | `patchwork show <session-id>` displays session timeline | Insert session, verify output |
| F9 | `patchwork sessions` lists sessions with event counts | Verify count matches |
| F10 | `patchwork status` shows agent detection and event counts | Verify output structure |
| F11 | `patchwork export --format json` outputs valid JSON array | Pipe to `python -m json.tool`, verify exit 0 |
| F12 | `patchwork verify` reports "chain valid" on untampered JSONL | Create events, run verify, assert exit 0 |
| F13 | `patchwork verify` reports "chain broken" when an event is modified | Modify one event's action field, run verify, assert exit 1 |
| F14 | Duplicate hook invocations (same idempotency_key) produce only one event | Send same JSON twice, verify one event in JSONL |

### Security

| # | Criterion | Verification |
|---|-----------|-------------|
| S1 | `events.jsonl` is created with mode 0600 | `stat -f '%Lp' ~/.patchwork/events.jsonl` = 600 |
| S2 | `~/.patchwork/` directory is mode 0700 | `stat -f '%Lp' ~/.patchwork` = 700 |
| S3 | No `abs_path` field appears in any event (default config) | `grep -c 'abs_path' events.jsonl` = 0 |
| S4 | No `raw_input` or `raw_output` field appears in any event (default config) | `grep -c 'raw_input\|raw_output' events.jsonl` = 0 |
| S5 | Commands containing token patterns are scrubbed | Insert event with `curl -H "Authorization: Bearer sk-abc123"`, verify stored command contains `[REDACTED]` |
| S6 | Prompt events do not include `size_bytes` | Insert prompt event, verify `content.size_bytes` is absent |
| S7 | Zod validation rejects malformed events on write | Call `store.append()` with invalid event, verify rejection |
| S8 | Zod validation skips corrupt JSONL lines on read without crashing | Append garbage line to JSONL, run `patchwork log`, verify it works |
| S9 | Policy regex with catastrophic backtracking completes within 100ms | Write ReDoS pattern in policy, time the evaluation, assert < 100ms |

### Performance

| # | Criterion | Verification |
|---|-----------|-------------|
| P1 | Hook latency p99 < 200ms for PostToolUse | Time 100 hook invocations, assert 99th percentile < 200ms |
| P2 | Hook latency p99 < 500ms for PreToolUse (includes policy eval) | Time 100 hook invocations with strict policy, assert < 500ms |
| P3 | `patchwork log` completes in < 1s with 10,000 events | Generate 10K events, time `patchwork log -n 25` |
| P4 | `events.jsonl` with 10,000 events is < 20MB | Generate and measure |

### Tests

| # | Criterion | Verification |
|---|-----------|-------------|
| T1 | All unit tests pass | `pnpm test` exits 0 |
| T2 | Test count >= 200 | Check vitest output |
| T3 | Integration test covers: init → hook session → hook tools → log → show → verify | Single test file exercises full round-trip |
| T4 | No test uses `as TypeName` to bypass validation — all use `schema.parse()` | grep for `as AuditEvent` in test files, count = 0 in non-helper code |
