---
"@patchwork/core": patch
"@patchwork/agents": patch
"@patchwork/web": patch
"patchwork-audit": patch
---

Surface commit-attestation observability that v0.6.6 silently lost.

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
