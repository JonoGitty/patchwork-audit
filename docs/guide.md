# Patchwork User Guide

A practical walkthrough for getting Patchwork running, understanding what it captures, and using it for compliance.

---

## 1. Installation

### From npm (recommended)

```bash
npm install -g patchwork-audit
```

### From source

```bash
git clone https://github.com/JonoGitty/patchwork-audit.git
cd patchwork-audit
pnpm install && pnpm build
cd packages/cli && npm link
```

Verify the install:

```bash
patchwork --version
```

---

## 2. First 5 Minutes

### Hook into Claude Code

```bash
patchwork init claude-code
```

This writes hooks into `~/.claude/settings.json`. Every tool call Claude Code makes -- file reads, edits, bash commands, web requests -- is now intercepted and logged.

For stricter enforcement:

```bash
patchwork init claude-code --strict-profile --policy-mode fail-closed
```

This enables:
- **Fail-closed mode** -- if the hook crashes or times out, the action is denied (not allowed)
- **Latency telemetry** -- warns if hooks take too long
- **Default strict policy** -- blocks dangerous operations like `rm -rf`, `.env` access, `sudo`

### Make a tool call

Start a Claude Code session and do something -- ask it to read a file, run a command, edit code. Then check the log:

```bash
patchwork log
```

You should see events appearing in real-time:

```
16:31:04  claude-code   file_read           src/index.ts                LOW       completed
16:31:07  claude-code   command_execute     npm test                    MEDIUM    completed
16:31:10  claude-code   file_edit           src/auth.ts                 MEDIUM    completed
```

### Live stream

```bash
patchwork tail
```

This streams events as they happen, like `tail -f` for your audit trail.

---

## 3. The Dashboard

```bash
patchwork dashboard
```

Opens a web UI at `http://localhost:3000` with six pages:

### Overview
The landing page. Shows:
- **Stat cards** -- total events, sessions, risk breakdown at a glance
- **Activity chart** -- 14-day event volume
- **Risk donut** -- proportion of events by risk level
- **Recent events** -- last 20 events with risk badges
- **Recent sessions** -- last 10 sessions with event counts

### Events
Filterable event log. Use the dropdowns to filter by:
- **Agent** -- which AI tool generated the event
- **Action** -- file_read, file_edit, command_execute, etc.
- **Risk level** -- critical, high, medium, low, none

Click any event to see full detail including the target file/command, risk flags, and hash chain position.

### Sessions
Each time the AI starts working, it creates a session. This page shows:
- Session start/end times
- Total events, writes, and commands in each session
- Click to drill down into a timeline of everything the AI did

### Risk
Risk trends over time. Shows:
- **Risk over time chart** -- spot spikes in high-risk activity
- **Risk flags breakdown** -- which specific flags are triggering (sensitive file, destructive command, etc.)
- **Denials table** -- every action that was blocked by policy

### Search
Full-text search across all events, powered by SQLite FTS5. Search for file paths, commands, session IDs, or any text in the audit trail.

### Doctor
System health check. Shows:
- Hook status for each installed agent
- Relay daemon health (connected, heartbeat age, event count)
- Store integrity (hash chain valid or broken)
- Policy status

---

## 4. Understanding Events

Every event has these fields:

| Field | Meaning |
|-------|---------|
| `action` | What happened: `file_read`, `file_edit`, `file_create`, `command_execute`, `web_fetch`, `session_start`, etc. |
| `status` | `completed` (action ran), `denied` (policy blocked it), `failed` (action errored) |
| `risk.level` | `none`, `low`, `medium`, `high`, `critical` |
| `risk.flags` | Why this risk level: `sensitive_file`, `destructive_command`, `privilege_escalation`, etc. |
| `target` | What was acted on: file path, command string, URL |
| `session_id` | Groups events into AI work sessions |
| `event_hash` | SHA-256 hash linking this event to the previous one (tamper detection) |

