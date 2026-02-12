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
- Privacy-safe defaults for path handling, command redaction, and prompt-size capture

Remaining reality: this is still an audit/observability system, not a hard policy enforcement boundary. Hook timeout behavior and local-key trust are still the main architectural constraints.

## 2. Risk Register (Current)

### R1. Tamper evidence and integrity
Status: Partially mitigated
Current severity: High

What is implemented:
- Event-level hash chain fields in schema (`prev_hash`, `event_hash`)
- Deterministic hashing and chain verification
- HMAC seal key management and signature verification
- CLI verification with seal policy options

Residual risk:
- Seals are local-key based; an attacker with both key and data can forge
- No remote witness / transparency log anchoring
- No key rotation model

Evidence:
- `packages/core/src/schema/event.ts`
- `packages/core/src/hash/chain.ts`
- `packages/core/src/hash/seal.ts`
- `packages/cli/src/commands/seal.ts`
- `packages/cli/src/commands/verify.ts`

### R2. File and directory permissions
Status: Mostly mitigated
Current severity: Medium

What is implemented:
- `0700`/`0600` creation and reconciliation for JSONL, SQLite DB, seal key, and seal file paths

Residual risk:
- SQLite `-wal`/`-shm` permission hardening remains platform/engine-dependent
- Windows ACL parity is not fully covered by Unix-mode checks

Evidence:
- `packages/core/src/store/jsonl.ts`
- `packages/core/src/store/sqlite.ts`
- `packages/core/src/hash/seal.ts`
- `packages/cli/src/commands/seal.ts`
- `packages/cli/src/commands/verify.ts`

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
- Primary JSONL write still succeeds if SQLite is unavailable

Residual risk:
- Divergence is still possible under SQLite failure/lock pressure
- Reconciliation is still operational/manual rather than transactional

Evidence:
- `packages/agents/src/claude-code/adapter.ts`

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
Status: Open
Current severity: High

Current state:
- Hook timeouts remain in installer configuration (`PreToolUse` 1000ms)
- If hook execution is delayed or terminated, enforcement guarantees are limited by host behavior

Why this remains important:
- Policy is best-effort unless execution semantics are made fail-closed by architecture

Evidence:
- `packages/agents/src/claude-code/installer.ts`

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
- A cryptographically anchored global attestation system
- A guaranteed policy enforcement boundary under process timeout/failure
- A long-retention, large-scale event warehouse

## 4. Recommended Next Work (Priority Order)

1. Enforcement semantics hardening
- Define explicit product mode: `audit-only` vs `best-effort enforcement`
- Add runtime surfacing when hook execution exceeds policy-safe thresholds

2. Seal trust model hardening
- Add key IDs + rotation support
- Add optional external witness anchoring for tip hashes (CI artifact, transparency log, or KMS-backed signer)

3. JSONL performance path
- Add incremental idempotency index or bounded in-memory cache
- Add streaming read mode for large files

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
