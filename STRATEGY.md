# Patchwork — AI Agent Audit Trail

> Every stitch the AI makes, tracked.

---

## 1. Product Overview

### Name: **Patchwork**

**Why Patchwork:** Every AI coding agent makes changes — patches — to your codebase. Patchwork stitches together a complete, auditable record of every patch, every action, every decision. It works as a CLI command (`patchwork`), reads well as a product name, and the metaphor scales: individual patches form a patchwork quilt — the full picture of what AI did to your code.

**One-liner:** The audit trail for AI coding agents.

**What it does:** Patchwork hooks into AI coding agents (Claude Code, Codex CLI, Cursor, etc.) and records everything they do — files read, files written, commands executed, web requests made — into a unified, queryable audit trail. Locally first. Cloud-synced for teams.

**Who it's for:**
- **Individual developers** who want to know what AI actually did across sessions
- **Engineering teams** who need visibility into AI-driven code changes
- **Enterprise security/compliance** who need audit trails for AI agent activity (EU AI Act, SOX, SOC 2)

### Alternatives Considered

| Name | Verdict |
|---|---|
| **Patchwork** | Winner. Works as CLI command, as product name, metaphor scales. |
| **Stitchlog** | Too cute, doesn't convey seriousness for enterprise. |
| **AgentTrail** | Generic, forgettable. |
| **FlightRecorder** | Good metaphor (airplane black box) but Java Flight Recorder exists. |
| **CodeLedger** | Blockchain connotations. Misleading. |

---

## 2. Architecture

```
                    LOCAL MACHINE
 ┌──────────────────────────────────────────────────┐
 │                                                  │
 │  ┌──────────┐  hooks   ┌─────────────────────┐  │
 │  │Claude    │────────→ │                     │  │
 │  │Code      │          │   patchwork daemon   │  │
 │  └──────────┘          │                     │  │
 │                        │  - receives events   │  │
 │  ┌──────────┐  parse   │  - normalizes schema │  │
 │  │Codex     │────────→ │  - classifies risk   │  │
 │  │CLI       │          │  - detects secrets   │  │
 │  └──────────┘          │  - writes JSONL      │  │
 │                        │  - hashes content    │  │
 │  ┌──────────┐  hooks   │                     │  │
 │  │Cursor    │────────→ │                     │  │
 │  │(future)  │          └────────┬────────────┘  │
 │  └──────────┘                   │               │
 │                                 │               │
 │                        ┌────────▼────────────┐  │
 │                        │  ~/.patchwork/       │  │
 │                        │  ├── events.jsonl    │  │
 │                        │  ├── sessions.jsonl  │  │
 │                        │  ├── config.toml     │  │
 │                        │  └── db/             │  │
 │                        │      └── audit.db    │  │
 │                        └────────┬────────────┘  │
 │                                 │               │
 │                        ┌────────▼────────────┐  │
 │                        │  patchwork CLI       │  │
 │                        │  - log / tail / show │  │
 │                        │  - query / filter    │  │
 │                        │  - summary / stats   │  │
 │                        │  - export            │  │
 │                        └─────────────────────┘  │
 │                                                  │
 └──────────────────────────────────────────────────┘
                          │
                          │ sync (future v2)
                          ▼
                ┌─────────────────────┐
                │  Patchwork Cloud    │
                │  - team dashboard   │
                │  - compliance       │
                │  - alerting         │
                │  - retention        │
                └─────────────────────┘
```

### Core Design Principles

1. **Local-first.** Everything works offline. JSONL files are the source of truth. Cloud sync is additive, never required.
2. **Zero-config start.** `patchwork init` sets up hooks for detected agents. That's it.
3. **Agent-agnostic schema.** One unified event format, regardless of which agent produced it.
4. **Privacy-safe defaults.** Content hashing by default. Full content capture opt-in. Sensitive file detection built-in.
5. **Append-only.** Audit trail is immutable. Events are never modified or deleted (only rotated by retention policy).

---

## 3. Unified Event Schema

Every action from every agent is normalized into one schema:

