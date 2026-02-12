# Patchwork

> The audit trail for AI coding agents.

Every stitch the AI makes, tracked.

---

Patchwork hooks into AI coding agents (Claude Code, Codex CLI) and records everything they do — files read, files written, commands executed, web requests made — into a unified, queryable audit trail with risk classification and policy enforcement.

**Local-first.** Everything works offline. Your data never leaves your machine.

## Quickstart

```bash
npm install -g patchwork-audit

# Set up hooks for your AI coding agents
patchwork init claude-code
patchwork init codex

# Use your AI coding agent normally...
# Then see what it did:
patchwork log
patchwork log --risk high
patchwork summary
```

## What it records

| Action | Example |
|---|---|
| File reads | AI read `src/auth/login.ts` |
| File writes | AI modified `src/auth/middleware.ts` |
| File edits | AI edited `src/api/routes.ts` |
| Commands | AI ran `npm test` |
| Web requests | AI fetched `https://docs.example.com/api` |
| MCP tool calls | AI called `mcp__github__create_pr` |
| Sessions | AI session started at 14:22, 47 actions |
| Risk events | AI modified `.env` — CRITICAL (sensitive file) |
| Subagents | AI spawned Explore subagent |

## CLI Commands

```bash
# View events
patchwork log                         # Recent events
patchwork log --agent claude-code     # Filter by agent
patchwork log --risk high             # High-risk events only
patchwork log --session latest        # Last session's events
patchwork log --since "2 hours ago"   # Events since a time
patchwork log --json                  # Raw JSON output
patchwork tail                        # Live event stream (tail -f)
patchwork tail --risk high            # Stream only high-risk events

# Sessions & summaries
patchwork sessions                    # List sessions with stats
patchwork summary                     # Today's activity summary
patchwork summary --period week       # Weekly summary
patchwork show <event-id>             # Full event detail
patchwork show <session-id>           # Full session timeline

# Policy enforcement
patchwork policy show                 # Show active policy
patchwork policy init                 # Create default policy
patchwork policy init --strict        # Create strict enterprise policy
patchwork policy validate policy.yml  # Validate a policy file

# Export & sync
patchwork export                      # Export as JSON
patchwork export --format csv         # Export as CSV
patchwork export --format sarif       # Export as SARIF (GitHub Code Scanning)
patchwork sync codex                  # Import Codex CLI history

# Setup
patchwork init claude-code            # Install Claude Code hooks
patchwork init codex                  # Set up Codex CLI sync
patchwork status                      # Show config, agents, event stats
```

## Policy Engine

Patchwork can enforce rules on what AI agents are allowed to do. Policies are YAML files that define allow/deny rules for files, commands, network access, and MCP tools.

```yaml
# .patchwork/policy.yml
name: my-team-policy
max_risk: high  # Auto-deny anything above this risk level

files:
  deny:
    - pattern: "**/.env"
      reason: Environment files contain secrets
    - pattern: "**/*.key"
      reason: Private key files
  default_action: allow

commands:
  deny:
    - prefix: "rm -rf"
      reason: Recursive force delete
    - prefix: sudo
      reason: Elevated privileges
    - regex: "curl.*|.*sh"
      reason: Pipe to shell
  default_action: allow

network:
  deny:
    - domain: evil.com
  default_action: allow
```

When a policy denies an action, Patchwork tells Claude Code to block it and logs a `denied` event in the audit trail.

**Built-in presets:**
- `default` — Audit-only, everything allowed
- `strict` — Blocks dangerous operations (secrets access, `rm -rf`, `sudo`, force push, etc.)

## Risk Classification

Every event is automatically classified:

| Level | Example |
|---|---|
| **CRITICAL** | Writing to `.env`, running `rm -rf`, `sudo` commands |
| **HIGH** | Modifying `package.json`, `npm install`, `git push --force` |
| **MEDIUM** | File writes, command execution, web requests, MCP tools |
| **LOW** | File reads, glob/grep searches |
| **NONE** | Session start/end, prompt submit |

Sensitive file detection covers: `.env`, private keys (`.pem`, `.key`, `id_rsa`), cloud credentials (`.aws/credentials`), API tokens, database files, and more.

## Supported Agents

| Agent | Status | Integration |
|---|---|---|
| Claude Code | Working | Native hooks (PreToolUse, PostToolUse, Session lifecycle, Subagents) |
| Codex CLI | Working | History parsing + sync |
| Cursor | Planned | Hooks beta |
| GitHub Copilot | Planned | Enterprise audit log API |

## Architecture

```
~/.patchwork/
  events.jsonl          # Append-only audit trail
  policy.yml            # User-level policy (optional)

project/.patchwork/
  policy.yml            # Project-level policy (takes precedence)
```

Three packages:

- **`@patchwork/core`** — Schema (Zod), risk classifier, policy engine, JSONL store, content hashing
- **`@patchwork/agents`** — Agent adapters (Claude Code hooks, Codex parser, auto-detection)
- **`patchwork-audit`** — CLI (Commander.js)

## Export Formats

- **JSON** — Full event data, pipe to `jq` for custom queries
- **CSV** — Import into spreadsheets, BI tools, databases
- **SARIF** — Static Analysis Results Interchange Format, import into GitHub Code Scanning, Snyk, or any SARIF-compatible security tool

## Development Test Log

- Run `pnpm test:log` to execute tests and append a timestamped summary to `docs/TEST_LOG.md`.
- Run `pnpm hooks:install` once to enable the repo `pre-push` hook that runs `pnpm test:log` automatically before each push.
- CI runs `pnpm test:log` on the Node 22 job and uploads `docs/TEST_LOG.md` as a workflow artifact.

## License

Business Source License 1.1 — free for individual and non-competing commercial use. Converts to Apache 2.0 after 3 years.
