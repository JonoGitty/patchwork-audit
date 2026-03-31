# Patchwork

**The audit trail for AI coding agents.**

AI agents are black boxes. They read your files, execute commands, make web requests, and modify your codebase -- and you have no record of what they did or why. As organisations adopt AI coding assistants, this becomes a compliance and security problem:

- **The EU AI Act** requires logging of AI system outputs and decision-making processes
- **SOC 2 / ISO 27001** demand audit trails for systems that access production code and infrastructure
- **Enterprise security teams** can't approve AI tools they can't monitor
- **Developers** can't trust autonomous agents they can't audit after the fact

Patchwork solves this. It hooks into AI coding agents and records everything they do -- files read, files written, commands executed, web requests made -- into a tamper-evident, queryable audit trail with real-time risk classification and policy enforcement.

**Local-first.** Your data never leaves your machine. No cloud. No telemetry. Everything works offline.

**Tamper-resistant.** The AI agent cannot disable its own monitoring, corrupt the audit log, or weaken the security policy. System-level install makes it impossible for non-admin users to remove.

**Policy enforcement.** Define what the AI can and cannot do. Patchwork blocks dangerous actions in real-time -- before they execute.

---

## What it catches

```
15:31:04  claude-code   command_execute   rm -rf /                    CRITICAL  DENIED
15:31:05  claude-code   file_read         .env                        HIGH      DENIED
15:31:07  claude-code   command_execute   git push --force origin     HIGH      DENIED
15:31:08  claude-code   command_execute   sudo rm /etc/hosts          CRITICAL  DENIED
15:31:10  claude-code   file_edit         src/auth/middleware.ts       MEDIUM    completed
15:31:12  claude-code   command_execute   npm test                    MEDIUM    completed
```

Every action is classified, logged, and -- if it violates policy -- blocked before it executes.

---

## Quickstart

```bash
git clone https://github.com/JonoGitty/codex-audit.git
cd codex-audit
pnpm install && pnpm build

# Install CLI globally
cd packages/cli && npm link && cd ../..

# Set up hooks with strict enforcement
patchwork init claude-code --strict-profile --policy-mode fail-closed

# See what the AI is doing
patchwork dashboard      # web UI at localhost:3000
patchwork log            # CLI event stream
patchwork summary        # today's activity
```

### System-level install (tamper-proof)

For managed machines where non-admin users should not be able to disable auditing:

```bash
# Single user
sudo bash scripts/system-install.sh

# All users on this Mac
sudo bash scripts/system-install.sh --all-users

# Specific users
sudo bash scripts/system-install.sh --users alice,bob,charlie
```

This locks `settings.json` as root-owned with the system immutable flag, installs a LaunchDaemon watchdog, and makes it impossible for the AI agent or non-admin users to disable monitoring.

---

## How it works

```
Claude Code                    Patchwork                        Audit Store
    |                              |                                |
    |-- PreToolUse hook ---------> |                                |
    |                              |-- classify risk                |
    |                              |-- evaluate policy              |
    |                              |-- ALLOW or DENY ------------> stdout
    |                              |                                |
    |-- PostToolUse hook -------> |                                |
    |                              |-- record event                |
    |                              |-- compute hash chain -------> events.jsonl
    |                              |-- index -------- -----------> audit.db (SQLite)
    |                              |-- webhook alert (if high risk)|
```

Patchwork hooks into Claude Code's native hook system. Every tool call passes through the policy engine before execution. Denied actions are blocked and logged. Completed actions are recorded with tamper-evident hash chaining.

---

## Web Dashboard

`patchwork dashboard` launches a local web UI with six pages:

| Page | What you see |
|------|-------------|
| **Overview** | Stat cards, 14-day activity chart, risk donut, recent events + sessions |
| **Events** | Filterable event log with live htmx filtering (agent, action, risk) |
| **Sessions** | Session list with drill-down timeline -- every action the AI took |
| **Risk** | Risk-over-time chart, flags breakdown, denials table |
| **Search** | Full-text search across all events (powered by SQLite FTS5) |
| **Settings** | System status, installed agents, policy rules display |