```jsonc
{
  // Identity
  "id": "evt_01J8K...",              // Unique event ID (ULID)
  "session_id": "ses_01J8K...",      // Agent session ID
  "timestamp": "2026-02-12T14:30:00.123Z",

  // Agent
  "agent": "claude-code",            // claude-code | codex | cursor | copilot | custom
  "agent_version": "2.1.39",

  // Action
  "action": "file_write",            // See action taxonomy below
  "status": "completed",             // pending | completed | denied | failed
  "duration_ms": 45,

  // Target
  "target": {
    "type": "file",                   // file | command | url | mcp_tool | prompt
    "path": "src/auth/login.ts",      // Normalized relative path
    "abs_path": "/Users/.../login.ts" // Full path (redactable)
  },

  // Context
  "project": {
    "root": "/Users/.../my-project",
    "name": "my-project",             // Derived from directory name or git remote
    "git_ref": "abc1234"              // HEAD at time of event
  },

  // Risk
  "risk": {
    "level": "low",                   // none | low | medium | high | critical
    "flags": ["sensitive_path"],      // Why this risk level
    "policy_match": "allowlist:npm_test" // Which policy rule matched (if any)
  },

  // Content (opt-in, redacted by default)
  "content": {
    "hash": "sha256:abc123...",       // Always present
    "summary": "Added JWT validation middleware",  // LLM-generated or extracted (opt-in)
    "before_hash": "sha256:def456...",  // For file edits
    "size_bytes": 1842,
    "redacted": true                   // Whether full content was captured
  },

  // Provenance
  "provenance": {
    "hook_event": "PostToolUse",       // Raw hook event name from agent
    "tool_name": "Write",             // Agent's tool name
    "raw_input": { ... },             // Agent's tool input (redactable)
    "raw_output": { ... }             // Agent's tool output (redactable)
  }
}
```

### Action Taxonomy

| Category | Actions |
|---|---|
| **File** | `file_read`, `file_write`, `file_create`, `file_delete`, `file_edit`, `file_glob`, `file_grep` |
| **Command** | `command_execute`, `command_approve`, `command_deny` |
| **Network** | `web_fetch`, `web_search`, `api_call` |
| **Session** | `session_start`, `session_end`, `prompt_submit`, `response_complete` |
| **Agent** | `subagent_start`, `subagent_stop`, `task_delegate` |
| **MCP** | `mcp_tool_call`, `mcp_tool_result` |

### Risk Classification Rules

```
critical:
  - Write/delete to sensitive paths (.env, *secret*, *key*, id_rsa, credentials*)
  - Commands matching deny_prefix (rm -rf, sudo, curl, wget, ssh)
  - Network access to credential endpoints

high:
  - Write to config files (package.json, tsconfig, Dockerfile, CI configs)
  - Commands that install packages (npm install, pip install)
  - Git operations that modify history (rebase, reset, force-push)

medium:
  - Write to source files
  - Commands that run tests or builds
  - Git operations (commit, push, checkout)

low:
  - File reads
  - Glob/grep searches
  - Git status/log/diff

none:
  - Session lifecycle events
  - Prompt submissions (content redacted)
```

---

## 4. Agent Integrations

### 4.1 Claude Code (Primary — full integration)

Claude Code has the best hook system of any coding agent. 14 lifecycle events with full JSON payloads.

**Installation:**
```bash
patchwork init claude-code
```

