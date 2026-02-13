# Patchwork Security Review (Current State)

Last updated: 2026-02-12
Scope: `packages/core`, `packages/agents`, `packages/cli`

## 1. Executive Summary

Patchwork is no longer in the "aspirational strategy" stage. Core security controls that were previously missing are now implemented:

- Runtime schema validation on write/read paths
- Event idempotency and JSONL dedup
- JSONL locking and stale-lock recovery
- Tamper-evident hash chaining (`prev_hash` + `event_hash`)
- HMAC sealing and CLI verification workflows
- Versioned seal keyring with key IDs and key rotation
- Privacy-safe defaults for path handling, command redaction, and prompt-size capture

Remaining reality: this is still an audit/observability system, not a hard policy enforcement boundary. Hook timeout behavior and local-key trust are still the main architectural constraints.

## 2. Risk Register (Current)

### R1. Tamper evidence and integrity
Status: Substantially mitigated
Current severity: Low–Medium

What is implemented:
- Event-level hash chain fields in schema (`prev_hash`, `event_hash`)
- Deterministic hashing and chain verification
- HMAC seal key management and signature verification
- Key IDs and key rotation in a local keyring model
- CLI verification with seal policy options
- Remote witness anchoring (`patchwork witness publish`) with quorum enforcement
- Witness records validated with strict ISO datetime schema
- Deterministic witness payloads (no implicit timestamps)
- Advisory-locked witness file append (O_EXCL + stale reclamation)
- CI attestation artifact (`patchwork attest`) for durable machine-readable evidence
- Attestation artifacts HMAC-signed using seal key/keyring (same trust model as seals)
- Deterministic canonical payload with SHA-256 hash for tamper detection
- Constant-time signature verification (timing-safe comparison)
- Attestation history mode with bounded retention pruning
- Dynamic tool version from `package.json` (no hardcoded strings)
- Attestation verification in `patchwork verify` — hash integrity, signature check, freshness enforcement
- Recursive canonical payload determinism (all nested levels, not just top-level keys)
- Strict `--max-history-files` validation with early exit on invalid input
- Always-on tamper detection: hash mismatch fails attestation check unconditionally (no flag needed)
- Always-on signature enforcement: signed-but-invalid attestations fail unconditionally (consistent with seal check)
- `--strict-attestation-file` enforces attestation `pass=true` (not just structural validity)
- Attestation artifacts include signed binding fields (`chain_tip_hash`, `chain_chained_events`, `seal_tip_hash`, `witness_latest_matching_tip_hash`)
- `patchwork verify` compares binding fields against current chain/seal/witness state, preventing replay of stale attestations
- Seal/witness binding fields only compared when those checks are active (skipped checks are not falsely enforced)
- Legacy attestations without binding fields pass vacuously (backward compatible)

Residual risk:
- Seals are local-key based; an attacker with both key and data can forge
- Seal records are not chained to each other
- Legacy seals without `key_id` require legacy key fallback
- Witness endpoints are trusted to return honest `anchor_id` and `witnessed_at`
- Attestation signing and verification use the same local-key trust model as seals
- Attestation `pass` field reflects the generator's assessment; use `--strict-attestation-file` to enforce `pass=true`
- Binding field comparison is skipped for seal/witness when those checks are not active in the current verify run

Evidence:
- `packages/core/src/schema/event.ts`
- `packages/core/src/hash/chain.ts`
- `packages/core/src/hash/seal.ts`
- `packages/core/src/hash/witness.ts`
- `packages/cli/src/commands/seal.ts`
- `packages/cli/src/verify-engine.ts`
- `packages/cli/src/commands/verify.ts`
- `packages/cli/src/commands/witness.ts`
- `packages/cli/src/commands/attest.ts`
- `packages/core/src/hash/attestation.ts`
- `packages/cli/src/version.ts`

### R2. File and directory permissions
Status: Mostly mitigated
Current severity: Medium

What is implemented:
- `0700`/`0600` creation and reconciliation for JSONL, SQLite DB, seal key, seal file, witness file, and attestation artifact paths

