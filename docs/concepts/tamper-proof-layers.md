# Tamper-Proof Layers

Patchwork uses a 5-layer defence-in-depth architecture to ensure audit logs cannot be tampered with — even by the AI agent itself or a compromised user account.

## Why 5 Layers?

No single security mechanism is sufficient on its own. A hash chain can detect tampering, but it can't prevent someone from deleting the log. A root-owned daemon can protect the log, but it needs integrity verification. Each layer covers the weaknesses of the others.

## Layer 1: Hash-Chained Audit Log

**What it does:** Every event is hashed with SHA-256 and linked to the previous event, creating an unbreakable chain.

**What it protects against:** Modification, insertion, or deletion of individual events. If any event is altered, the chain breaks.

**How to verify:**

```bash
patchwork verify
```

```
Chain integrity: VALID
  Chained events: 1,847
  Legacy events: 0
  Hash mismatches: 0
```

**Limitation:** The log file itself (`~/.patchwork/events.jsonl`) is owned by the user. A determined attacker with user-level access could delete or rewrite the entire file. That's what Layer 2 solves.

## Layer 2: Root-Owned Audit Relay

**What it does:** A separate daemon, running as root, receives a copy of every event via Unix socket. It maintains its own independent hash chain in a root-owned directory.

**What it protects against:** A non-root user (or the AI agent running as the user) deleting or modifying the audit log. The relay's copy is in `/Library/Patchwork/` which requires root access to modify.

**How to deploy:**

```bash
sudo bash scripts/deploy-relay.sh
```

**How to check status:**

```bash
patchwork relay status
```

```
Relay daemon:     RUNNING (pid 12345)
Uptime:           2d 14h 32m
Events relayed:   1,847
Chain tip:        sha256:8f14e45f...
Last heartbeat:   3s ago
Auto-seal:        enabled (every 15m)
```

**Architecture:** The relay listens on a Unix socket at `/Library/Patchwork/relay.sock`. User-space hooks send events via fire-and-forget writes — no blocking, no slowdown. The relay maintains its own log at `/Library/Patchwork/events.relay.jsonl`.

## Layer 3: Heartbeat Protocol

**What it does:** The relay emits a heartbeat event every 30 seconds. If the relay is killed or crashes, the gap in heartbeats is visible in the log.

**What it protects against:** Silent disabling of the relay. If someone stops the daemon to tamper with logs, the missing heartbeats serve as evidence of the gap.

**How to verify:** Heartbeat gaps are surfaced by `patchwork verify` and in the compliance report.

## Layer 4: Auto-Seal with HMAC Signatures

**What it does:** Every 15 minutes, the relay computes an HMAC-SHA256 seal over the current chain tip. This seal is a cryptographic snapshot: "at this time, the chain had this many events and this tip hash."

**What it protects against:** Retroactive tampering. Even if someone modifies the log after the fact, the seal won't match. Seals are published to [witness endpoints](/concepts/seals-and-witnesses) for independent verification.

**Seal format:**

```
patchwork-seal:v1:{tipHash}:{chainedEvents}:{sealedAt}
```

**Where seals are stored:**
- User seals: `~/.patchwork/seals.jsonl`
- Relay seals: `/Library/Patchwork/seals.relay.jsonl`

**How to manually seal:**

```bash
patchwork seal
```

## Layer 5: Key Hardening & Signing Proxy

**What it does:** The HMAC signing key is stored in a root-owned keyring at `/Library/Patchwork/keys/seal/`. User-space code never touches the raw key material — instead, it sends signing requests to the relay daemon via the Unix socket.

**What it protects against:** Key theft. If an attacker compromises the user account, they can't extract the signing key to forge seals. The key is only accessible to the root-owned relay process.

**Features:**
- Key rotation: `rotateKey()` generates a new key while preserving old keys for verification
- Key IDs: each seal records which key signed it, supporting key lifecycle management
- Fallback: if the relay is unavailable, Patchwork falls back to user-owned keys (less secure but functional)

## Layer Summary

| Layer | Protects Against | Requires |
|-------|-----------------|----------|
| 1. Hash chain | Event tampering | Nothing (always on) |
| 2. Root relay | Log deletion by non-root users | `sudo` for setup |
| 3. Heartbeat | Silent relay disabling | Layer 2 |
| 4. HMAC seals | Retroactive log modification | Layer 2 |
| 5. Key hardening | Signing key theft | Layer 2 |

## What an Attacker Would Need

To fully compromise a Patchwork audit trail with all 5 layers, an attacker would need:

1. **Root access** to the machine (to modify relay logs and keys)
2. **Access to all witness servers** (to delete external seal records)
3. **The ability to rewrite history** consistently across user logs, relay logs, seals, and witnesses

This is the same security model as enterprise SIEM systems and financial audit trails — no single point of compromise.

## Next Steps

- [Seals & Witnesses](/concepts/seals-and-witnesses) — external verification of seal integrity
- [Security Architecture](/security/architecture) — detailed technical deep-dive
