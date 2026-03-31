# Patchwork

> The audit trail for AI coding agents.

Every stitch the AI makes, tracked.

---

Patchwork hooks into AI coding agents (Claude Code, Codex CLI) and records everything they do — files read, files written, commands executed, web requests made — into a unified, queryable audit trail with risk classification and policy enforcement.

**Local-first.** Everything works offline. Your data never leaves your machine.

**Tamper-resistant.** The AI agent cannot disable its own monitoring, corrupt the audit log, or weaken its security policy. A watchdog LaunchAgent auto-repairs hooks if they are removed.

## Quickstart

```bash
# Clone and build
git clone https://github.com/JonoGitty/codex-audit.git
cd codex-audit
pnpm install
pnpm build

# Install CLI globally
cd packages/cli && npm link && cd ../..

# Install hooks with strict enforcement (fail-closed)
patchwork init claude-code --strict-profile --policy-mode fail-closed

# Create a security policy
patchwork policy init --strict
# Or copy the included hardened policy:
cp docs/default-policy.yml ~/.patchwork/policy.yml

# Verify it works
patchwork status
```

### Permanent installation (macOS)

To make Patchwork survive Claude Code updates and persist across reboots:

```bash
# Install the session guard (verifies audit system before Claude starts)
cp scripts/guard.sh ~/.patchwork/guard.sh
chmod +x ~/.patchwork/guard.sh

# Install the watchdog LaunchAgent (auto-repairs hooks every 30 min)
cp scripts/com.patchwork.watchdog.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.patchwork.watchdog.plist
```

The watchdog checks every 30 minutes (and on login) that:
- `patchwork` CLI is available
- Hooks are present in `~/.claude/settings.json`
- Fail-closed mode is enabled
- The guard script and policy file exist
- Audit data permissions are correct (0600 files, 0700 dirs)

If anything is missing, it reinstalls automatically and logs the repair to `~/.patchwork/watchdog.log`.

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
| Risk events | AI modified `.env` -- CRITICAL (sensitive file) |
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

# Integrity verification
patchwork verify                      # Hash chain + seal + witness
patchwork seal                        # HMAC-sign the audit trail
patchwork witness publish             # Publish to remote witness

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

## Security Model

### Policy enforcement

Policies are YAML files that define allow/deny rules. When a policy denies an action, Patchwork tells Claude Code to block it and logs a `denied` event.