Residual risk:
- SQLite `-wal`/`-shm` permission hardening remains platform/engine-dependent
- Windows ACL parity is not fully covered by Unix-mode checks

Evidence:
- `packages/core/src/store/jsonl.ts`
- `packages/core/src/store/sqlite.ts`
- `packages/core/src/hash/seal.ts`
- `packages/cli/src/commands/seal.ts`
- `packages/cli/src/commands/witness.ts`
- `packages/cli/src/commands/attest.ts`
- `packages/cli/src/verify-engine.ts`

### R3. Runtime schema enforcement
Status: Mitigated
Current severity: Low

What is implemented:
- Zod `safeParse` validation on append and read paths
- Invalid/corrupt records are rejected on write or skipped/count-tracked on read
- `schema_version` now constrained to literal `1` (or undefined for legacy)

Residual risk:
- `raw_input`/`raw_output` are still structurally permissive if enabled in future

Evidence:
- `packages/core/src/schema/event.ts`
- `packages/core/src/store/jsonl.ts`
- `packages/core/src/store/sqlite.ts`

### R4. Dual-write divergence (JSONL primary + SQLite secondary)
Status: Partially mitigated
Current severity: Medium

What is implemented:
- Secondary SQLite failures are now surfaced to stderr with an error counter
- Durable divergence marker persisted on SQLite secondary write failures
- `sync db-status` exposes divergence state for operators/CI
- `sync db` warns when divergence exists and clears marker after rebuild flow
- `sync db` now captures per-event append failure diagnostics (event id/timestamp/action/error class)
- `sync db` persists a structured last-failure report (`sync-db-last-failures.json`) and clears stale reports on full success
- Primary JSONL write still succeeds if SQLite is unavailable

Residual risk:
- Divergence is still possible under SQLite failure/lock pressure
- Reconciliation is still operational/manual rather than transactional
- Sync failure report is best-effort and can be lost if state path is not writable
- Report currently stores only the latest failed run (no rotation/history)

Evidence:
- `packages/agents/src/claude-code/adapter.ts`
- `packages/cli/src/commands/sync.ts`
- `packages/cli/src/store.ts`

### R5. Idempotency and duplicate event handling
Status: Partially mitigated
Current severity: Medium

What is implemented:
- Stable `idempotency_key` generation for session lifecycle and tool events with `tool_use_id`
- Dedup check performed inside JSONL lock critical section

Residual risk:
- Events without a stable unique signal (`UserPromptSubmit`, subagent events) may still duplicate on retries

Evidence:
- `packages/agents/src/claude-code/adapter.ts`
- `packages/core/src/store/jsonl.ts`
- `packages/core/src/schema/event.ts`

### R6. Privacy defaults and sensitive data exposure
Status: Partially mitigated
Current severity: Medium

What is implemented:
- Relative path storage when under `cwd`
- `abs_path` stripped by default; opt-in via env flag
- Prompt `size_bytes` capture now opt-in
- Command-string secret redaction for common token/flag/header patterns

Residual risk:
- Redaction is regex-based and cannot guarantee coverage of all secret forms
- `project.root` remains absolute
- No full retention/deletion policy lifecycle yet

Evidence:
- `packages/agents/src/claude-code/adapter.ts`
- `packages/core/src/schema/event.ts`

### R7. Policy regex ReDoS
Status: Partially mitigated
Current severity: Low

What is implemented:
- Regex safety checks for length, backreferences, lookbehind, and nested quantifier patterns before evaluation

Residual risk:
- Custom guard is heuristic, not a formally safe regex engine
- Runtime cost of accepted regex still depends on JS regex engine behavior

Evidence:
- `packages/core/src/policy/engine.ts`
- `packages/core/tests/policy/engine.test.ts`

### R8. JSONL concurrency between sessions/processes
Status: Mitigated (single-host advisory model)
Current severity: Low

What is implemented:
- Lock-file protocol with `O_EXCL` acquisition
- Stale-lock detection with metadata, PID liveness checks, and ownership-safe unlock
- Deterministic race tests and multi-process contention tests