This writes to `~/.claude/settings.json` (or project `.claude/settings.json`):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "type": "command",
        "command": "patchwork hook pre-tool",
        "timeout": 1000
      }
    ],
    "PostToolUse": [
      {
        "type": "command",
        "command": "patchwork hook post-tool",
        "timeout": 1000
      }
    ],
    "SessionStart": [
      {
        "type": "command",
        "command": "patchwork hook session-start",
        "timeout": 500
      }
    ],
    "SessionEnd": [
      {
        "type": "command",
        "command": "patchwork hook session-end",
        "timeout": 500
      }
    ],
    "UserPromptSubmit": [
      {
        "type": "command",
        "command": "patchwork hook prompt-submit",
        "timeout": 500
      }
    ],
    "SubagentStart": [
      {
        "type": "command",
        "command": "patchwork hook subagent-start",
        "timeout": 500
      }
    ],
    "SubagentStop": [
      {
        "type": "command",
        "command": "patchwork hook subagent-stop",
        "timeout": 500
      }
    ]
  }
}
```

**How it works:**
1. Claude Code calls the hook command with JSON on stdin for every tool use
2. `patchwork hook` receives JSON, extracts `tool_name`, `tool_input`, `tool_response`, `session_id`
3. Maps Claude Code tool names to Patchwork actions:
   - `Write` / `Edit` → `file_write` / `file_edit`
   - `Read` → `file_read`
   - `Bash` → `command_execute`
   - `Glob` → `file_glob`
   - `Grep` → `file_grep`
   - `WebFetch` → `web_fetch`
   - `WebSearch` → `web_search`
   - `Task` → `subagent_start`
4. Classifies risk based on target and action
5. Appends normalized event to `~/.patchwork/events.jsonl`
6. Returns `{"allow": true}` (never blocks by default — audit-only mode)

**PreToolUse vs PostToolUse:**
- PreToolUse: Log intent + risk classify. Can optionally deny (policy enforcement mode).
- PostToolUse: Log result + content hash + duration. This is the primary audit record.

### 4.2 Codex CLI (Secondary — history parsing + notify)

Codex CLI doesn't have per-tool-call hooks yet. We use two approaches:

**A. Post-session parsing (reliable, slightly delayed):**
```bash
patchwork sync codex
```
- Reads `~/.codex/history.jsonl`
- Parses each session entry for tool calls, file changes, commands
- Normalizes to Patchwork events
- Deduplicates against already-ingested entries (by timestamp + content hash)

**B. Notify hook (real-time, less detail):**

In `~/.codex/config.yaml` (or equivalent):
```yaml
notify:
  - event: agent-turn-complete
    command: patchwork hook codex-turn
```

This gives us session-level events in real-time. Combined with history parsing, we get full coverage.

**Installation:**
```bash
patchwork init codex
```

### 4.3 Cursor (Future — v1.1)

Cursor has beta hooks since v1.7. When stable:
- `afterFileEdit` → `file_edit`
- `beforeShellExecution` → `command_execute`
- `beforeReadFile` → `file_read`
- `beforeMCPExecution` → `mcp_tool_call`

### 4.4 Generic / Custom Agents (Future — v1.2)

For agents without hooks, provide:
- Filesystem watcher mode (inotify/FSEvents) — detects file changes in project root
- Git diff mode — compares pre/post session state
- Manual event submission API (`patchwork log "action" --target "file"`)

---

## 5. CLI Design

The `patchwork` CLI is the primary interface. It should feel like `git log` for AI actions.

### Commands

```bash
# Setup
patchwork init [claude-code|codex|cursor|all]   # Install hooks for agent(s)
patchwork status                                  # Show configured agents + stats

# Viewing events
patchwork log                         # Recent events (like git log)
patchwork log --agent claude-code     # Filter by agent
patchwork log --action file_write     # Filter by action type
patchwork log --risk high             # Filter by risk level
patchwork log --session latest        # Events from most recent session
patchwork log --project my-project    # Filter by project
patchwork log --since "2 hours ago"   # Time-based filter
patchwork log --target "src/auth/*"   # Filter by file path glob

patchwork tail                        # Live tail (like tail -f)
patchwork tail --risk medium+         # Live tail, medium+ risk only

patchwork show <event-id>             # Full event detail
patchwork show <session-id>           # Full session timeline

# Summaries
patchwork summary                     # Summary of today's AI activity
patchwork summary --session latest    # Summary of last session
patchwork summary --week              # Weekly summary
patchwork stats                       # Aggregate stats (events by type, risk, agent)

# Sessions
patchwork sessions                    # List recent sessions
patchwork sessions --agent codex      # Sessions for specific agent
patchwork diff <session-id>           # Git-style diff of all changes in session

# Search
patchwork search "auth"               # Search across events
patchwork search --sensitive           # Show all sensitive file accesses

# Sync (for Codex)
patchwork sync codex                  # Parse latest Codex history

# Export
patchwork export --format json        # Export full audit trail
patchwork export --format csv         # CSV export
patchwork export --compliance eu-ai-act  # Compliance-formatted report (paid)

# Policy (paid feature)
patchwork policy init                 # Create policy.yml
patchwork policy check                # Validate policy against recent activity
patchwork policy enforce              # Switch from audit-only to enforcement mode

