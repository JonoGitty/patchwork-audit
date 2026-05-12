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
denial reason includes a request_id and tells the user (not the
agent) to run the approve command in their own terminal. Run it in
your own shell — not inside the agent's session.

```sh
# Agent sees:
# [Patchwork] denied: ... (rule: sink_deny)
#   Ask the human user to run `patchwork approve 7d3c81c773959f7f` in their own terminal.

# You run:
patchwork approve 7d3c81c773959f7f
# Agent retries the same action — token is single-use, TTL 5min default.
```

`patchwork approve` (no arg) lists all currently-pending requests.

> **Why the agent can't approve for you.** v0.6.11 layers three defenses
> against the agent self-approving: a system-policy regex deny that
> refuses the Bash invocation before it spawns, a semantic detector
> that walks the parsed shell tree and matches `patchwork`/admin-verb
> argv shapes regardless of quoting, and an in-CLI TTY check. The
> remaining same-UID residuals (symlink/alternate-name exec,
> variable-named exec) are documented in
> [threat-model.md § Accepted residuals](threat-model.md#accepted-residuals-in-v0611);
> they are structurally fixed by the v0.6.12 root-owned approval
> daemon, which moves the boundary out of the agent's UID entirely.

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

## Required upgrade step: system-policy refresh

v0.6.11 ships a new deny rule in `docs/default-policy.yml` that
refuses agent invocations of `patchwork approve | clear-taint |
trust-repo-config` at the PreToolUse layer (before the Bash
subprocess spawns). For existing installs this rule needs to land
in your live system policy at `/Library/Patchwork/policy.yml`:

```sh
# In your own terminal (sudo required):
sudo patchwork init --upgrade
```

`patchwork init --upgrade` is idempotent: it adds the new admin-CLI
deny rule if missing, leaves your existing custom rules untouched,
and reports a summary diff. **Until you run this, the in-CLI TTY
check is the only gate against agent self-approval**, and a
PTY-allocating wrapper (`script -c '...'`) will pass it. Run the
upgrade.

If you can't run `patchwork init --upgrade` (e.g. you maintain the
system policy by hand or via configuration management), the rule to
add under `commands.deny:` is:

```yaml
- regex: "(^|[^A-Za-z0-9_-])patchwork[ \\t]+(approve|clear-taint|trust-repo-config)\\b"
  action: deny
  reason: "Administrative CLI — must be run by the human user in their own terminal"
```

## What's new for v0.6.11 (TL;DR)

- New CLIs: `patchwork approve`, `patchwork clear-taint`, `patchwork
  trust-repo-config`.
- New per-session taint state at `~/.patchwork/taint/<sha256>.json`.
- New approval request files at `~/.patchwork/approvals/<id>.pending.json`
  + `<id>.approved.json`.
- New PolicySchema field: `trusted_paths: string[]`.
- New user-level trust store at `~/.patchwork/trusted-repos.yml`
  (replaces the project-local `.patchwork/policy.yml` trust overlay
  that a hostile repo could commit — see R2-003).
- New relay-config field: `socket_group: string` (fixes the silent
  EACCES regression from v0.6.10).
- New system-policy regex deny for admin CLIs (R3-001 / R4-001 /
  R6-001 hardening across six adversarial audit rounds).
- New semantic `admin_cli_invocation` sink in dangerous-shell-combos
  (R5-001 / R6-001) — quote- and modifier-aware.
- Broadened env-source detector covers `env`, `printenv`, bare
  `set`, `export -p`, `declare -p/-x/-px/-xp`, `typeset -p/-x/-px`,
  `readonly -p`, `compgen -e`, and any redirect or argv reference to
  `/proc/<X>/environ` (R2-004 / R3-003 / R4-002).
- Tests: 943 → 1509. Build clean across all packages.

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
v0.6.11 defends against and what it doesn't — including the
"Same-UID approval boundary" section that explains why some bypass
shapes are accepted residuals in v0.6.11 and structurally closed by
the v0.6.12 root-owned approval daemon.

## What's coming in v0.6.12

The v0.6.11 audit loop spent six rounds hardening the
agent-self-approval boundary at the layer where it lives today
(CLI + system-policy regex). Each round closed concrete bypasses,
but they're all variations of one root cause: **approval is a
command that the agent's own UID can type**. v0.6.12 fixes this
structurally:

- A small `patchwork-approver` daemon will run as **root**, owning
  the approval state in a root-only directory. The agent's UID
  cannot read or write that state.
- The `patchwork approve` CLI as the agent knows it will go away.
  Approval will surface through a channel the agent doesn't share
  (desktop notification / Touch ID / phone push / web UI on
  localhost — configurable).
- The PreToolUse hook will ask the daemon over a Unix socket "is
  request `<x>` approved?" Yes/no. The agent cannot forge the
  daemon's response.

That removes the same-UID boundary from the approval flow entirely,
making the R6-002 alternate-name and variable-named-exec residuals
moot (there's no command to call, regardless of what the agent
names its binary). The same daemon will sign per-session taint
snapshots with a root-held HMAC key, closing the snapshot
authenticity residual (R1-001 / R1-008) at the same time.

v0.6.12 will also ship the first-class URL allowlist + body-shape
detection that closes allowed-domain exfiltration.