Residual risk:
- Advisory lock model can still be bypassed by non-cooperating writers
- Blocking sleep loop is synchronous

Evidence:
- `packages/core/src/store/jsonl.ts`
- `packages/core/tests/store/jsonl.test.ts`
- `packages/cli/tests/commands/seal.test.ts`

### R9. Hook timeout allow-by-default behavior
Status: Partially mitigated
Current severity: Medium

Current state:
- PreToolUse timeout increased to 1500ms
- Optional fail-closed mode exists for PreToolUse parse/handler errors (`PATCHWORK_PRETOOL_FAIL_CLOSED=1`)
- PreToolUse latency warning exists (`PATCHWORK_PRETOOL_WARN_MS`, default 800ms)
- `patchwork init claude-code` now supports install-time options for both controls (`--pretool-fail-closed`, `--pretool-warn-ms`)
- Explicit policy mode is supported at install time (`--policy-mode audit|fail-closed`)
- Structured PreToolUse telemetry JSON is supported (`PATCHWORK_PRETOOL_TELEMETRY_JSON=1` / `--pretool-telemetry-json`)
- Telemetry sink routing is supported (`PATCHWORK_PRETOOL_TELEMETRY_DEST=stderr|file|both`, optional `PATCHWORK_PRETOOL_TELEMETRY_FILE`)
- Telemetry file rotation controls are supported (`PATCHWORK_PRETOOL_TELEMETRY_MAX_BYTES`, `PATCHWORK_PRETOOL_TELEMETRY_MAX_FILES`)
- Strict install profile is supported (`--strict-profile`: fail-closed + telemetry + 500ms warn by default)

Why this remains important:
- Default behavior is still fail-open unless fail-closed mode is explicitly chosen
- Process-level timeouts/crashes still rely on host behavior and are not fully controlled by Patchwork
- Telemetry rotation path is lock-protected, but the common no-rotation append path remains lock-free and can still race under high concurrency
- Rotations use rename chains (not transactional), so abrupt interruption can leave transient gaps

Evidence:
- `packages/cli/src/commands/hook.ts`
- `packages/agents/src/claude-code/installer.ts`
- `packages/cli/src/commands/init.ts`
- `packages/cli/src/store.ts`
- `packages/cli/tests/commands/hook.test.ts`

### R10. JSONL scaling (`readAll()` and dedup scans)
Status: Partially mitigated
Current severity: Low

Current state:
- Append-path keyed dedup now uses an in-memory idempotency index with mtime-based reconciliation
- Full-file parsing is no longer required on every keyed append in steady state
- `readAll()`/query-style read paths still parse the full file

Impact:
- Read-heavy CLI operations can still slow as logs grow
- Cross-process cache coherence depends on mtime resolution

Evidence:
- `packages/core/src/store/jsonl.ts`

## 3. Professional Positioning (What This Is / Is Not)

What it is:
- A local-first, tamper-evident audit trail with practical privacy defaults and strong test coverage.

What it is not yet:
- A guaranteed policy enforcement boundary under process timeout/failure
- A long-retention, large-scale event warehouse

## 4. Recommended Next Work (Priority Order)

1. Enforcement semantics hardening
- Extend telemetry lock coverage to non-rotation append path (or move to atomic append strategy) for high-concurrency runs
- Consider promoting strict-profile semantics into installer API for non-CLI callers

2. Dual-write consistency hardening
- Add report history/rotation strategy for `sync-db-last-failures.json`
- Consider optional retry/backoff policy for transient SQLite failures during `sync db`

3. Seal trust model hardening
- Add seal-to-seal chaining or checkpointing strategy for stronger timeline integrity
- Consider KMS-backed signer for high-assurance environments

4. Privacy lifecycle completeness
- Add retention policy and purge command
- Expand secret redaction coverage beyond known flag/header patterns

## 5. Definition of "Up to Date" for This File

This document should be updated whenever any of the following changes:

- Schema fields related to integrity or privacy
- Locking, dedup, or storage consistency behavior
- Seal/verify CLI policy semantics
- Hook timeout behavior or enforcement claims

If those areas change, update risk statuses first, then adjust recommendations.