# Hooks (internal, called by agent hooks)
patchwork hook pre-tool               # Receives JSON on stdin from Claude Code
patchwork hook post-tool              # Receives JSON on stdin from Claude Code
patchwork hook session-start          # Session lifecycle
patchwork hook session-end            # Session lifecycle
patchwork hook prompt-submit          # Prompt lifecycle
patchwork hook subagent-start         # Subagent lifecycle
patchwork hook subagent-stop          # Subagent lifecycle
patchwork hook codex-turn             # Codex notify handler
```

### Output Formatting

```
$ patchwork log --session latest

 SESSION ses_01J8K... | claude-code 2.1.39 | my-project
 Started 2026-02-12 14:22:03 | Duration 18m 42s | 47 events

 14:22:03  session_start                                        ●
 14:22:08  file_read       src/auth/login.ts                    ○
 14:22:09  file_read       src/auth/middleware.ts                ○
 14:22:12  file_grep       pattern:"JWT" in src/                ○
 14:22:15  file_read       package.json                         ◐
 14:22:20  command_execute npm test                              ◐
 14:22:34  file_edit       src/auth/login.ts (+14/-3)           ◑
 14:22:36  file_create     src/auth/validate.ts (new, 42 lines) ◑
 14:22:38  file_edit       src/auth/middleware.ts (+8/-2)        ◑
 14:22:40  command_execute npm test                              ◐
 14:22:55  file_read       .env.example                         ○
 14:23:01  file_edit       .env                                 ◉ HIGH
 14:23:03  command_execute git add -A                            ◐
 14:23:04  command_execute git commit -m "Add JWT validation"    ◐
 ...
 14:40:45  session_end                                          ●

 ○ none  ◐ low/medium  ◑ medium  ◉ high/critical

 Summary: 12 files read, 4 files written, 1 file created, 8 commands run
 Risk: 1 high-risk event (.env modification at 14:23:01)
