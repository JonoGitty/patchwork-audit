# CLI Commands

Complete reference for the `patchwork` command-line interface.

## Getting Started

| Command | Description |
|---------|-------------|
| [`init`](#init) | Install hooks for an AI agent |
| [`setup`](#setup) | Interactive setup wizard |
| [`doctor`](#doctor) | Check Patchwork health |
| [`status`](#status) | Show configuration and stats |

## Viewing Events

| Command | Description |
|---------|-------------|
| [`log`](#log) | View recent audit events |
| [`tail`](#tail) | Live stream events (like `tail -f`) |
| [`search`](#search) | Full-text search across events |
| [`sessions`](#sessions) | List recent sessions |
| [`show`](#show) | Full detail for an event or session |
| [`summary`](#summary) | Summarise AI agent activity |
| [`stats`](#stats) | Aggregate statistics |
| [`diff`](#diff) | Show file changes in a session |

## Integrity & Security

| Command | Description |
|---------|-------------|
| [`verify`](#verify) | Verify hash chain integrity |
| [`seal`](#seal) | HMAC-seal the current chain tip |
| [`witness`](#witness) | Anchor seals to external witnesses |
| [`attest`](#attest) | Generate signed attestation artifacts |
| [`commit-attest`](#commit-attest) | View and verify commit attestations |

## Reporting & Export

| Command | Description |
|---------|-------------|
| [`report`](#report) | Generate compliance reports |
| [`export`](#export) | Export events as JSON, CSV, or SARIF |
| [`replay`](#replay) | Replay a session step-by-step |
| [`dashboard`](#dashboard) | Launch the web dashboard |

## Policy & Configuration

| Command | Description |
|---------|-------------|
| [`policy`](#policy) | Manage enforcement policies |
| [`relay`](#relay) | Manage the root-owned relay daemon |
| [`sync`](#sync) | Sync events or rebuild database |

## Team Mode

| Command | Description |
|---------|-------------|
| [`team`](#team) | Team server enrollment and sync |

---

## init

Install Patchwork hooks for AI coding agents.

```bash
patchwork init [agent]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `agent` | Agent to configure: `claude-code`, `codex`, or `all` |

**Options:**

| Option | Description |
|--------|-------------|
| `--project <path>` | Install project-level hooks instead of global |
| `--strict-profile` | Enable all security layers (fail-closed + telemetry) |
| `--policy-mode <mode>` | `audit` (default) or `fail-closed` |
| `--pretool-fail-closed` | Block actions when policy check errors |

**Examples:**

```bash
# Standard setup
patchwork init claude-code

# Maximum security
patchwork init claude-code --strict-profile --policy-mode fail-closed

# Project-level only
patchwork init claude-code --project ./my-app
```

## setup

Interactive setup wizard that walks you through installation step by step.

```bash
patchwork setup
```

## doctor

Check Patchwork health: hooks, Node.js, store, policy, watchdog, relay.

```bash
patchwork doctor
```

Reports the status of every component and flags anything that needs attention.

## status

Show Patchwork configuration and statistics.

```bash
patchwork status
```

---

## log

View recent audit events.

```bash
patchwork log [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-n, --limit <n>` | Number of events | 25 |
| `--agent <agent>` | Filter by agent | — |
| `--action <action>` | Filter by action type | — |
| `--risk <level>` | Minimum risk level | — |
| `--session <id>` | Filter by session (`latest` for most recent) | — |
| `--project <name>` | Filter by project name | — |
| `--target <glob>` | Filter by target path | — |
| `--since <time>` | Events since (ISO date or relative) | — |
| `--json` | Output as JSON | — |
| `--compact` | One-line format | — |

**Examples:**

```bash
# Last 50 events
patchwork log -n 50

# High-risk events from today
patchwork log --risk high --since today

# File writes in latest session
patchwork log --session latest --action file_write

# Events targeting .env files
patchwork log --target "**/.env*"
```

## tail

Live stream of audit events, like `tail -f`.

```bash
patchwork tail [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--compact` | One-line format |
| `--risk <level>` | Minimum risk level |
| `--agent <agent>` | Filter by agent |
| `--json` | Output raw JSON |

## search

Full-text search across audit events (requires SQLite store).

```bash
patchwork search <query> [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-n, --limit <n>` | Maximum results | 25 |
| `--session <id>` | Filter by session | — |
| `--json` | Output as JSON | — |

**Examples:**

```bash
patchwork search "middleware.ts"
patchwork search "npm install" --session latest
```

## sessions

List recent AI agent sessions.

```bash
patchwork sessions [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-n, --limit <n>` | Number of sessions | 10 |
| `--agent <agent>` | Filter by agent | — |

## show

Show full detail for an event or session.

```bash
patchwork show <id>
```

Pass an event ID (`evt_...`) or session ID (`ses_...`).

## summary

Summarise AI agent activity.

```bash
patchwork summary [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--session <id>` | Summarise a specific session (`latest` supported) |
| `--today` | Today's activity (default) |
| `--week` | This week's activity |

## stats

Aggregate statistics across audit events.

```bash
patchwork stats [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--since <time>` | Events since (ISO date or relative) |
| `--session <id>` | Filter by session |
| `--json` | Output as JSON |

## diff

Show file changes in a session.

```bash
patchwork diff <session-id> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

---

## verify

Verify tamper-evident hash chain integrity.

```bash
patchwork verify [options]
```

**Key options:**

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |
| `--strict` | Fail if any legacy (unchained) events exist |
| `--file <path>` | Path to JSONL file |
| `--require-seal` | Fail if no valid seal exists |
| `--require-witness` | Fail if no valid witness record exists |
| `--require-attestation` | Fail if attestation is missing or tampered |
| `--profile <name>` | `strict` or `baseline` (default) |

**Seal options:**

| Option | Description |
|--------|-------------|
| `--seal-file <path>` | Path to seals JSONL |
| `--key-file <path>` | Legacy single seal key |
| `--keyring-dir <path>` | Seal keyring directory |
| `--no-seal-check` | Skip seal verification |
| `--max-seal-age-seconds <n>` | Fail if seal is too old |

**Witness options:**

| Option | Description |
|--------|-------------|
| `--witness-file <path>` | Path to witness records |
| `--no-witness-check` | Skip witness verification |
| `--require-remote-witness-proof` | Fail if remote quorum not met |
| `--remote-witness-quorum <n>` | Minimum remote proofs required |
| `--remote-witness-timeout-ms <n>` | HTTP timeout per endpoint |

**Examples:**

```bash
# Basic verification
patchwork verify

# Strict: require seal, witness, and attestation
patchwork verify --require-seal --require-witness --require-attestation

# CI profile
patchwork verify --profile strict --json
```

## seal

HMAC-seal the current chain tip.

```bash
patchwork seal [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--file <path>` | Path to events JSONL |
| `--seal-file <path>` | Path to seals JSONL |
| `--keyring-dir <path>` | Seal keyring directory |
| `--json` | Output as JSON |

## witness

Anchor chain tips to external witness endpoints.

### witness publish

```bash
patchwork witness publish [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--witness-url <url...>` | Witness endpoint URL(s) |
| `--quorum <n>` | Minimum successful witnesses (default: 1) |
| `--timeout-ms <n>` | HTTP timeout per endpoint (default: 2000) |
| `--token-env <name>` | Environment variable for bearer token |
| `--json` | Output as JSON |

### witness verify

```bash
patchwork witness verify [options]
```

Contacts each witness endpoint and verifies stored anchors match local seals.

**Options:**

| Option | Description |
|--------|-------------|
| `--quorum <n>` | Minimum verified witnesses (default: 1) |
| `--tip-hash <hash>` | Verify a specific chain tip |
| `--json` | Output as JSON |

## attest

Generate a signed attestation artifact from verification results.

```bash
patchwork attest [options]
```

**Key options:**

| Option | Description |
|--------|-------------|
| `--out <path>` | Output path (default: `~/.patchwork/attestations/latest.json`) |
| `--json` | Print attestation to stdout |
| `--require-seal` | Fail if no valid seal |
| `--require-witness` | Fail if no valid witness |
| `--history` | Write timestamped copy to history |
| `--profile <name>` | `strict` or `baseline` |

## commit-attest

View and verify commit attestations.

```bash
patchwork commit-attest [sha] [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--verify` | Verify the attestation signature |
| `--list` | List all attested commits |
| `--json` | Output as JSON |

---

## report

Generate compliance reports mapped to regulatory frameworks.

```bash
patchwork report [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--framework <fw>` | `soc2`, `iso27001`, `eu-ai-act`, `all` | `all` |
| `--since <time>` | Report period start | — |
| `--session <id>` | Report on specific session | — |
| `--format <fmt>` | `html` or `json` | `html` |
| `--include-gaps` | Include gap analysis | — |
| `--include-trends` | Include compliance trends | — |
| `--trend-period <p>` | `daily`, `weekly`, `monthly` | `daily` |
| `-o, --output <file>` | Output path | `~/.patchwork/reports/` |

**Examples:**

```bash
# Full report with gaps
patchwork report --framework all --include-gaps

# EU AI Act only, JSON format
patchwork report --framework eu-ai-act --format json

# Last 30 days with trends
patchwork report --since 2026-03-01 --include-trends
```

## export

Export audit events in various formats.

```bash
patchwork export [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--format <fmt>` | `json`, `csv`, `sarif` | `json` |
| `--session <id>` | Filter by session | — |
| `--since <time>` | Events since | — |
| `--risk <level>` | Minimum risk level | — |
| `-o, --output <file>` | Output path | `~/.patchwork/reports/` |

The SARIF format is compatible with GitHub Code Scanning, Snyk, and other security tools.

## replay

Replay an AI agent session step-by-step.

```bash
patchwork replay <session-id> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--all` | Show all events at once (non-interactive) |
| `--html` | Output as HTML |
| `--speed <ms>` | Auto-play speed |
| `--risk <level>` | Filter by minimum risk |
| `--files-only` | Only show file change events |
| `--no-git` | Skip git diff integration |
| `-o, --output <file>` | Write HTML to file |

**Examples:**

```bash
# Interactive replay
patchwork replay ses_abc123

# Generate HTML report
patchwork replay ses_abc123 --html

# High-risk events only
patchwork replay ses_abc123 --risk high --all
```

## dashboard

Launch the Patchwork web dashboard.

```bash
patchwork dashboard [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --port <port>` | Port number | 3000 |
| `--no-open` | Don't open browser | — |

Alias: `patchwork web`

---

## policy

Manage enforcement policies.

### policy show

Show the active policy (merged from system, user, and project levels).

```bash
patchwork policy show
```

### policy init

Create a new policy file.

```bash
patchwork policy init [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--strict` | Use the strict preset |
| `--project` | Create in project directory instead of user directory |

### policy export

Print the active policy as YAML.

```bash
patchwork policy export
```

### policy validate

Validate a policy file.

```bash
patchwork policy validate <file>
```

## relay

Manage the root-owned audit relay daemon.

### relay start

Start the relay daemon (requires root).

```bash
sudo patchwork relay start [options]
```

### relay status

Check relay daemon status and health.

```bash
patchwork relay status
```

### relay verify

Verify relay log integrity against user-side events.

```bash
patchwork relay verify
```

## sync

Sync events from agent history files or rebuild the database.

### sync db

Rebuild the SQLite database from JSONL events.

```bash
patchwork sync db
```

### sync db-status

Check whether a SQLite divergence marker is present.

```bash
patchwork sync db-status [options]
```

---

## team

Team Mode — sync events to a centralised team server.

### team enroll

Enroll this machine in a team.

```bash
patchwork team enroll <server-url> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--token <token>` | Enrollment token |
| `--name <name>` | Developer name |

### team status

Show team sync status.

```bash
patchwork team status
```

### team server start

Start the team server.

```bash
patchwork team server start [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--port <port>` | Server port | 3001 |
| `--db <path>` | SQLite database path | — |
| `--host <host>` | Bind host | 0.0.0.0 |

### team unenroll

Remove this machine from the team.

```bash
patchwork team unenroll
```