Plus a JSON API at `/api/stats`, `/api/events`, `/api/sessions`, `/api/risk-timeline`.

---

## Policy Enforcement

Policies are YAML files that define allow/deny rules. When a policy denies an action, Patchwork blocks it in real-time.

```yaml
name: my-team-policy
max_risk: high  # Auto-deny anything above this level

files:
  deny:
    - pattern: "**/.env"
      reason: Environment files contain secrets
    - pattern: "**/.claude/settings.json"
      reason: Audit hooks must not be modified
    - pattern: "**/.patchwork/**"
      reason: Audit data must not be tampered with
  default_action: allow

commands:
  deny:
    - prefix: "rm -rf"
      reason: Recursive force delete
    - prefix: sudo
      reason: Elevated privileges
    - prefix: "git push --force"
      reason: Force push blocked
  default_action: allow
```

Built-in presets: `default` (audit-only) and `strict` (blocks dangerous operations).

### Self-protection

The AI agent cannot disable its own monitoring:

| Attack vector | Defence |
|---|---|
| Editing settings.json to remove hooks | Policy deny rule + file locked as root:wheel + schg flag |
| Truncating/deleting the audit log | Policy deny rule + command regex blocks redirects |
| Weakening the security policy | Policy deny rule blocks writes to policy.yml |
| Timeout-based bypass | Fail-closed mode denies on hook timeout |
| Shell metacharacter evasion | Regex command rules catch pipes/redirects |

### Fail-closed mode

When installed with `--policy-mode fail-closed`, any hook error (crash, timeout, bad input) results in the action being **denied** rather than allowed.

---

## Risk Classification

Every event is automatically classified:

| Level | Example triggers |
|---|---|
| **CRITICAL** | `.env` access, `rm -rf`, `sudo`, SSH key files |
| **HIGH** | `package.json` modification, `npm install`, force push, credential files |
| **MEDIUM** | File writes, command execution, web requests, MCP tool calls |
| **LOW** | File reads, glob/grep searches |
| **NONE** | Session start/end, prompt submit |

Sensitive file detection covers: `.env`, private keys, cloud credentials, API tokens, database files, Docker configs, Kubernetes configs, and more.

---

## Integrity & Compliance

### Tamper-evident hash chain

Every audit event is linked to the previous one via SHA-256 hash chaining. Inserting, deleting, or modifying any event breaks the chain and is detected by `patchwork verify`.

### HMAC sealing

`patchwork seal` signs the audit trail with a local HMAC key. Sealed logs can be verified for authenticity.

### CI attestation

`patchwork attest` generates a signed JSON artifact proving the audit trail is complete and verified. Use it in CI to gate deployments on audit completeness.

```bash
# In CI -- fail if audit trail is incomplete
patchwork attest --profile strict --out audit-attestation.json

# Verify in another pipeline
patchwork verify --require-signed-attestation --attestation-file audit-attestation.json
```

### Webhook alerts

Set `PATCHWORK_WEBHOOK_URL` to receive real-time alerts on high-risk or denied events. Supports Slack, Discord, and generic JSON webhooks.

---

## Multi-user & Enterprise

### System-level enforcement (macOS)

```bash
# Enrol all users -- non-admin users cannot remove or modify hooks
sudo bash scripts/system-install.sh --all-users

# Add/remove users after initial install
sudo bash scripts/system-add-user.sh --user newuser
sudo bash scripts/system-remove-user.sh --user olduser
```

- Settings.json locked with `chflags schg` (system immutable flag -- requires root to remove)
- System policy at `/Library/Patchwork/policy.yml` (root-owned, shared across all users)
- LaunchDaemon watchdog monitors all enrolled users every 15 minutes
- Runtime Node discovery supports mixed Intel/Apple Silicon machines

