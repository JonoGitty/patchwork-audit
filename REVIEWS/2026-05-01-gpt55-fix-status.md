# GPT-5.5 Audit — Fix Status

Branch: `security/gpt55-audit-fixes-2026-05-01`
Last updated: 2026-05-01
Tests: 933 passing · Build: clean
Target release: v0.6.10 (fixed group only — `@patchwork/team` stays on its alpha track)

## Headline numbers

After three GPT-5.5 verification passes (V0 reviewing C1-C10, V_pass2
reviewing V1-V6, V10 reviewing V8-V9) plus a local V11 round:

- **22 of 28 original findings FIXED**; 1 of 3 new findings (the LOW installer
  TOCTOU) closed by V9; the other two (relay sign-oracle, DSSE PAE shape)
  improved to **PARTIAL** by V3+V8+V11 with documented residuals
- **9–10 PARTIAL** remaining — all architectural / scope-of-redesign items
- **0 UNFIXED** after V9
- All 933 tests pass; full `pnpm build` clean

GPT-5.5's V10 verdict on V8 + V9 specifically: NEEDS_MORE_WORK (both PARTIAL,
no new vulnerabilities introduced). V11 tightened V8's Statement validation
(subject entries, predicateType allowlist) — not yet re-verified.

## What's in the diff

29 files: 22 source, 7 tests + 1 audit doc. ~1.6kLOC added, ~230 deleted.

Cluster-by-cluster (per the audit findings document):

| Cluster | Files | Findings |
|---------|-------|----------|
| C1 | hash/chain.ts, schema/event.ts, schema/commit-attestation.ts | CRITICAL #1, MEDIUM #5, #8 |
| C2 | hash/seal.ts, hash/attestation.ts | HIGH #2, #4, LOW #10 |
| C3 | store/jsonl.ts | HIGH #3, MEDIUM #6 |
| C4 | attestation/intoto.ts | MEDIUM #7 |
| C5 | policy/engine.ts, risk/sensitive.ts, risk/classifier.ts | HIGH #11, #13, MEDIUM #14, #15, #16 |
| C6 | policy/loader.ts, agents/claude-code/mapper.ts | HIGH #12, MEDIUM #17 |
| C7 | relay/daemon.ts | CRITICAL #18, HIGH #19, #22, MEDIUM #21, #23 |
| C8 | relay/signing-proxy.ts | HIGH #20 |
| C9 | agents/claude-code/installer.ts | HIGH #25, MEDIUM #26 |
| C10 | agents/claude-code/commit-attestor.ts | HIGH #24, MEDIUM #27, #28 |

Second-pass follow-ups (V1-V9) addressed gaps GPT-5.5 surfaced reviewing C1-C10:

| Pass | Files | Addresses |
|------|-------|-----------|
| V1 | hash/attestation.ts | New MEDIUM: verifyAttestationArtifact accepted missing payload_hash |
| V2 | claude-code/mapper.ts, adapter.ts | HIGH #5 PARTIAL: silent-pass on non-string input |
| V3 | relay/daemon.ts | CRITICAL #2 PARTIAL: prefix-allowlist sign oracle |
| V4 | hash/chain.ts | CRITICAL #1 PARTIAL: fully-stripped log signal |
| V5 | schema/event.ts | MEDIUM #1 PARTIAL: tightened action allowlist (z.enum) |
| V6 | hash/witness.ts | LOW #1 UNFIXED: control-char strip on reflected witness |
| V8 | relay/daemon.ts | New HIGH: DSSE PAE shape gate was superficial |
| V9 | claude-code/installer.ts | New LOW: installer lstat→write TOCTOU |
| V11 | relay/daemon.ts | V8 PARTIAL → tightened: in-toto Statement schema (subject entries, digest hex, predicateType allowlist, predicate object) |

## Known residuals (PARTIAL)

These are documented partial-fixes — each is an architectural improvement that
exceeds the audit-response scope and warrants its own design discussion.

| Finding | Why still partial | Next step |
|---------|------------------|-----------|
| **CRITICAL #1** (legacy log default) | Default tolerance kept for backward compat; stricter mode is opt-in via `requireChainProtected`. Fully strict-by-default would break verifiers for genuinely old logs. | Decide cut-over date; flip default; require explicit `legacyMode: true` from old-log readers. |
| **CRITICAL #2 / HIGH #7 / HIGH #8** (relay sign-oracle / event auth / require-relay default) | All want **peer-credential authorisation** (SO_PEERCRED / LOCAL_PEERCRED). Node has no first-class binding for either. Socket is now 0660 + group-restricted; full mitigation needs a native addon. | Add a small native helper (or per-platform `node-ipc-peer-cred`) and bind verified uid/pid into `_relay`; flip `requireRelay` default to true for attestation paths. |
| **HIGH #4** (shell parser) | Allow-prefix tail metachars rejected; deny-prefix wrapper bypass remains. Real fix needs a shell lexer (`shell-quote` or similar) with full token/path-boundary checks. | Pull in a shell-quote dependency and parse to argv; reject compounds/redirections globally. |
| **HIGH #6** (cwd binding) | Policy uses cwd when supplied; risk classifier doesn't. Both should require a trusted cwd at the layer boundary. | Make `evaluatePolicy(...)` and `classifyRisk(...)` take a required `cwd: string`. Update all call sites. |
| **MEDIUM #2** (read fail-open) | `readAllStrict()` exists; `readAll()` / `query()` still filter silently. | Either flip default to fail-closed or change return shape to `{events, errors}` and update callers to refuse `errors > 0`. |
| **MEDIUM #9** (relay log hardening) | O_NOFOLLOW + lstat blocks symlinks; hardlinks/fchmod/fstat-uid checks + held-fd missing. | Open log once at startup; verify `nlink == 1`, owner, mode; write only via held fd. |
| **LOW #2** (raw verifyAttestation accepts mutated payload_hash) | New `verifyAttestationArtifact()` is the artifact-form check; raw `verifyAttestation()` still exists for callers who only have payload+signature. | Either include `payload_hash` in the signed canonical payload, or deprecate raw verifier in favour of the artifact form. |
| **NEW HIGH (DSSE PAE shape)** | V8 + V11 now parse byte-counted lengths, enforce in-toto media type, schema-validate Statement (subject entries, digest hex, predicateType allowlist), and require a predicate object. Still no binding to daemon-held state — a group-authorised client can craft a valid commit-attestation Statement and get it root-signed. | Bind subject digest / commit_sha / session_id to daemon-held state or require a server-issued nonce per sign request. |
| **NEW LOW V9 (parent-dir TOCTOU)** | V9 closes the final settings.json swap via atomic temp+rename. The `.claude/` parent directory itself can still be path-swapped between checks. | Use `openat`/`O_DIRECTORY` semantics via a native helper, or switch to a verified-realpath parent + `mkdtemp` strategy. |

## How to review

- Original audit: `REVIEWS/2026-05-01-gpt55-security-audit.md`
- First-pass GPT-5.5 review: `/tmp/patchwork-verify/verification-result.json`
- Second-pass GPT-5.5 review: `/tmp/patchwork-verify/verification-result-v2.json`
- Third-pass (V8+V9 focus) GPT-5.5 review: `/tmp/patchwork-verify/verification-result-v3.json`
- All changes vs `main`: `git diff main`

## Verification cost

- Original audit: ~$3.20
- First-pass review (V0): ~$0.55
- Second-pass review (post-V6): ~$0.62
- Third-pass review (V10, V8/V9 focus): ~$0.22
- Total: ~$4.59 of the $10 cap.
