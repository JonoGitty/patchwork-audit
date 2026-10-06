# How It Works

Patchwork intercepts every action an AI coding agent takes and records it in a tamper-evident audit trail. This page explains the full pipeline from hook to hash chain.

## The Event Pipeline

```
AI agent calls a tool (e.g. "edit file X")
        │
        ▼
┌─────────────────────┐
│   Hook Intercept     │  Claude Code fires PreToolUse / PostToolUse hooks
│   (packages/agents)  │  Patchwork's hook script receives the tool call
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   Risk Classifier    │  Analyses the action: what is it? what does it touch?
│   (packages/core)    │  Assigns: none | low | medium | high | critical
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   Policy Engine      │  Checks the action against your security policy
│   (packages/core)    │  Decision: allow | deny | warn
└────────┬────────────┘
         │
    ┌────┴────┐
    │ DENIED? │──yes──▶ Return deny response to AI agent (action blocked)
    └────┬────┘
         │ no
         ▼
┌─────────────────────┐
│   Hash Chain         │  Compute SHA-256 hash linking to previous event
│   (packages/core)    │  Append to ~/.patchwork/events.jsonl
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   Relay Daemon       │  Forward event to root-owned relay via Unix socket
│   (packages/core)    │  Relay maintains its own independent chain
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   Auto-Seal          │  Every 15 minutes, HMAC-sign the chain tip
│   (packages/core)    │  Publish seal to witness endpoints for verification
└─────────────────────┘
```

## Audit Events

Every action produces an **audit event** — a structured record of what happened:

```json
{
  "id": "evt_a1b2c3d4",
  "timestamp": "2026-04-05T14:31:04.123Z",
  "session_id": "sess_x7y8z9",
  "agent": "claude-code",
  "action": "command_execute",
  "status": "denied",
  "risk": {
    "level": "critical",
    "flags": ["destructive_command", "system_modification"]
  },
  "target": {
    "type": "command",
    "command": "rm -rf /"
  },
  "project": {
    "name": "my-app",
    "path": "/home/user/my-app"
  },
  "hash": "sha256:8f14e45f...",
  "prev_hash": "sha256:7c211433..."
}
```

Each event includes:
- **What** happened (`action`, `target`)
- **Who** did it (`agent`, `session_id`)
- **Where** it happened (`project`)
- **How risky** it was (`risk.level`, `risk.flags`)
- **Whether it was allowed** (`status`)
- **Chain integrity** (`hash`, `prev_hash`)

See the [Event Schema Reference](/reference/event-schema) for the full specification.

## Hash Chain

Every event's `hash` field is a SHA-256 digest of its content, and every event's `prev_hash` points to the previous event's hash. This creates an unbreakable chain — if anyone modifies, inserts, or deletes an event, the chain breaks and `patchwork verify` will catch it.

```
Event 1          Event 2          Event 3
┌──────────┐     ┌──────────┐     ┌──────────┐
│ hash: A  │◄────│prev: A   │◄────│prev: B   │
│          │     │ hash: B  │     │ hash: C  │
└──────────┘     └──────────┘     └──────────┘
```

This is the same principle behind Git commits and blockchain — a Merkle chain where any tampering is immediately detectable.

## Storage

All data is stored locally on your machine:

| What | Where |
|------|-------|
| Audit events | `~/.patchwork/events.jsonl` |
| SQLite index (search/FTS) | `~/.patchwork/db/audit.db` |
| Seals | `~/.patchwork/seals.jsonl` |
| Witness records | `~/.patchwork/witnesses.jsonl` |
| Commit attestations | `~/.patchwork/commit-attestations/` |
| Generated reports | `~/.patchwork/reports/` |
| Relay events (root-owned) | `/Library/Patchwork/events.relay.jsonl` |
| Relay seals (root-owned) | `/Library/Patchwork/seals.relay.jsonl` |

Nothing is sent to any external service unless you explicitly configure [witness endpoints](/concepts/seals-and-witnesses).

## Next Steps

- [Risk Classification](/concepts/risk-classification) — how Patchwork decides what's dangerous
- [Tamper-Evident Layers](/concepts/tamper-proof-layers) — the 5 layers that make tampering detectable
- [Seals & Witnesses](/concepts/seals-and-witnesses) — cryptographic proof that logs haven't been altered
