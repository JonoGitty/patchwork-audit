---
"@patchwork/core": patch
"@patchwork/agents": patch
"patchwork-audit": patch
---

Filesystem tamper-evidence hardening (v0.6.13): durable taint snapshots, symlink refusal on taint paths, and relay liveness checks.

**Durable taint snapshot writes (F2 / R1-011).** `writeTaintSnapshot` used tmp + rename, which gives atomicity but not durability. Without `fsync`, a crash or power loss between the write and the OS flushing its page cache can leave the snapshot absent or truncated, and a reader that then finds an older-but-still-valid snapshot silently rolls taint *backwards* — taint that was recorded disappears, and a sink that should deny allows. The temp file is now fsynced before the rename, and the parent directory afterwards so the rename itself survives.

**Symlink refusal on taint-store paths (F3).** Mirrors the existing `patchwork init` defence for `.claude/` and `settings.json`. An agent able to create a symlink in its own home directory could otherwise redirect the taint store: a symlink at the snapshot path makes the reader return an attacker-chosen file, letting the agent select the taint state the sink classifier sees, and a symlink at the taint directory redirects every snapshot, pending marker and lockfile at once. Reads now fail closed (treated as "all taint kinds active") and writes refuse loudly.

**Relay liveness and delivery checks (F4).** `patchwork relay verify` reported `Integrity: PASS` whenever every line in the relay log parsed as JSON. That said nothing about whether the relay was still *receiving*, so a relay that stopped accepting events months ago reported PASS indefinitely. Verify now also checks heartbeat recency and the delivery-divergence marker, which was already being recorded but which verify ignored. It reports `DEGRADED` when the log may be incomplete, and for the first time sets a process exit code (0 pass, 1 damaged, 2 degraded) — previously it printed `FAIL` on corrupt lines and still exited 0, so any CI or cron check piping it saw success. New `--max-silence <minutes>` and `--json` options.

If you are upgrading and `relay verify` now reports DEGRADED where it previously reported PASS, that is the new check working rather than a new fault: the condition it names was already present and unreported. Note the distinction the output states explicitly — DEGRADED means the log may be **incomplete**, not that it was **edited**. Patchwork can prove the log was not altered. It cannot prove it is complete.
