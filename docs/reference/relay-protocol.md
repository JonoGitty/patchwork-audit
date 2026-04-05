# Relay Protocol

The relay daemon is a root-owned process that maintains an independent copy of the audit trail, protecting it from non-root users and the AI agent itself.

## Architecture

```
User space                          Root space
┌──────────────┐                    ┌──────────────────────┐
│ Claude Code  │                    │  Relay Daemon        │
│   ↓ hook     │                    │  (launchd/systemd)   │
│ Patchwork    │──Unix socket──────▶│                      │
│ hook script  │  fire-and-forget   │  ┌─────────────────┐ │
└──────────────┘                    │  │ events.relay.jsonl│ │
                                    │  │ seals.relay.jsonl │ │
┌──────────────┐                    │  │ witnesses.jsonl   │ │
│ patchwork    │──Unix socket──────▶│  └─────────────────┘ │
│ CLI          │  request/response  │                      │
└──────────────┘                    │  /Library/Patchwork/  │
                                    └──────────────────────┘
```

## Socket Protocol

**Socket path:** `/Library/Patchwork/relay.sock`

Communication is JSON over Unix domain socket. Each message is a single JSON object followed by a newline.

### Message Types

#### event

Forward an audit event to the relay.

```json
{
  "type": "event",
  "payload": { /* AuditEvent */ }
}
```

The relay appends the event to its own log and maintains an independent hash chain.

#### ping

Health check.

```json
{ "type": "ping" }
```

Response:

```json
{ "status": "ok", "pid": 12345, "uptime_ms": 123456 }
```

#### seal_status

Query the seal state.

```json
{ "type": "seal_status" }
```

Response:

```json
{
  "last_seal_at": "2026-04-05T14:30:00.000Z",
  "last_seal_tip": "sha256:...",
  "last_seal_events": 1847,
  "seals_total": 42,
  "auto_seal_enabled": true,
  "witness_enabled": false
}
```

#### get_chain_state

Query the relay's chain state.

```json
{ "type": "get_chain_state" }
```

Response:

```json
{
  "chain_tip": "sha256:...",
  "event_count": 1847,
  "last_seal_event_count": 1800,
  "last_heartbeat": 1712345678000,
  "uptime_ms": 234567,
  "auto_seal_interval_minutes": 15
}
```

#### sign

Request a signature from the root-owned keyring (Layer 5).

```json
{
  "type": "sign",
  "data": "patchwork-seal:v1:sha256:...:1847:2026-04-05T14:30:00.000Z",
  "key_id": "a1b2c3d4e5f6g7h8"
}
```

Response:

```json
{
  "signature": "hmac-sha256:3b2c1a...",
  "key_id": "a1b2c3d4e5f6g7h8",
  "signed_at": "2026-04-05T14:30:00.123Z",
  "source": "relay"
}
```

User-space code never touches raw key material — signatures are always requested through this proxy.

#### heartbeat

Internal: emitted by the relay every 30 seconds to prove it's running. Heartbeat gaps in the log indicate the relay was stopped.

## File Paths

| File | Path | Owner | Purpose |
|------|------|-------|---------|
| Socket | `/Library/Patchwork/relay.sock` | root | IPC channel |
| Event log | `/Library/Patchwork/events.relay.jsonl` | root | Independent event chain |
| Seals | `/Library/Patchwork/seals.relay.jsonl` | root | Relay seals |
| Witnesses | `/Library/Patchwork/witnesses.relay.jsonl` | root | Witness records |
| Config | `/Library/Patchwork/relay-config.json` | root | Daemon configuration |
| PID file | `/Library/Patchwork/relay.pid` | root | Process tracking |
| Daemon log | `/Library/Patchwork/relay.log` | root | Diagnostic output |
| Keyring | `/Library/Patchwork/keys/seal/` | root | HMAC signing keys |

## Sending Modes

The relay client (`@patchwork/core`) supports three sending modes:

| Mode | Blocking | Use case |
|------|----------|----------|
| **Fire-and-forget** | No | Hook scripts (latency-sensitive) |
| **Async** | Promise-based | CLI commands, short-lived processes |
| **Sync** | Yes | Testing, diagnostics |

Fire-and-forget has a 500ms timeout. If the relay is unreachable, events are still written to the user-level log and a divergence marker is recorded at `~/.patchwork/state/relay-divergence.json`.

## Relay Configuration

`/Library/Patchwork/relay-config.json`:

```json
{
  "auto_seal": {
    "enabled": true,
    "interval_minutes": 15,
    "min_events_between_seals": 1
  },
  "witness": {
    "enabled": true,
    "quorum": 2,
    "endpoints": [
      {
        "url": "https://witness.example.com/api/v1/anchor",
        "name": "Primary Witness"
      },
      {
        "url": "https://witness2.example.com/api/v1/anchor",
        "name": "Secondary Witness",
        "auth_token": "bearer-token"
      }
    ]
  }
}
```

## Deployment

### macOS (launchd)

```bash
sudo bash scripts/deploy-relay.sh
```

This installs a launchd plist at `/Library/LaunchDaemons/com.patchwork.relay.plist`.

### Linux (systemd)

```bash
sudo bash scripts/system-install.sh
```

This installs a systemd service at `/etc/systemd/system/patchwork-relay.service`.

### Management

```bash
# Check status
patchwork relay status

# Verify relay log matches user log
patchwork relay verify
```
