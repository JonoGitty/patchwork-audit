# patchwork-audit

## 0.6.9

### Patch Changes

- ## Why this release

  A competitive scan in late April 2026 surfaced 3-4 OSS projects (InALign, Asqav, Nobulex, Luke Hinds' `nono`) that ship hash-chained tamper-evident audit logs for AI agents — the core idea Patchwork pioneered is now table stakes. At the same time, GitHub Copilot Enterprise went GA with full agent audit logs (Feb 2026) and now signs every cloud-agent commit (Apr 2026), which closes a chunk of Patchwork's value proposition for Copilot users specifically.

  The competitive durability isn't in **whether** Patchwork records sessions — that's a commodity now. It's in **what format** it produces. Vendor audit logs will not converge on Patchwork's bespoke schema; they will converge on the SLSA / in-toto / Sigstore standards lineage that the wider supply-chain world already uses. v0.6.9 starts emitting attestations in that format so a Patchwork-attested commit drops into supply-chain pipelines as a recognisable [in-toto Statement v1](https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md) inside a [DSSE envelope](https://github.com/secure-systems-lab/dsse/blob/master/envelope.md), with a stable predicate type at `https://patchwork-audit.dev/ai-agent-session/v1`.

  This is purely additive — no existing path changes. Existing CLI, dashboard, git notes (`refs/notes/patchwork`), JSON files at `~/.patchwork/commit-attestations/*.json`, the Compliance API, and the bespoke `--verify` path all behave exactly as in v0.6.8.

  ## What ships

  - **In-toto / DSSE attestations (opt-in)** — set `PATCHWORK_INTOTO=1` on the PostToolUse hook command and Patchwork dual-emits each commit attestation as a DSSE envelope (`<sha>.intoto.json` on disk, `refs/notes/patchwork-intoto` git note). The envelope's PAE is signed with the same key path as the bespoke attestation (relay proxy with local-keyring fallback), so verification stays consistent across formats.
  - **CLI inspectors** — `patchwork commit-attest <sha> --intoto` shows the envelope; `--intoto-verify` validates the DSSE signature; `--json` dumps envelope + decoded statement + digest for tooling.
  - **Root-commit fix** — `extractCommitInfo`'s regex couldn't parse git's root-commit output `[main (root-commit) abc1234]`, silently skipping attestation on the first commit in any repo. Also broke on detached-HEAD output `[detached HEAD abc1234]`. Fixed and tested across all three forms.

  ## What does NOT change

  - Bespoke attestation format and schema
  - `commit-attest --list`, `--failures`, `--verify`, `--show <sha>` output
  - `/attestations` dashboard page
  - Existing git notes under `refs/notes/patchwork`
  - Default behaviour: in-toto emission is **off** unless `PATCHWORK_INTOTO=1` is set

  Tests: 921/921 (290 CLI / 148 agents / 372 core / 99 team / 12 web).

## 0.6.8

### Patch Changes

- Two real bug fixes that ship to npm via the bundled CLI:

  - **fix(installer): collapse duplicate patchwork hook entries.** Two
    installer paths could both write hook entries — the canonical TS
    `installClaudeCodeHooks` and the multi-user Python patcher in
    `scripts/_lib.sh:install_user_hooks`. Their dedupe logic disagreed,
    so when both ran (e.g. `patchwork init` followed by
    `system-install.sh`) every PostToolUse event ended up with TWO
    patchwork entries — one for `hook-wrapper.sh`, one for direct-node
    — and both fired on every commit. Fix: broaden the patchwork-hook
    regex to match `hook-wrapper.{sh,cmd,bat,ps1}` and `guard.sh` in
    addition to `patchwork ... hook ...`, and replace `findIndex+replace`
    with `filter+append` so multiple existing entries collapse to a
    single canonical entry. The Python patcher gets matching dedupe at
    the nested-format level. Three new regression tests cover the
    collapse, non-patchwork hook preservation, and hook-wrapper/guard.sh
    recognition.

  - **fix(risk): downgrade curl/wget to medium when target is loopback
    only.** The risk classifier marked any command starting with `curl `
    or `wget ` as critical, which under a `max_risk: high` policy meant
    blanket-blocked. Reasonable for unknown internet targets but it also
    denied legitimate self-introspection: `curl http://localhost:3000`,
    hitting an internal devtool on `127.0.0.1`, etc. Now: when the URL
    resolves entirely to loopback (`localhost`, `127.0.0.1`, `::1`), the
    risk is downgraded to medium and tagged `loopback_target`. Mixed
    targets like `curl http://localhost/x https://attacker.com/y` stay
    critical (conservative). 5 new tests cover localhost / 127.0.0.1 /
    IPv6 / wget / mixed-URL.

  Internal hygiene that doesn't ship to npm but is included in the
  release commit:

  - `refactor(install)`: align canonical multi-user installer with the
    deployed v2 hash-baseline model (settings.json stays user-owned;
    tamper detection via SHA-256 baseline). The v1 immutable-lock model
    in `system-install.sh` was out of date with deployed reality.
  - `fix(dashboard)`: launcher script prefers the bundled CLI over
    `npx tsx`, so the dashboard LaunchAgent restarts cleanly under
    launchd's restricted env.
  - `chore`: TEST_LOG.md no longer auto-appends on every push (gated
    behind `WRITE_TEST_LOG=1` for explicit release-time runs); doctor's
    Guard staleness threshold raised to 8h with clearer wording; CI
    workflows opt into Node 24 ahead of the GitHub 2026-09-16 deadline.

  Tests: 895/895 across the project (290 CLI / 140 agents / 354 core /
  99 team / 12 web).

## 0.6.7

### Patch Changes

- 2a2c618: Surface commit-attestation observability that v0.6.6 silently lost.

  - **fix(cli):** `patchwork doctor` now reads the nested Claude Code hook
    format (`hooks.PreToolUse[0].hooks[0].command`). Previously it read the
    flat path, found nothing, and falsely warned "Fail-closed mode NOT
    enabled" while silently skipping the architecture and executable
    checks. Also recognises `hook-wrapper.{sh,cmd,bat,ps1}` and quoted
    `/node` paths as architecture-safe.
  - **fix(agents):** the PostToolUse commit-attestation handler had an
    empty `catch{}` that swallowed every signing/store/relay error. A real
    gap from 2026-04-22 to 2026-04-27 produced zero attestations across
    multiple repos with no error surfaced. Failures now append to
    `~/.patchwork/commit-attestations/_failures.jsonl` with stage,
    commit_sha, branch, session_id, message, and stack — and a stderr line
    on generate-stage failures.
  - **feat(cli):** `patchwork commit-attest --failures` (and `--failures
--json`) inspects the new failure log.
  - **feat(web):** new `/attestations` page in the web dashboard with
    pass/fail stat cards, 30-day stacked timeline, top-branch list,
    recent attestations table, and recent failures table.

## 0.6.6

### Patch Changes

- Fix two runtime bugs in commit attestation that survived v0.6.5.

  **1. `tool_version` was always `"unknown"` in production.**
  The `getAgentVersion()` helper in the Claude Code adapter used `require("node:module")`, which tsup compiled into its `__require` shim. In the ESM runtime that shim throws (`Dynamic require of "module" is not supported`) and the fallback returns `"unknown"`. The fix is a static `import { createRequire } from "node:module"` at the top of the module — tsup preserves it, it works at runtime. Verified against the bundled `agents/dist/index.js`.

  **2. `chain_valid` was always `false` when sessions ran concurrently.**
  The commit-attestor called `verifyChain()` on the events of one session. But session events are a _filter_ over the global append-only chain; events from other sessions are interleaved between them, so each session event's `prev_hash` points at an event NOT in the filtered slice. `verifyChain` correctly reports this as a link mismatch, producing a false positive for "chain integrity failure" on every concurrent-session attestation.

  Added a new `verifyEventHashes()` function in `@patchwork/core` that checks per-event hash integrity without requiring prev_hash continuity between events — the correct check for a filtered subset. The commit-attestor now uses it. Tampering is still caught (if any event's stored hash doesn't match the recomputed hash of its content, `chain_valid` is false); healthy concurrent-session logs pass.

  **API additions (backward compatible)**

  - `verifyEventHashes()`, `EventIntegrityResult` exported from `@patchwork/core`.

  **Tests**: 883 passing (up from 878); 5 new covering both fixes.

## 0.6.5

### Patch Changes

- Fix commit attestation: signature verification, chain integrity, denial semantics, and seal tip matching.

  Four bugs combined to make every commit attestation ship as FAIL with a broken signature. All four are fixed in this release.

  **1. Signature verification was impossible for relay-signed attestations.**
  Attestations signed by the root-owned relay daemon stored a `key_id` that the user-level CLI could not resolve (the private key lives in the root-owned keyring at `/Library/Patchwork/keys/`). `patchwork commit-attest <sha> --verify` always reported "signature verification failed". Added a `verify` message type to the relay protocol and a new `requestVerification()` helper that tries the local keyring first, then asks the relay daemon to verify with its root-owned key. Verification now reports the source (`relay` or `local`).

  **2. `tool_version` was always `"unknown"`.**
  `getAgentVersion()` in the Claude Code adapter resolved `../../package.json` relative to the bundled `dist/index.js`, which pointed one directory too high. Fixed to probe the correct relative paths with a package-name sanity check.

  **3. Hash chain was perpetually marked corrupt at event index 0.**
  `verifyChain()` treated a non-null `prev_hash` on the first chained event as a broken link. In reality, when `events.jsonl` is rotated or the chain resumes from an earlier run, the first event legitimately references an earlier tip. Added a `chain_anchor_hash` field to `ChainVerification`; the first chained event establishes the anchor instead of triggering a mismatch. Continuity with earlier logs is proved by seal history, not by forcing a genesis-rooted log.

  **4. Denial semantics produced 100% FAIL attestations.**
  Any `status: denied` event anywhere in the session caused FAIL, meaning every attestation failed _because the policy was working correctly_. Replaced with `denials_high_risk_since_last_commit`: only `critical` or `high` risk denials in the window since the last commit cause FAIL. Low/medium denials are now recorded but informational — they represent expected policy enforcement, not a broken commit. The `policy_denials_present` failure reason is renamed to `high_risk_denials_since_last_commit`.

  **5. Seal tip matching required an exact tip match.**
  A seal was only reported valid when `current_tip === sealed_tip`, so any event appended after a seal caused `patchwork verify` to FAIL until the next auto-seal cycle. Seals are now validated by checking whether the sealed tip hash appears anywhere in the chain: if it does, the seal remains valid point-in-time evidence; only a truncated or rewritten chain (where the sealed tip is gone) fails the tip match. Added `events_since_seal` to the seal check result so operators can see how far the chain has grown since sealing.

  ### Attestation coverage caveat (documented, unchanged)

  Attestation only fires inside the PostToolUse hook, so commits made outside Claude Code (plain terminal, IDE built-in git, un-hooked agents) are not attested. Full coverage requires routing all commits through an instrumented agent or enforcing it with a pre-receive/CI gate.

  ### API additions (backward compatible)

  - `requestVerification()`, `VerifyResult`, `VerifyRequest`, `VerifyResponse` exported from `@patchwork/core`
  - `"verify"` message type added to the relay protocol
  - Optional `chain_anchor_hash` on `ChainVerification`
  - Optional `denials_high_risk_since_last_commit` on `RiskSummary`
  - Optional `events_since_seal` on `SealCheckResult`
