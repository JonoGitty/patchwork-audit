# Seals & Witnesses

Seals and witnesses provide cryptographic proof that your audit trail existed in a specific state at a specific time — and that no one has altered it since.

## What is a Seal?

A **seal** is an HMAC-SHA256 signature over the current state of the hash chain. It captures three things:

1. **The chain tip** — the hash of the most recent event
2. **The event count** — how many events are in the chain
3. **The timestamp** — when the seal was created

```
patchwork-seal:v1:sha256:8f14e45f...:1847:2026-04-05T14:30:00.000Z
                  ▲                    ▲    ▲
                  chain tip            count timestamp
```

This payload is then signed with HMAC-SHA256 using the seal key. The result is a compact proof: "at this time, the audit trail had exactly this state."

**Auto-sealing:** The relay daemon seals automatically every 15 minutes. You can also seal manually:

```bash
patchwork seal
```

## What is a Witness?

A **witness** is an independent third party that records your seal. When a seal is published to a witness, the witness stores it and returns a receipt. Now there are two independent copies of the proof — yours and the witness's.

This is the same principle as **Certificate Transparency** in TLS: independent logs that anyone can audit.

### Why Witnesses Matter

Without witnesses, seals are self-attested — you signed them, so you could theoretically forge them. With witnesses:

- A **third party** independently confirms the seal existed at a specific time
- The seal can be **verified by anyone** who can query the witness
- **Tampering requires compromising** both your system and all witnesses
- **Regulatory auditors** get independent proof, not just your word

### Trust Through Redundancy

Patchwork supports a **quorum model** — configure multiple witnesses and require a minimum number to confirm:

```json
{
  "witness": {
    "enabled": true,
    "quorum": 2,
    "endpoints": [
      {
        "url": "https://witness1.example.com/api/v1/anchor",
        "name": "Primary Witness"
      },
      {
        "url": "https://witness2.example.com/api/v1/anchor",
        "name": "Backup Witness"
      },
      {
        "url": "https://witness3.example.com/api/v1/anchor",
        "name": "Third-Party Witness",
        "auth_token": "your-api-key"
      }
    ]
  }
}
```

With quorum set to 2 of 3, compromising any single witness is not enough to forge a seal.

## Witness Protocol

The protocol is simple and open — any HTTP server that implements it is a valid witness.

### Publishing a Seal

Patchwork sends a POST request to the witness:

```http
POST /api/v1/anchor
Content-Type: application/json

{
  "protocol": "patchwork-witness-v1",
  "tip_hash": "sha256:8f14e45f...",
  "chained_events": 1847,
  "seal_signature": "hmac-sha256:3b2c1a...",
  "key_id": "a1b2c3d4e5f6g7h8",
  "requested_at": "2026-04-05T14:30:00.000Z"
}
```

The witness stores this and returns:

```json
{
  "anchor_id": "wit_9f8e7d6c",
  "witnessed_at": "2026-04-05T14:30:01.123Z"
}
```

### Verifying a Seal

To verify, query the witness with the anchor ID:

```http
GET /api/v1/anchors/wit_9f8e7d6c
```

The witness returns the original anchor data, confirming it was recorded at the claimed time.

### Running a Witness Server

The witness protocol is intentionally simple so anyone can run their own. A minimal implementation is:

1. **POST `/api/v1/anchor`** — validate the payload, store it in an append-only log, return an `anchor_id`
2. **GET `/api/v1/anchors/:id`** — look up and return the stored anchor
3. **GET `/api/v1/health`** — return status and total anchor count

A reference witness server implementation is planned. In the meantime, any HTTP server that implements these three endpoints is a valid witness.

## Configuring Witnesses

### Via Relay Config

Edit `/Library/Patchwork/relay-config.json`:

```json
{
  "auto_seal": {
    "enabled": true,
    "interval_minutes": 15
  },
  "witness": {
    "enabled": true,
    "quorum": 1,
    "endpoints": [
      {
        "url": "https://your-witness.example.com/api/v1/anchor",
        "name": "My Witness"
      }
    ]
  }
}
```

Then restart the relay:

```bash
patchwork relay restart
```

### Manual Publishing

You can also publish seals manually from the CLI:

```bash
patchwork witness publish \
  --witness-url https://witness.example.com \
  --quorum 1
```

### Verifying Witnesses

Check that your seals have been correctly witnessed:

```bash
patchwork witness verify --quorum 1
```

This contacts each witness, verifies the stored anchor matches your local seal, and reports the result.

## Witness Backends

| Backend | Description | Best for |
|---------|-------------|----------|
| **Patchwork Witness Server** | Reference HTTP implementation | Most users |
| **GitHub Transparency Log** | Seal anchors as git commits in a public repo | Open-source projects |
| **Self-hosted** | Run the reference server on your own infrastructure | Enterprise |

## How Seals Fit Into Compliance

When you generate a compliance report, Patchwork includes seal and witness status:

- **Seal coverage** — what percentage of the audit period is covered by seals
- **Witness confirmation** — whether seals were independently witnessed
- **Chain integrity** — whether the hash chain is unbroken from first event to latest seal

This gives auditors cryptographic evidence that the audit trail is complete and unaltered — not just a log file that could have been edited.

## Next Steps

- [Tamper-Proof Layers](/concepts/tamper-proof-layers) — how seals fit into the 5-layer architecture
- [Compliance](/concepts/compliance) — how Patchwork maps to regulatory frameworks
- [Relay Protocol](/reference/relay-protocol) — technical details of the relay and seal system