```

### Interactive mode (future)

```bash
patchwork ui     # Opens terminal UI (like lazygit) for browsing audit trail
```

---

## 6. Technology Choices

| Choice | Decision | Reasoning |
|---|---|---|
| **Language** | TypeScript (Node.js) | Claude Code hooks call shell commands — Node CLI starts fast (~100ms). TypeScript gives type safety. npm/npx distribution is the most frictionless for developers. Codex hooks also call shell commands. Python would work but npm distribution reaches more devs faster. |
| **Storage (local)** | JSONL + SQLite | JSONL for append-only raw events (immutable, greppable, portable). SQLite for indexed queries and session aggregation. Both written by the daemon. |
| **CLI framework** | Commander.js + Ink (for rich output) | Commander for command parsing. Ink (React for CLI) for the interactive `patchwork ui` mode later. |
| **Package manager** | pnpm | Fast, disk-efficient, good monorepo support. |
| **Testing** | Vitest | Fast, TypeScript-native, good DX. |
| **Build** | tsup | Fast bundling for CLI distribution. |
| **CI** | GitHub Actions | Standard. |
| **Linting** | Biome | Fast, replaces ESLint + Prettier in one tool. |
| **Monorepo** | Turborepo | When we add web dashboard, cloud API. Single repo for now. |
| **Distribution** | npm + Homebrew | `npm install -g patchwork-audit` or `brew install patchwork`. |

---

## 7. Repository Structure

```
patchwork/
├── README.md                          # Product overview + quickstart
├── STRATEGY.md                        # This document
├── LICENSE                            # BSL 1.1 (see licensing section)
├── package.json                       # Root package
├── pnpm-workspace.yaml                # Monorepo config
├── turbo.json                         # Turborepo config
├── biome.json                         # Linting/formatting
├── tsconfig.json                      # Root TS config
│
├── packages/
│   ├── cli/                           # The patchwork CLI
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts               # Entry point (bin)
│   │   │   ├── commands/
│   │   │   │   ├── init.ts            # patchwork init
│   │   │   │   ├── log.ts             # patchwork log
│   │   │   │   ├── tail.ts            # patchwork tail
│   │   │   │   ├── show.ts            # patchwork show
│   │   │   │   ├── summary.ts         # patchwork summary
│   │   │   │   ├── stats.ts           # patchwork stats
│   │   │   │   ├── sessions.ts        # patchwork sessions
│   │   │   │   ├── diff.ts            # patchwork diff
│   │   │   │   ├── search.ts          # patchwork search
│   │   │   │   ├── sync.ts            # patchwork sync
│   │   │   │   ├── export.ts          # patchwork export
│   │   │   │   ├── status.ts          # patchwork status
│   │   │   │   ├── policy.ts          # patchwork policy (paid)
│   │   │   │   └── hook.ts            # patchwork hook (internal)
│   │   │   ├── output/
│   │   │   │   ├── formatter.ts       # Event formatting (table, compact, json)
│   │   │   │   ├── colors.ts          # Risk-level color coding
│   │   │   │   └── timeline.ts        # Session timeline renderer
│   │   │   └── util/
│   │   │       └── time.ts            # Relative time formatting
│   │   └── tests/
│   │       ├── commands/
│   │       └── output/
│   │
│   ├── core/                          # Core library (shared logic)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts               # Public API
│   │   │   ├── schema/
│   │   │   │   ├── event.ts           # Event type definitions + validation
│   │   │   │   ├── session.ts         # Session type definitions
│   │   │   │   ├── action.ts          # Action taxonomy
│   │   │   │   └── risk.ts            # Risk classification types
│   │   │   ├── store/
│   │   │   │   ├── jsonl.ts           # JSONL append/read/rotate
│   │   │   │   ├── sqlite.ts          # SQLite indexed store
│   │   │   │   └── store.ts           # Store interface
│   │   │   ├── risk/
│   │   │   │   ├── classifier.ts      # Risk classification engine
│   │   │   │   ├── sensitive.ts       # Sensitive file/content detection
│   │   │   │   └── rules.ts           # Default risk rules
│   │   │   ├── policy/
│   │   │   │   ├── parser.ts          # Policy YAML parser
│   │   │   │   ├── evaluator.ts       # Policy evaluation engine
│   │   │   │   └── defaults.ts        # Default policy rules
│   │   │   ├── hash/
│   │   │   │   └── content.ts         # SHA-256 content hashing
│   │   │   └── id/
│   │   │       └── ulid.ts            # ULID generation
│   │   └── tests/
│   │       ├── schema/
│   │       ├── store/
│   │       ├── risk/
│   │       └── policy/
│   │
│   ├── agents/                        # Agent integration adapters
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── claude-code/
│   │   │   │   ├── adapter.ts         # Claude Code hook handler
│   │   │   │   ├── mapper.ts          # Tool name → action mapping
│   │   │   │   ├── installer.ts       # Hook installation into settings.json
│   │   │   │   └── types.ts           # Claude Code hook input types
│   │   │   ├── codex/
│   │   │   │   ├── adapter.ts         # Codex integration
│   │   │   │   ├── history-parser.ts  # history.jsonl parser
│   │   │   │   ├── mapper.ts          # Event mapping
│   │   │   │   └── installer.ts       # Notify hook installation
│   │   │   └── common/
│   │   │       ├── detector.ts        # Auto-detect installed agents
│   │   │       └── normalizer.ts      # Cross-agent normalization
│   │   └── tests/
│   │       ├── claude-code/
│   │       └── codex/
│   │
│   └── web/                           # Web dashboard (v2, placeholder)
│       └── README.md
│
├── docs/
│   ├── getting-started.md
│   ├── schema.md                      # Event schema reference
│   ├── agents/
│   │   ├── claude-code.md
│   │   └── codex.md
│   ├── cli-reference.md
│   └── compliance/
│       └── eu-ai-act.md
│
└── .github/
    └── workflows/
        ├── ci.yml                     # Tests + lint on PR
        └── release.yml                # npm publish on tag
