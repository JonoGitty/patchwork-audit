---
"@patchwork/core": patch
"@patchwork/agents": patch
"@patchwork/web": patch
"patchwork-audit": patch
---

Security: address findings from the 2026-05-01 GPT-5.5 audit.

This release closes 22 of 28 audit findings plus the installer TOCTOU
follow-up. Remaining items are architectural (peer-credential auth, full
shell-token parsing, openat-style directory ops, strict-by-default legacy log
handling) and documented as known partials in
`REVIEWS/2026-05-01-gpt55-fix-status.md`.

Highest-impact changes:

- **`@patchwork/core` chain integrity** — `verifyEventHashes` /
  `verifyChain` now reject mid-chain unhashed events (downgrade-attack
  defence). New `legacy_only_log` result field + `requireChainProtected`
  opt let strict callers detect a fully-stripped log.
- **`@patchwork/core` schema** — `AuditEvent.action` is now
  `z.enum(AllActions)` instead of `z.string()`. Misspelled or
  injected action names no longer parse. `commit_sha` requires 40- or
  64-hex; `branch` rejects control characters.
- **`@patchwork/core` seal/attestation** — `computeSealPayload` strictly
  validates its inputs (defeats colon-delimiter ambiguity);
  `loadKeyById` validates `keyId` shape before any filesystem call;
  new `verifyAttestationArtifact` recomputes `payload_hash` and
  requires it to match before checking the signature.
- **`@patchwork/core` policy engine** — file rules now evaluate both
  `target.path` and `target.abs_path` (closes symlink-bypass);
  `command` allow-prefix matches reject tails containing shell
  metacharacters; `network.url_prefix` parses URLs and matches with
  protocol+host+port+path-boundary semantics; MCP tool rules use exact
  server-name comparison instead of substring `includes()`.
- **`@patchwork/core` policy loader** — `PATCHWORK_SYSTEM_POLICY_PATH`
  is now honoured only in `NODE_ENV=test` or when the override file is
  root-owned and not group/world-writable.
- **`@patchwork/core` relay daemon** — Unix socket mode dropped from
  0777 to 0660; sign endpoint refuses arbitrary text and seal-shaped
  payloads, accepting only commit-attestation JSON or strictly-parsed
  DSSE PAEs wrapping in-toto Statements with allowlisted predicateType
  and well-formed subject digests; auto-seal cycles guard against
  reentrancy and no longer drop events appended during witness
  publishing; log writes use `O_NOFOLLOW` + `lstat` to refuse symlinks.
- **`@patchwork/core` signing-proxy** — new `requireRelay` opt (and
  `PATCHWORK_REQUIRE_RELAY=1` env) makes signature requests throw
  `RelayUnavailableError` instead of silently downgrading to the
  user-rooted local keyring.
- **`@patchwork/core` jsonl store** — same-host stale-lock detection
  uses PID liveness only (no false reclaim of fresh locks held by
  alive processes); new `readAllStrict()` API throws on first
  parse/schema failure for callers that need fail-closed reads.
- **`@patchwork/core` in-toto** — DSSE envelope payload requires
  canonical base64 (parse + roundtrip equality).
- **`@patchwork/core` witness** — control characters are stripped from
  reflected `witnessed_at` values in error messages, preventing ANSI
  escape injection into terminal logs / CI annotations.
- **`@patchwork/agents` Claude Code mapper** — non-string tool input
  fields no longer crash the hook or silently bypass policy; the
  mapper sets a `malformed` flag and the PreToolUse handler returns a
  deterministic deny + records a denied audit event.
- **`@patchwork/agents` installer** — interpolated shell paths and env
  values use POSIX single-quote escaping; project installs refuse
  `.claude/` and `settings.json` symlinks; settings writes are atomic
  (re-`lstat` + temp + rename) to close the TOCTOU window.
- **`@patchwork/agents` commit attestor** — `findLastCommitEventIndex`
  excludes the current commit, so denials between the previous and
  current commit are no longer dropped from the attestation; git-notes
  invocations use `execFileSync` argv form (no shell); all
  filesystem/git paths assert `commit_sha` shape before use.

Test count: 933 (was 921). Build: clean.
