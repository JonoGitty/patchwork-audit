---
name: patchwork
description: "Patchwork audit trail helper — check system health, explain how the audit pipeline works, diagnose hook issues, view relay status, and help with policy configuration. Use when the user asks about Patchwork, audit trail, hooks, relay, attestations, compliance, or says /patchwork."
user-invocable: true
argument-hint: "[command] — e.g. 'status', 'explain', 'check', 'policy', 'attestations'"
allowed-tools: Bash, Read, Grep, Glob, Agent
---

# Patchwork Audit Trail — Claude Code Skill

You are a helper for Patchwork, the audit trail for AI coding agents. You help users understand the system, diagnose issues, and check health.

## Parse `$ARGUMENTS`

Route the user's input to the right handler below. If no arguments, show **status**.

---

## 1. Status (no args, "status")

Show a live health dashboard. Run these commands and present results clearly:

```bash
export PATH="$HOME/local/nodejs/node-v22.16.0-darwin-x64/bin:$PATH"

# Event count
echo "=== User Store ===" && wc -l < ~/.patchwork/events.jsonl 2>/dev/null || echo "0 events"

# Relay status
patchwork relay status 2>&1 || echo "Relay not running"

# Last 5 events
echo "=== Recent Events ==="
patchwork log --limit 5 2>&1

# Hook check
echo "=== Hooks ==="
cat ~/.claude/settings.json 2>/dev/null | python3 -c "
import json, sys
d = json.load(sys.stdin)
hooks = d.get('hooks', {})
for event in hooks:
    groups = hooks[event]
    for g in groups:
        if isinstance(g, dict) and 'hooks' in g:
            for h in g['hooks']:
                cmd = h.get('command', '?')
                if 'patchwork' in cmd:
                    print(f'  {event}: OK (nested format)')
                    break
        elif isinstance(g, dict) and 'command' in g:
            if 'patchwork' in g['command']:
                print(f'  {event}: WRONG FORMAT (flat, not nested — hooks will not fire)')
" 2>/dev/null
```

Present as a clean summary with clear pass/fail indicators.

---

## 2. Explain ("explain", "what is patchwork", "how does it work")

Explain Patchwork concisely:

**Patchwork** is an audit trail for AI coding agents. It hooks into Claude Code and records every action — file reads, edits, commands, web requests — into a tamper-evident log with real-time risk classification.

### The 5-layer architecture:

1. **Hash-chained audit log** — every event links to the previous via SHA-256. Tampering breaks the chain.
2. **Root-owned relay daemon** — a separate root process receives copies of every event via Unix socket. Even if the user deletes `~/.patchwork/events.jsonl`, the relay at `/Library/Patchwork/events.relay.jsonl` is intact and untouchable without sudo.
3. **Heartbeat protocol** — the relay emits a heartbeat every 30 seconds. If it stops, something killed the daemon.
4. **Auto-seal** — every 15 minutes, the relay signs the chain tip with HMAC-SHA256. This creates a cryptographic checkpoint.
5. **Signing proxy** — the relay holds a root-owned keyring. Commit attestations are signed through it, so user-level code never touches the key material.

### How hooks work:

Claude Code's `settings.json` defines hooks that fire on every tool call. The format MUST be nested:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          { "type": "command", "command": "patchwork hook post-tool", "timeout": 2000 }
        ]
      }
    ]
  }
}
```

A flat `{ type, command }` without the `matcher`/`hooks` nesting will be silently ignored.

### Commit attestations:

Every `git commit` by the AI generates a signed compliance proof:
- Written to `~/.patchwork/commit-attestations/<sha>.json`
- Attached as a git note under `refs/notes/patchwork`
- Includes session event count, risk summary, chain integrity, HMAC signature

---

## 3. Check ("check", "diagnose", "debug", "why aren't hooks firing")

Run a full diagnostic. Check each of these and report pass/fail:

1. **Hooks format** — read `~/.claude/settings.json`, verify each hook event uses nested `{ matcher, hooks: [...] }` format
2. **Hook scripts exist** — check the hook command paths are valid files
3. **Node binary** — check `~/.patchwork/state/node-path` exists and the binary works
4. **Events flowing** — check if `~/.patchwork/events.jsonl` has events from a real session (UUID-format session IDs, not test IDs)
5. **Relay connected** — run `patchwork relay status`, check socket exists and daemon responds
6. **Relay receiving** — compare event counts between user store and relay
7. **Chain integrity** — run `patchwork verify`
8. **Attestation dir** — check `~/.patchwork/commit-attestations/index.jsonl` exists

For any failures, provide the exact fix command.

---

## 4. Policy ("policy", "what can it block", "deny rules")

Explain how policies work and show the current active policy:

```bash
export PATH="$HOME/local/nodejs/node-v22.16.0-darwin-x64/bin:$PATH"
patchwork policy show 2>&1
```

If no policy exists, explain how to create one:

```bash
patchwork policy init --strict
```

Explain the YAML format with examples of file deny rules, command deny rules, and max_risk settings. Reference `docs/guide.md` section 5 for full details.

---

## 5. Attestations ("attestations", "commits", "git notes", "compliance proof")

Show recent commit attestations:

```bash
# Index
cat ~/.patchwork/commit-attestations/index.jsonl 2>/dev/null | tail -5 | python3 -c "
import json, sys
for line in sys.stdin:
    d = json.loads(line)
    status = 'PASS' if d.get('pass') else 'FAIL'
    print(f\"{d['commit_sha'][:7]}  {status}  {d.get('branch','?')}  {d['generated_at'][:19]}\")
" 2>/dev/null || echo "No attestations yet"

# Latest git note
git notes --ref=patchwork show HEAD 2>/dev/null || echo "No patchwork notes on HEAD"
```

Explain what PASS/FAIL means and how to push notes to remote (`git push origin refs/notes/patchwork`).

---

## 6. Help ("help", "commands", "what can I do")

List available commands:
- `/patchwork` or `/patchwork status` — live health dashboard
- `/patchwork explain` — how the audit system works
- `/patchwork check` — full diagnostic with pass/fail
- `/patchwork policy` — show and explain policy config
- `/patchwork attestations` — recent commit compliance proofs
- `/patchwork help` — this list

Also point to:
- Full user guide: `docs/guide.md` in the repo
- CLI reference: `patchwork --help`
- Dashboard: `patchwork dashboard`

---

## Important Notes

- The user guide is at `docs/guide.md` in the patchwork-audit repo — reference it for detailed walkthroughs
- Node.js path on Intel Macs may be at `~/local/nodejs/node-v22.16.0-darwin-x64/bin` — always set PATH before running patchwork commands
- The relay daemon runs as root via launchd — deploy/restart with `sudo bash scripts/deploy-relay.sh`
- Hook format matters: nested `{ matcher, hooks }` is required, flat format is silently ignored