### Risk levels

| Level | Triggers |
|-------|----------|
| **CRITICAL** | `.env`, SSH keys, `rm -rf /`, `sudo`, credential files |
| **HIGH** | `package.json` edits, `npm install`, force push, cloud credential files |
| **MEDIUM** | Any file write, command execution, web request, MCP tool call |
| **LOW** | File reads, glob/grep searches |
| **NONE** | Session start/end, prompt submit |

### Viewing a single event

```bash
patchwork show <event-id>
```

Shows the full JSON with all fields, including the hash chain position and provenance (which hook captured it).

---

## 5. Policy Configuration

Policies control what the AI is allowed to do. Without a policy, Patchwork runs in audit-only mode -- everything is logged but nothing is blocked.

### Creating a policy

```bash
patchwork policy init --strict
```

Creates `~/.patchwork/policy.yml` with sensible defaults. Or write your own:

```yaml
name: my-team-policy
max_risk: high            # Auto-deny anything classified above this level

files:
  deny:
    - pattern: "**/.env"
      reason: Environment files contain secrets
    - pattern: "**/.claude/settings.json"
      reason: Audit hooks must not be modified
    - pattern: "**/id_rsa"
      reason: SSH private keys
  default_action: allow

commands:
  deny:
    - prefix: "rm -rf"
      reason: Recursive force delete is too dangerous
    - prefix: sudo
      reason: Elevated privileges not allowed
    - prefix: "git push --force"
      reason: Force push blocked by policy
  default_action: allow
```

### Policy precedence

