# Security Architecture

A technical deep-dive into Patchwork's security design.

## Defence in Depth

Patchwork follows the defence-in-depth principle: no single layer is trusted to work alone. Each layer covers the failure modes of the others.

```
┌─────────────────────────────────────────────┐
│  Layer 5: Key Hardening & Signing Proxy     │
│  Root-owned keyring, signing via relay       │
├─────────────────────────────────────────────┤
│  Layer 4: Auto-Seal with HMAC + Witnesses   │
│  Periodic cryptographic snapshots            │
├─────────────────────────────────────────────┤
│  Layer 3: Heartbeat Protocol                │
│  30s liveness proof, gap detection           │
├─────────────────────────────────────────────┤
│  Layer 2: Root-Owned Audit Relay            │
│  Independent chain, protected by OS perms    │
├─────────────────────────────────────────────┤
│  Layer 1: Hash-Chained Audit Log            │
│  SHA-256 chain, tamper detection             │
└─────────────────────────────────────────────┘
```

See [Tamper-Proof Layers](/concepts/tamper-proof-layers) for a user-friendly explanation of each layer.

## Cryptographic Primitives

| Primitive | Algorithm | Purpose |
|-----------|-----------|---------|
| Event hashing | SHA-256 | Hash chain integrity |
| Seal signing | HMAC-SHA256 | Tamper-evident snapshots |
| Key derivation | SHA-256 (first 16 hex chars) | Key ID generation |
| Canonical serialization | Deterministic JSON (sorted keys) | Reproducible hashes |

### Hash Chain

Each event hash is computed over a canonical JSON representation of the event (excluding `hash` and `prev_hash` fields). The canonical serializer sorts keys deterministically and strips whitespace to ensure identical inputs always produce identical hashes.

```
hash(event) = SHA-256(canonical_json(event \ {hash, prev_hash}))
```

The `prev_hash` field creates the chain link:

```
event[n].prev_hash = event[n-1].hash
```

### Seal Payload

The seal payload is a deterministic string:

```
patchwork-seal:v1:{tip_hash}:{chained_events}:{sealed_at}
```

This is signed with HMAC-SHA256 using the active key from the keyring.

### Timing-Safe Comparison

Seal verification uses `crypto.timingSafeEqual` to prevent timing attacks on HMAC comparison.

## Keyring Architecture

Keys are stored in a directory-based keyring:

```
/Library/Patchwork/keys/seal/    (root-owned, 0o700)
├── ACTIVE                       (text file: active key ID)
├── a1b2c3d4e5f6g7h8.key        (0o600)
├── f9e8d7c6b5a49382.key        (0o600, rotated)
└── ...
```

- Each key is 32 bytes of `crypto.randomBytes`, hex-encoded
- Key IDs are derived from `SHA-256(key).slice(0, 16)`
- The `ACTIVE` file points to the current signing key
- Rotated keys are preserved for seal verification
- The relay reads keys; user-space code requests signatures via the socket

### Signing Proxy Flow

```
User space                    Root relay
    │                             │
    ├─ sign request ─────────────▶│
    │  (data, key_id?)            │
    │                             ├─ load key from keyring
    │                             ├─ HMAC-SHA256(data, key)
    │◀─ signature response ───────┤
    │  (signature, key_id,        │
    │   signed_at, source)        │
```

If the relay is unavailable, the client falls back to a user-owned keyring at `~/.patchwork/keys/seal/` — less secure (no root protection) but functional.

## Relay Daemon

The relay runs as a launchd/systemd service under root. It:

1. Listens on a Unix domain socket (`/Library/Patchwork/relay.sock`)
2. Accepts fire-and-forget event messages from user-space hooks
3. Maintains an independent hash chain in root-owned files
4. Emits heartbeats every 30 seconds
5. Auto-seals the chain every 15 minutes
6. Publishes seals to configured witness endpoints

### Process Isolation

The relay daemon and the user's AI agent run in completely separate process trees. The agent cannot:
- Read the relay's files (root-owned, 0o600/0o700)
- Write to the relay's socket (write-only, the relay validates messages)
- Kill the relay process (requires root)
- Modify the launchd/systemd configuration (requires root)

## Witness Trust Model

Witnesses provide **independent verification** of seals. The trust model is:

1. **No single witness is trusted.** A quorum of independent witnesses must confirm.
2. **Witnesses don't trust each other.** Each witness stores its own append-only log.
3. **The protocol is open.** Anyone can run a witness server.
4. **Clients keep receipts.** Even if a witness is compromised, the client has local proof.

This follows the same principle as [Certificate Transparency](https://certificate.transparency.dev/) in the TLS ecosystem.

See [Seals & Witnesses](/concepts/seals-and-witnesses) for configuration details.

## File Permissions

| Path | Owner | Permissions | Why |
|------|-------|-------------|-----|
| `~/.patchwork/` | user | 0o700 | User data directory |
| `~/.patchwork/events.jsonl` | user | 0o600 | User-level audit log |
| `~/.patchwork/keys/` | user | 0o700 | User keyring (fallback) |
| `/Library/Patchwork/` | root | 0o755 | System enforcement |
| `/Library/Patchwork/events.relay.jsonl` | root | 0o644 | Root audit log |
| `/Library/Patchwork/keys/seal/` | root | 0o700 | Root keyring |
| `/Library/Patchwork/keys/seal/*.key` | root | 0o600 | Signing keys |
| `/Library/Patchwork/relay.sock` | root | 0o777 | IPC (anyone can write) |

## Watchdog

The watchdog is a periodic task (launchd timer / systemd timer / Task Scheduler) that verifies:

1. Hooks are installed in the AI agent's configuration
2. Hook scripts haven't been modified (hash baseline)
3. The relay daemon is running
4. The policy file is intact

If any check fails, the watchdog can re-install hooks and alert the administrator.
