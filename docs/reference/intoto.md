# in-toto / DSSE Attestations

Patchwork can emit each commit attestation as an [in-toto Statement v1](https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md) wrapped in a [DSSE envelope](https://github.com/secure-systems-lab/dsse/blob/master/envelope.md), in addition to the bespoke Patchwork-format attestation.

The two paths run in parallel — the bespoke attestation, git note (`refs/notes/patchwork`), JSON file at `~/.patchwork/commit-attestations/<sha>.json`, dashboard `/attestations` page, and `patchwork commit-attest` CLI all keep working unchanged. The in-toto envelope is purely additive.

## Why two formats?

The bespoke format is what powers the `commit-attest` CLI and `/attestations` dashboard. It's tuned for human-readable inspection and Patchwork's own verification path.

The in-toto/DSSE format is what the rest of the supply-chain world recognises — SLSA, Sigstore Rekor, in-toto verifiers, GitHub's attestation tooling. Emitting both means a Patchwork attestation slots into supply-chain pipelines without the consumer needing to know about Patchwork's own schema.

## Enabling

Opt-in via environment variable on the PostToolUse hook command. In `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "PATCHWORK_INTOTO=1 PATCHWORK_PRETOOL_FAIL_CLOSED=1 /path/to/node /path/to/patchwork hook post-tool"
      }]
    }]
  }
}
```

Default is **off** in v0.6.9 while the format stabilises.

## What gets emitted

For each successful `git commit`, alongside the existing Patchwork attestation:

- `~/.patchwork/commit-attestations/<sha>.intoto.json` — the DSSE envelope
- Git note attached under `refs/notes/patchwork-intoto` — the same envelope as JSON

## Statement structure

```json
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [{
    "name": "git+main:abc123…",
    "digest": { "gitCommit": "abc123…" }
  }],
  "predicateType": "https://patchwork-audit.dev/ai-agent-session/v1",
  "predicate": {
    "schema_version": 1,
    "generated_at": "2026-04-28T15:00:00.000Z",
    "tool_version": "0.6.9",
    "session_id": "01HX…",
    "session_events_count": 12,
    "session_events_since_last_commit": 4,
    "chain_tip_hash": "sha256:…",
    "chain_valid": true,
    "chain_chained_events": 12,
    "risk_summary": { "critical": 0, "high": 0, "medium": 1, "low": 3, "none": 8, "denials": 0 },
    "policy_source": "/repo/.patchwork/policy.yml",
    "pass": true,
    "failure_reasons": []
  }
}
```

The git binding (commit_sha, branch) lives on `subject` per in-toto convention. Signing fields (signature, payload_hash, key_id) move to the DSSE envelope and are absent from the predicate.

## DSSE envelope

```json
{
  "payloadType": "application/vnd.in-toto+json",
  "payload": "<base64 of canonical Statement JSON>",
  "signatures": [
    { "keyid": "<patchwork-keyid>", "sig": "<base64 of HMAC-SHA256 over PAE>" }
  ]
}
```

The signed value is the DSSE [Pre-Authentication Encoding](https://github.com/secure-systems-lab/dsse/blob/master/protocol.md):

```
"DSSEv1" SP LEN(payloadType) SP payloadType SP LEN(payload) SP payload
```

with byte-length counts (not codepoint counts) and raw payload bytes (not base64). Verifiers MUST recompute the PAE from the envelope's `payloadType` and base64-decoded `payload` before verifying — never sign or verify the Statement bytes directly.

## Inspecting

```bash
# Human-readable summary of the envelope
patchwork commit-attest <sha> --intoto

# Verify the signature
patchwork commit-attest <sha> --intoto-verify

# Full JSON dump (envelope + decoded statement + digest)
patchwork commit-attest <sha> --intoto --json
```

## Verifying outside Patchwork

The envelope is signed with HMAC-SHA256, which is symmetric and so unsuitable for third-party verification by itself. Treat the in-toto envelope produced by v0.6.9 as a **format-compatible bridge** — third-party verifiers can parse the Statement structure and use the predicate fields, but cryptographic verification still needs Patchwork's keyring.

A future release will switch the signing path to ed25519 (or Sigstore keyless via Rekor), at which point any DSSE verifier (`cosign verify-blob`, `slsa-verifier`, etc.) will accept the envelope.

## Predicate type

Patchwork uses the namespaced URL `https://patchwork-audit.dev/ai-agent-session/v1`. This is **not** a SLSA-defined predicate (and shouldn't claim a SLSA slot — it describes an AI agent session, not a build). It's a project-specific predicate with a stable URL identifier.

If a SLSA-for-AI-agents predicate is later standardised by OpenSSF / in-toto, Patchwork will likely emit both during a transition.

## Stability

The Statement format is **stable** in v0.6.9 — the predicate's schema mirrors `CommitAttestationSchema.predicate_fields` and is versioned via `schema_version: 1`. Adding fields is a minor bump; renaming or removing fields is a major bump.

The signing primitive (HMAC-SHA256) is **expected to change** in a future release without breaking the envelope structure — only the signature bytes and `keyid` semantics will change.