### User registry

`/Library/Patchwork/users.conf` lists all enrolled users. The watchdog iterates this file and independently monitors each user's Claude Code hooks.

---

## CLI Commands

```bash
# Events
patchwork log                         # Recent events
patchwork log --risk high             # High-risk only
patchwork log --session latest        # Last session
patchwork tail                        # Live stream

# Sessions
patchwork sessions                    # List sessions
patchwork summary                     # Today's activity

# Dashboard
patchwork dashboard                   # Web UI at localhost:3000

# Policy
patchwork policy show                 # Active policy
patchwork policy init --strict        # Create strict policy

# Integrity
patchwork verify                      # Hash chain verification
patchwork seal                        # HMAC signing
patchwork attest --profile strict     # CI attestation

# Export
patchwork export --format sarif       # SARIF for GitHub Code Scanning
patchwork export --format csv         # CSV for spreadsheets

# Setup
patchwork init claude-code            # Install hooks
patchwork status                      # System health
```

---

## Supported Agents

| Agent | Status | Integration |
|---|---|---|
| Claude Code | Working | Native hooks (PreToolUse, PostToolUse, Session lifecycle, Subagents) |
| Codex CLI | Working | History parsing + sync |
| Cursor | Planned | |
| GitHub Copilot | Planned | |

---

## Architecture

Four packages in a TypeScript monorepo:

- **`@patchwork/core`** -- Schema (Zod), risk classifier, policy engine, JSONL + SQLite stores, hash chain, HMAC sealing
- **`@patchwork/agents`** -- Agent adapters (Claude Code hooks, Codex parser, auto-detection)
- **`@patchwork/web`** -- Dashboard server (Hono + htmx + Chart.js)
- **`patchwork-audit`** -- CLI (Commander.js, 20 commands)

```
~/.patchwork/
  events.jsonl          # Append-only audit trail (hash-chained)
  db/audit.db           # SQLite indexed mirror (FTS5 full-text search)
  policy.yml            # Security policy
  keys/seal/            # HMAC seal keyring
  seals.jsonl           # Seal records
  witnesses.jsonl       # Remote witness anchors
  attestations/         # CI attestation artifacts

/Library/Patchwork/     # System-level (root-owned, multi-user)
  policy.yml            # System policy (overrides user/project)
  users.conf            # Enrolled user registry
  guard.sh              # Session start guard
  hook-wrapper.sh       # Shared hook shim (runtime Node discovery)
  system-watchdog.sh    # Multi-user watchdog
```

---

## Roadmap

- [ ] **Compliance report generation** -- `patchwork report --framework soc2` outputting PDF/HTML mapped to SOC 2 / ISO 27001 / EU AI Act controls
- [ ] **Session replay** -- `patchwork replay <session-id>` walking through file diffs chronologically
- [ ] **Diff-aware risk scoring** -- parse actual code changes, not just file paths
- [ ] **Team mode** -- local-first with aggregated sealed bundles pushed to a team server
- [ ] **npm publish** -- `npm install -g patchwork-audit`
- [ ] **GitHub Action** -- `patchwork/audit@v1` for CI integration
- [ ] **KMS-backed sealing** -- macOS Keychain / cloud KMS for seal keys

---

## Platform Support

| Platform | Status |
|---|---|
| macOS | Fully supported (LaunchDaemon watchdog, system-level install, multi-user) |
| Linux | Fully supported (CI-tested on Ubuntu with Node 20 and 22) |
| Windows | Partial (core works, file permission hardening not enforced by OS) |

---

## Development

```bash
pnpm install
pnpm build
pnpm test          # 684 tests across 32 files
pnpm lint
```

Test log is maintained at `docs/TEST_LOG.md` and updated automatically by the pre-push hook.

---

## License

BUSL-1.1