```

---

## 8. What to Extract from Tool Factory vs. Build New

### Extract (patterns and schemas, not code — Tool Factory is Python, Patchwork is TypeScript)

| Pattern | Source in Tool Factory | Use in Patchwork |
|---|---|---|
| **Audit event schema** | `_audit_event()` in server.py:180 | Basis for unified event schema (expanded significantly) |
| **Risk classification** | `starky-approval-policy.yml` | Sensitive globs, exec allowlists/denylists, risk levels |
| **Actor normalization** | `_sanitize_actor()` in server.py:246 | Agent/provider metadata normalization |
| **JSONL append pattern** | `_append_jsonl()` in server.py | Thread-safe JSONL storage |
| **Approval lifecycle** | `ApprovalRequest`/`PromptChoiceRequest` dataclasses | Session/action lifecycle states |
| **Connector policy model** | `connector_policy` system | Resource access classification (read/write/send/admin) |
| **Policy YAML format** | `starky-approval-policy.yml` | Default policy template structure |
| **Dual-stream architecture** | Audit events + run events separation | Events + sessions separation |

### Build New (everything else)

| Component | Why New |
|---|---|
| **Claude Code hook integration** | Entirely new — specific to Claude Code's hook protocol |
| **Codex CLI history parser** | Entirely new — specific to Codex's JSONL format |
| **Unified event schema** | New design, informed by Tool Factory but much richer |
| **CLI interface** | New — developer-friendly `git log`-style UX |
| **SQLite indexed store** | New — Tool Factory only has JSONL, we need indexed queries |
| **Content hashing** | New — Tool Factory doesn't hash file contents |
| **Sensitive file detection** | Partially extracted (glob patterns), detection engine is new |
| **Session management** | New — grouping events into sessions with summaries |
| **Auto-detection** | New — detecting which agents are installed |
| **Timeline rendering** | New — formatted CLI output |

---

## 9. MVP Feature Roadmap (v0.1 → v1.0)

### v0.1 — "It records things" (Week 1-2)

**Goal:** Claude Code hook integration works. Events are stored. You can view them.

- [ ] Core event schema + JSONL storage
- [ ] Claude Code hook handler (`patchwork hook post-tool`)
- [ ] `patchwork init claude-code` (installs hooks)
- [ ] `patchwork log` (list recent events)
- [ ] `patchwork show <event-id>` (event detail)
- [ ] Basic risk classification (sensitive file detection)
- [ ] `patchwork status` (health check)

### v0.2 — "It's actually useful" (Week 3-4)

**Goal:** You can query, filter, and understand what happened.

- [ ] SQLite indexed store (parallel to JSONL)
- [ ] `patchwork log` filters (--agent, --action, --risk, --since, --target)
- [ ] `patchwork sessions` (list sessions with summary stats)
- [ ] `patchwork summary` (daily summary)
- [ ] `patchwork tail` (live event stream)
- [ ] Codex CLI history parser (`patchwork sync codex`)
- [ ] Session timeline view (`patchwork show <session-id>`)
- [ ] Content hashing (SHA-256 for all file operations)

### v0.3 — "Teams want this" (Week 5-6)

**Goal:** Export, search, and the beginnings of policy.

- [ ] `patchwork search` (full-text across events)
- [ ] `patchwork export` (JSON, CSV)
- [ ] `patchwork diff <session-id>` (git-style session diff)
- [ ] `patchwork stats` (aggregate statistics)
- [ ] Default policy template (`patchwork policy init`)
- [ ] Policy evaluation against events (`patchwork policy check`)
- [ ] Codex CLI notify hook integration (real-time)
- [ ] Homebrew formula

### v0.4 — "Enterprise pilot" (Week 7-8)

**Goal:** Cloud sync foundation + compliance export.

- [ ] Cloud sync API (events → Patchwork Cloud)
- [ ] Team dashboard (web, basic)
- [ ] `patchwork export --compliance eu-ai-act`
- [ ] Policy enforcement mode (deny via PreToolUse hooks)
- [ ] Retention policy configuration
- [ ] Event redaction controls

### v1.0 — "Production" (Week 9-12)

**Goal:** Stable, documented, paid product.

- [ ] Cursor integration
- [ ] Web dashboard (full)
- [ ] SSO/SAML for enterprise
- [ ] Alerting (Slack/webhook on high-risk events)
- [ ] Team management
- [ ] Compliance report templates
- [ ] Public documentation site

---

## 10. Pricing Model

### Free Tier (always free, local-only)
- Full CLI functionality
- Unlimited local events
- All agent integrations
- Basic risk classification
- JSONL export
- 1 user

**This is the adoption wedge. Make local audit so good that people can't live without it.**

### Pro ($15/user/month)
- Everything in Free
- Cloud sync (events → dashboard)
- Web dashboard
- Advanced search + filtering
- Session replay
- Policy enforcement mode
- CSV + JSON export
- Retention policies
- 30-day cloud retention

### Team ($25/user/month, min 5 users)
- Everything in Pro
- Team dashboard (aggregate view across developers)
- Shared policies
- Compliance reports (EU AI Act, SOX, SOC 2)
- Alerting (Slack, webhook, email)
- 90-day cloud retention
- RBAC

### Enterprise (custom pricing)
- Everything in Team
- SSO/SAML
- Custom compliance templates
- Dedicated support
- Custom retention (1yr+)
- On-prem deployment option
- SLA
- Audit of the audit (tamper-evident logging)

### Why This Pricing Works
- **Free tier drives adoption.** Developer tools need bottom-up adoption. The free CLI has to be genuinely useful.
- **Pro is the "I want a dashboard" upgrade.** Individual developers who want to see their activity in a web UI.
- **Team is the real revenue driver.** Engineering managers who want visibility into AI agent activity across their team.
- **Enterprise is compliance-driven.** Security/compliance teams who need audit trails for regulatory reasons. These deals are $50-100K+/year.

---

## 11. Go-to-Market Strategy

### Phase 1: Developer Adoption (Month 1-2)

**Actions:**
1. Ship v0.2 with Claude Code + Codex integration
2. Open source the CLI under BSL 1.1 (source-available, free for non-competing use)
3. Write a launch blog post: "I had no idea what AI was doing to my codebase"
4. Post on Hacker News (Show HN), Reddit (r/programming, r/ClaudeAI, r/ChatGPTCoding)
5. Create 2-minute demo video showing `patchwork log` after a Claude Code session
6. Submit to Claude Code community resources / awesome lists

**Key message:** "You trust AI to edit your code. Do you know what it actually changed?"

### Phase 2: Community Growth (Month 2-4)

**Actions:**
1. Ship Cursor integration (wider audience)
2. Engage with early adopters — feature requests, bug fixes, fast iteration
3. Write technical content:
   - "How Claude Code hooks work (and how to audit them)"
   - "The 5 riskiest things AI coding agents do"
   - "Building a compliance-ready AI audit trail"
4. Conference talks / meetup presentations
5. Partner with Claude Code and Codex community projects

### Phase 3: Enterprise Pipeline (Month 4-6)

**Actions:**
1. Ship Team tier with cloud dashboard
2. Create compliance documentation (EU AI Act mapping)
3. Reach out to enterprise security/compliance teams
4. Build case studies from early adopters
5. SOC 2 certification for Patchwork Cloud
6. Sales outreach to companies using AI coding tools at scale

### Positioning vs. Gryph

Gryph is the closest competitor (local-only audit trail, open source). Differentiation:

| | Patchwork | Gryph |
|---|---|---|
| **Local CLI** | Yes (richer CLI, better formatting) | Yes |
| **Cloud sync** | Yes (paid) | No |
| **Team dashboard** | Yes (paid) | No |
| **Compliance exports** | Yes (paid) | No |
| **Policy enforcement** | Yes (deny actions) | No (audit-only) |
| **Codex integration** | Yes (history parser + notify) | No (mentioned, unclear status) |
| **Alerting** | Yes (paid) | No |
| **License** | BSL 1.1 | MIT |

**Position:** "Gryph for local audit. Patchwork for the full picture — local, cloud, team, compliance."

---

## 12. Licensing

**Business Source License 1.1 (BSL 1.1)**

- Source code is publicly available (builds trust, allows inspection)
- Free for individual and non-competing commercial use
- Competing products cannot use our code
- Converts to open source (Apache 2.0) after 3 years
- Used by: MariaDB, CockroachDB, HashiCorp, Sentry

**Why BSL over MIT:**
- MIT means Gryph or anyone else can take our cloud/compliance code
- BSL protects the paid features while keeping the developer experience open
- Developers can read, audit, and contribute to the code
- Converts to Apache 2.0 after 3 years (good faith signal)

**Why not AGPL:**
- AGPL scares enterprises away
- BSL is more understood and accepted in the developer tools market

---

## 13. Competitive Moat (Long-term)

1. **Schema standard.** If Patchwork's event schema becomes the de facto standard for AI agent audit, we win regardless of competing tools. Consider submitting to OpenTelemetry as a semantic convention.

2. **Integration depth.** First-class integrations with every major AI coding agent. As new agents ship, we're there day one.

3. **Compliance templates.** Pre-built mappings to EU AI Act, SOX, SOC 2, ISO 42001. Hard for OSS competitors to maintain.

4. **Network effects.** Team dashboard gets more valuable with more users. Shared policies get better with more teams.

5. **Data advantage.** Aggregate (anonymized) patterns across teams: "what do AI agents typically do?" — useful for benchmarking, risk scoring, insurance.

---

## 14. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AI tool makers add native audit | High (12-18mo) | High | Ship fast, build community. Native audit will be per-tool; our value is cross-tool unified view + compliance. |
| Gryph adds cloud features | Medium | Medium | Move faster on enterprise features. BSL protects our code. |
| Claude Code hook API changes | Medium | Low | Adapter pattern isolates changes. Fast response to updates. |
| Low developer adoption | Medium | High | Free tier must be genuinely useful. Marketing matters. |
| Enterprise sales cycle too long | High | Medium | Focus on bottom-up adoption. Let developers bring it in. |
| EU AI Act delayed | Medium | Low | Compliance is one pillar. Developer UX drives adoption regardless. |

---

## 15. Key Metrics to Track

### Adoption
- npm installs (weekly)
- Active installations (unique session events / week)
- Agents integrated (% Claude Code vs Codex vs Cursor)
- GitHub stars

### Engagement
- Events logged per user per week
- CLI commands used per user per week
- Session count per user per week
- Retention (% still active after 30 days)

### Revenue
- Free → Pro conversion rate
- Pro → Team conversion rate
- Monthly recurring revenue (MRR)
- Average revenue per user (ARPU)
- Enterprise pipeline value

### Product
- Hook latency (p50, p95, p99) — must be <200ms
- Event ingestion latency
- False positive rate on risk classification
- Policy match accuracy

---

## 16. First 4-Week Sprint Plan

### Week 1: Foundation
- [ ] Repo setup (monorepo, tsconfig, biome, vitest, CI)
- [ ] Core event schema (TypeScript types + Zod validation)
- [ ] JSONL store (append, read, rotate)
- [ ] ULID generation
- [ ] Content hashing (SHA-256)
- [ ] Risk classifier (sensitive file detection, action-based rules)
- [ ] `patchwork hook post-tool` — receives Claude Code JSON, normalizes, stores
- [ ] Unit tests for schema, store, risk classifier

### Week 2: Claude Code Integration + Basic CLI
- [ ] Claude Code adapter (tool name mapping, session tracking)
- [ ] `patchwork init claude-code` (writes to settings.json)
- [ ] `patchwork log` (basic event listing with formatted output)
- [ ] `patchwork show <event-id>` (event detail view)
- [ ] `patchwork status` (configured agents, event count, last event)
- [ ] `patchwork hook session-start/session-end`
- [ ] `patchwork hook prompt-submit`
- [ ] Integration test: run Claude Code session, verify events captured
- [ ] README with quickstart

### Week 3: Queries + Codex + Sessions
- [ ] SQLite indexed store
- [ ] `patchwork log` filters (--agent, --action, --risk, --since, --target, --session, --project)
- [ ] `patchwork sessions` (session list with stats)
- [ ] `patchwork summary` (daily summary)
- [ ] `patchwork tail` (live event stream)
- [ ] Codex history parser
- [ ] `patchwork sync codex`
- [ ] `patchwork init codex`
- [ ] Session timeline view

### Week 4: Polish + Ship
- [ ] `patchwork search` (full-text)
- [ ] `patchwork export` (JSON, CSV)
- [ ] `patchwork diff <session-id>`
- [ ] `patchwork stats`
- [ ] npm publish (`patchwork-audit`)
- [ ] Homebrew formula
- [ ] Getting started docs
- [ ] Demo video
- [ ] Launch blog post draft
- [ ] Show HN draft