Policies are loaded in this order (first match wins):
1. **System policy** -- `/Library/Patchwork/policy.yml` (root-owned, can't be changed by user)
2. **User policy** -- `~/.patchwork/policy.yml`
3. **Project policy** -- `.patchwork/policy.yml` in the project directory
4. **Default** -- built-in audit-only policy (allows everything)

### Testing deny rules

Make a tool call that should be denied:

```bash
# In Claude Code, ask it to read .env
# The PreToolUse hook will block it and you'll see:
patchwork log --risk high
```

Denied events show `DENIED` status and include the policy rule that triggered the block.

---

## 6. Commit Attestations

Every time the AI makes a `git commit`, Patchwork generates a signed compliance proof automatically. No action needed -- it's built into the PostToolUse hook.

### What gets generated

1. **Attestation file** at `~/.patchwork/commit-attestations/<sha>.json`
2. **Git note** attached to the commit under `refs/notes/patchwork`
3. **Index entry** at `~/.patchwork/commit-attestations/index.jsonl`

### Reading attestations

```bash
# View the git note on any commit
git notes --ref=patchwork show <commit-sha>

# Example output:
# Patchwork-Approved: sha256:fa02b189...
# Status: PASS
# Session: c68f85c5-24ca-402c-bf2c-...
# Chain: valid (52 events)
# Risk: 0 critical, 0 high, 35 medium
# Policy: system:/Library/Patchwork/policy.yml
```

### What PASS and FAIL mean

| Status | Meaning |
|--------|---------|
| **PASS** | Hash chain is intact, no high-risk policy denials since the last commit, events exist |
| **FAIL** | One or more issues detected (see `failure_reasons`) |

Failure reasons:
- `chain_integrity_failure` -- the hash chain has been tampered with or events were deleted
- `high_risk_denials_since_last_commit` -- the AI attempted a critical- or high-risk action that was blocked between the last commit and this one. Low/medium-risk denials are recorded but don't fail the attestation, because they represent the policy working as intended, not a broken commit.
- `no_session_events` -- no audit events exist for this session (hooks may not be working)

### Coverage — which commits get attested

Attestation runs inside the PostToolUse hook, so it only sees commits the instrumented agent makes. **Commits made outside Claude Code -- from a plain terminal, an IDE's built-in git, or another agent that isn't hooked -- will not be attested.** To confirm a branch has full coverage, compare `git log` against `patchwork commit-attest --list`.

If an unattested commit appears in the history and you need a retrospective proof, there isn't one -- the session's events aren't linked to that SHA. The fix is structural: route all commits through an instrumented agent, or add a pre-receive/CI gate that rejects commits without a Patchwork note.

### Pushing notes to remote

Git notes aren't pushed by default. To share attestations:

```bash
git push origin refs/notes/patchwork
```

---

## 7. The Relay Daemon

The relay is the tamper-proof backbone. It's a root-owned daemon that receives copies of every event via Unix socket and writes them to an append-only log that non-root users cannot modify.

### Why it matters

The user-owned audit trail at `~/.patchwork/events.jsonl` can be deleted or modified by anyone with access to your user account -- including the AI agent itself. The relay at `/Library/Patchwork/events.relay.jsonl` is root-owned (mode 0644: readable by all, writable only by root). Even if the user-side store is wiped, the relay has the complete record.

### Checking relay health

```bash
patchwork relay status
```

```
Relay Status

  Socket:     /Library/Patchwork/relay.sock
  PID:        16274
  Status:     running
  Chain tip:  sha256:cc61c746ec70f545...

  Relay log:  /Library/Patchwork/events.relay.jsonl
  Events:     263
  Last beat:  12s ago
  Uptime:     1h 30m

  Seals:      6
  Last seal:  8m ago (263 events)
  Auto-seal:  on (every 15m)
```

Key things to check:
- **Status: running** -- daemon is alive
- **Last beat** -- should be under 60s (heartbeat every 30s)
- **Events** -- should match or exceed user-side event count
- **Seals** -- HMAC seals generated periodically

### Verifying integrity

```bash
patchwork relay verify
```

Reads the entire relay log and checks every line for valid JSON and correct hash chain linkage. Reports corrupt or missing entries.

### Deploying / restarting

```bash
sudo bash scripts/deploy-relay.sh
```

This installs (or reinstalls) the launchd daemon, writes the default config at `/Library/Patchwork/relay-config.json`, and starts the daemon. It auto-restarts on crash and starts at boot.

### Relay config

Edit `/Library/Patchwork/relay-config.json` (as root):

```json
{
  "auto_seal": {
    "enabled": true,
    "interval_minutes": 15,
    "min_events_between_seals": 1
  },
  "witness": {
    "enabled": false,
    "endpoints": [],
    "quorum": 1
  }
}
```

- **auto_seal** -- controls how often the relay signs the chain tip with HMAC-SHA256
- **witness** -- when configured, seals are published to external endpoints for off-machine anchoring

---

## 8. Compliance Reports

Patchwork maps your audit data to 7 compliance frameworks with 31 controls:

```bash
# All frameworks
patchwork report --framework all -o report.html

# Specific framework
patchwork report --framework soc2

# With gap analysis (what needs fixing)
patchwork report --include-gaps

# With trends over time
patchwork report --include-trends --trend-period weekly
```

### Supported frameworks

| Framework | Controls | Focus |
|-----------|----------|-------|
| SOC 2 Type II | 6 | Access controls, monitoring, change management |
| ISO 27001:2022 | 5 | Privileged access, logging, secure development |
| EU AI Act | 4 | Record-keeping, transparency, human oversight |
| GDPR | 4 | Lawfulness, processor compliance, security |
| NIST AI RMF | 4 | Risk mapping, data governance, monitoring |
| HIPAA | 4 | Access controls, audit trail, user identification |
| PCI DSS | 4 | Config changes, access restriction, logging |

Each control evaluates real events and returns:
- **PASS** -- evidence found, control satisfied
- **FAIL** -- evidence contradicts the control (e.g. denials present, chain broken)
- **PARTIAL** -- some evidence but incomplete coverage

### Gap analysis

```bash
patchwork report --framework soc2 --include-gaps --format json
```

Shows which controls need attention and specific remediation steps.

---

## 9. System-Level Enforcement

For managed machines where users should not be able to disable auditing:

```bash
# Single user
sudo bash scripts/system-install.sh

# All users on this Mac
sudo bash scripts/system-install.sh --all-users

# Specific users
sudo bash scripts/system-install.sh --users alice,bob
```

This:
- Locks `settings.json` with `chflags schg` (system immutable flag -- requires root to remove)
- Installs a root-owned policy at `/Library/Patchwork/policy.yml`
- Deploys the relay daemon
- Installs a watchdog that checks every 5 minutes and repairs tampered hooks

### What can't be bypassed

| Attack | Defence |
|--------|---------|
| AI edits settings.json to remove hooks | File locked with schg flag, policy denies writes, watchdog repairs |
| AI deletes the audit log | Policy denies, relay has independent copy |
| AI weakens the policy file | Policy file is root-owned, policy denies writes to itself |
| Hook times out | Fail-closed mode denies on timeout |
| User kills the watchdog | LaunchDaemon auto-restarts it |

---

## 10. CLI Reference

### Viewing events

```bash
patchwork log                         # Last 20 events
patchwork log --limit 100             # More events
patchwork log --risk high             # High-risk only
patchwork log --session latest        # Last session only
patchwork tail                        # Live stream
patchwork show <event-id>             # Full event detail
patchwork search "package.json"       # Full-text search
```

### Sessions

```bash
patchwork sessions                    # List recent sessions
patchwork summary                     # Today's activity summary
patchwork replay <session-id>         # Step-through replay
patchwork replay <id> --html -o r.html  # Shareable HTML timeline
patchwork diff <session-id>           # File changes in a session
```

### Integrity

```bash
patchwork verify                      # Hash chain verification
patchwork seal                        # HMAC sign the trail
patchwork attest --profile strict     # CI attestation artifact
```

### Relay

```bash
patchwork relay status                # Health check
patchwork relay verify                # Log integrity check
```

### Compliance

```bash
patchwork report --framework all      # All 7 frameworks
patchwork report --include-gaps       # Gap analysis
patchwork report --include-trends     # Trends over time
```

### Export

```bash
patchwork export --format sarif       # For GitHub Code Scanning
patchwork export --format csv         # For spreadsheets
```

### Health

```bash
patchwork doctor                      # Full system health check
patchwork status                      # Quick status
```

---

## Troubleshooting

### Hooks not firing

Check that settings.json has the correct nested format:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "...",
            "timeout": 2000
          }
        ]
      }
    ]
  }
}
```

The `matcher` + nested `hooks` array is required. A flat `{ type, command }` at the top level will be silently ignored by Claude Code.

Reinstall hooks to fix:

```bash
patchwork init claude-code
```

### Relay not receiving events

```bash
patchwork relay status
```

If events count is 0 but user-side events exist, the relay send may be failing silently. Check for a divergence marker:

```bash
cat ~/.patchwork/state/relay-divergence.json
```

If present, it shows the failure count and last error. Common fix: redeploy with `sudo bash scripts/deploy-relay.sh`.

### Attestation shows FAIL

Check the `failure_reasons` in the attestation:

```bash
cat ~/.patchwork/commit-attestations/<sha>.json | python3 -m json.tool
```

- `chain_integrity_failure` -- events were deleted or modified. The hash chain is broken. This resets on the next clean session.
- `policy_denials_present` -- the AI tried something that was blocked. Review the denials in that session.
- `no_session_events` -- hooks may not be firing. See "Hooks not firing" above.

### Mixed architecture Macs (Intel + ARM homebrew)

If you have an Intel Mac with ARM homebrew node, patchwork's hook-wrapper discovers the correct node binary at session start. If hooks fail, check:

```bash
cat ~/.patchwork/state/node-path
```

This should point to an Intel-compatible node binary, not the ARM one in `/opt/homebrew/bin/`.
