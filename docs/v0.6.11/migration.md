# Migrating from v0.6.10 to v0.6.11

v0.6.11 turns Patchwork from an **audit trail** into an **audit trail + safety
layer**. The audit chain is unchanged; the new piece is a taint-aware
PreToolUse enforcement layer that can DENY or APPROVAL-REQUIRE some tool
actions your agent previously got to take.

This guide answers three questions:

1. What will start failing that didn't fail before?
2. What knobs do I have when it does fail?
3. How do I roll back if I need to?

## What will start failing

If your agent's workflow includes any of these patterns, expect denials
in v0.6.11:

- **Reading a README / docs / changelog and then immediately running a
  network fetch.** README contents register `prompt` taint
  (`FORCE_UNTRUSTED_PATTERNS` always wins), so a subsequent `curl`,
  `gh gist create`, `git push` to a new remote, etc. trips the dangerous-
  shell-combos classifier. This is the design — README-says-run-this is
  the canonical prompt-injection vector.

- **`curl … | sh` or `bash <(curl …)` patterns.** Always denied under any
  taint. Considered "always dangerous." If you legitimately need this,
  use `patchwork approve <id>` to authorize a one-shot retry.

- **`npm install` (or `pnpm`/`yarn`/`bun`) of an untrusted package after
  any taint.** Lifecycle scripts run as your user. Use `--ignore-scripts`
  if you're certain, or `patchwork approve` to authorize.

- **Writing to persistence paths after taint.** `.github/workflows/`,
  `~/.ssh/`, `.git/hooks/`, shell rc files, etc. The persistence sink's
  severity flips from `approval_required` to `deny` under taint.

- **Reading any in-repo path that isn't on a `trusted_paths` allowlist.**
  Until you mark code subtrees explicitly trusted via
  `patchwork trust-repo-config "src/**"`, every Read raises `prompt`
  taint. (For Claude this typically means: tainted forever after the
  first Read. Once trusted_paths is configured for code paths, Reads of
  source files don't taint.)

## The three escape valves

### `patchwork approve <request_id>`

When Patchwork denies an action with `permissionDecision: "deny"`, the
denial reason includes a request_id and the exact approve command. Run
it in your own shell (NOT inside the agent's session — the agent
running approve would defeat the human gate).

```sh
# Agent sees:
# [Patchwork] approval required: ... (rule: sink_deny)
#   Run: patchwork approve 7d3c81c773959f7f

# You run:
patchwork approve 7d3c81c773959f7f
# Agent retries the same action — token is single-use, TTL 5min default.
```

`patchwork approve` (no arg) lists all currently-pending requests.

### `patchwork clear-taint`

If the session's taint accumulated from sources you trust (a curl that
fetched docs from a known-safe domain, an MCP response you've audited),
declassify and continue:

```sh
patchwork clear-taint                     # clear all non-secret kinds
patchwork clear-taint prompt              # clear just one kind
patchwork clear-taint secret --allow-secret  # secret requires explicit opt-in
patchwork clear-taint --session ses_abc   # specific session
```

Cleared sources are NOT deleted from the snapshot — they're tombstoned
with a `cleared` field for the audit trail. Future re-reads will see
the declassification.

### `patchwork trust-repo-config`

Mark in-repo subtrees as trusted so reads inside them don't raise
prompt taint:

```sh
patchwork trust-repo-config "src/**"          # add a glob
patchwork trust-repo-config --list            # see current trusted_paths
patchwork trust-repo-config --remove "src/**" # take one back out
```

This writes a project-local `.patchwork/policy.yml` overlay. The system
policy at `/Library/Patchwork/policy.yml` still controls every deny
rule — `trusted_paths` is the one knob a project policy can additively
express to narrow taint posture (it cannot weaken enforcement).

`FORCE_UNTRUSTED_PATTERNS` always win: README, CHANGELOG, docs/**,
examples/**, .changeset/, node_modules/, vendor/, dist/, build/ — none
can be silenced by `trusted_paths`.

## Rolling back

If v0.6.11's enforcement is too aggressive for your workflow today and
you need the v0.6.10 behavior:

```sh
# Install the previous version globally
npm install -g patchwork-audit@0.6.10

# Re-run the installer to refresh the Claude Code hooks
patchwork init
```

Your existing audit data is forward + backward compatible — JSONL events,
SQLite events, DSSE attestations, and seal chains are all stable across
this boundary.

## What stays the same

- `~/.patchwork/events.jsonl` hash-chained audit log
- `/Library/Patchwork/events.relay.jsonl` root-owned audit log
- HMAC-SHA256 seals every 15 min
- DSSE / in-toto v1 commit attestations
- `patchwork log`, `patchwork export`, `patchwork verify`, `patchwork
  doctor`, `patchwork commit-attest` — all unchanged
- The system policy at `/Library/Patchwork/policy.yml` still controls
  rule-based deny

## What's new for v0.6.11 (TL;DR)

- New CLIs: `patchwork approve`, `patchwork clear-taint`, `patchwork
  trust-repo-config`.
- New per-session taint state at `~/.patchwork/taint/<sha256>.json`.
- New approval request files at `~/.patchwork/approvals/<id>.pending.json`
  + `<id>.approved.json`.
- New PolicySchema field: `trusted_paths: string[]`.
- New relay-config field: `socket_group: string` (fixes the silent
  EACCES regression from v0.6.10).
- Tests: 943 → ~1440. Build clean across all packages.

## Where to look when something denies

1. Read the denial reason in the agent's tool-use error. It names the
   rule (`policy_deny`, `bash_unknown_indicator_taint`, `sink_deny`,
   `sink_approval_required`, `default_allow`) and surfaces the
   `patchwork approve` command.
2. `~/.patchwork/events.jsonl` records the denial with full context.
3. `patchwork status` shows the current session's taint summary.
4. `patchwork doctor` validates the whole stack (hooks, relay,
   policy, seals).

See `docs/v0.6.11/threat-model.md` for the full picture of what
v0.6.11 defends against and what it doesn't.