```yaml
# ~/.patchwork/policy.yml
name: my-policy
max_risk: high  # Auto-deny above this level

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

### Self-protection

The included hardened policy (`docs/default-policy.yml`) prevents the AI agent from:

| Attack | Defence |
|---|---|
| Editing `~/.claude/settings.json` to remove hooks | File deny rule blocks all writes |
| Truncating/deleting `~/.patchwork/events.jsonl` | File deny rule + command regex blocks redirects |
| Weakening `~/.patchwork/policy.yml` | File deny rule blocks writes to policy |
| Reading seal keys | File deny rule blocks access to `.patchwork/keys/**` |
| Timeout-based bypass | Fail-closed mode denies on hook timeout |
| Shell metacharacter evasion | Regex command rules catch pipes/redirects targeting audit data |

### Fail-closed mode

When installed with `--policy-mode fail-closed`, any hook error (crash, timeout, bad input) results in the action being **denied** rather than allowed. This is the recommended mode for production use.

### Session guard

The guard script (`scripts/guard.sh`) runs at the start of every Claude Code session and verifies:
1. `patchwork` CLI is available
2. Audit store directory exists and is writable
3. Policy file is present
4. File permissions are correct

If any check fails, the session starts with a warning and the guard status is recorded for the PreToolUse hook to reference.

### What Patchwork cannot prevent

- A human with direct filesystem access can always modify files (Patchwork runs at user-level, not root)
- Unloading the watchdog LaunchAgent (`launchctl unload ...`)
- A future Claude Code update that changes the hook format entirely
- Using a separate Claude Code profile that doesn't read `~/.claude/settings.json`

For truly tamper-proof auditing, combine Patchwork with OS-level controls (MDM profiles, SIP, or file immutability flags).

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

## CI Attestation

`patchwork attest` runs the full verification pipeline (chain + seal + witness) and writes a machine-readable JSON artifact. Use it in CI to produce durable evidence that an AI coding session was audited.

```bash
# In CI -- fail the pipeline if audit trail is incomplete
patchwork attest \
  --require-seal \
  --require-witness \
  --max-seal-age-seconds 3600 \
  --max-witness-age-seconds 3600 \
  --out audit-attestation.json
```

Attestation artifacts are **HMAC-signed** and include **state-binding fields** that tie the attestation to the exact audit state at generation time.

```bash
# Verify chain + require a valid, signed attestation
patchwork verify \
  --require-signed-attestation \
  --attestation-file audit-attestation.json \
  --max-attestation-age-seconds 3600
```

## Enforcement Profiles

Profiles bundle enforcement flags so teams don't need to pass many flags on every CI invocation.

| Profile | Behavior |
|---|---|
| `baseline` (default) | No enforcement -- audit-only |
| `strict` | Require seal, witness, remote witness proof, signed attestation, binding |

```bash
patchwork verify --profile strict
patchwork attest --profile strict --out audit-attestation.json
```

### Config-driven defaults

```yaml
# ~/.patchwork/config.yml
verify:
  profile: strict
  max_seal_age_seconds: 3600
  max_witness_age_seconds: 3600
  max_attestation_age_seconds: 3600
```

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
  events.jsonl          # Append-only audit trail (JSONL + hash chain)
  db/audit.db           # SQLite indexed mirror (FTS5 search)
  policy.yml            # User-level security policy
  keys/seal/            # HMAC seal keyring
  seals.jsonl           # Seal records
  witnesses.jsonl       # Remote witness records
  attestations/         # CI attestation artifacts
  state/                # Guard status, divergence markers
  watchdog.log          # Watchdog repair log
  guard.sh              # Session start guard script
  watchdog.sh           # LaunchAgent watchdog script
```

Three packages:

- **`@patchwork/core`** -- Schema (Zod), risk classifier, policy engine, JSONL + SQLite stores, hash chain, HMAC sealing, remote witness
- **`@patchwork/agents`** -- Agent adapters (Claude Code hooks, Codex parser, auto-detection)
- **`patchwork-audit`** -- CLI (Commander.js, 19 commands)

## Export Formats

- **JSON** -- Full event data, pipe to `jq` for custom queries
- **CSV** -- Import into spreadsheets, BI tools, databases
- **SARIF** -- Static Analysis Results Interchange Format, import into GitHub Code Scanning

## Platform Support

| Platform | Status | Notes |
|---|---|---|
| Linux | Fully supported | CI-tested on Ubuntu with Node 20 and 22 |
| macOS | Fully supported | LaunchAgent watchdog for permanent installation |
| Windows | Partial | Core works. File permissions not enforced by OS. |

## Known Limitations

- **v0.1.0 -- early release.** APIs and storage format may change.
- **Not yet on npm.** Install from source (see Quickstart).
- **Windows file permissions** are not enforced by the OS.
- **Cursor and GitHub Copilot adapters** are planned but not yet implemented.
- **JSONL storage scales linearly** for full-log reads. Use `patchwork search` for large trails.
- **Seal keys are local.** A compromised machine with both key and data can forge signatures. KMS-backed signing is on the roadmap.
- **Command policy matching is prefix-based.** Complex shell metacharacter evasion may bypass simple prefix rules. The hardened policy includes regex rules for common evasion patterns.

## Development

```bash
pnpm install
pnpm build
pnpm test          # 671 tests across 31 files
pnpm lint
```

## Test Log

- Run `pnpm test:log` to execute tests and append a timestamped summary to `docs/TEST_LOG.md`.
- The repo `pre-push` hook runs `pnpm test:log` automatically before each push.
