# Team Mode — Pre-Alpha Test Plan

Before pushing `@patchwork/team` to npm as an alpha, this checklist must be green. Items 1–6 are blocking. Items 7+ are known limitations to document, not blockers.

Automated smoke test for the happy path: `packages/team/scripts/smoke-local.sh`.

---

## Blocking (must pass before npm publish)

### 1. Two-machine integration

Spin up server on machine A, enroll machine B, produce events on B, confirm they land in A's DB.

**Setup**
- Machine A: `patchwork team server start --port 3001 --db /tmp/team-test.sqlite`
- Note the enrollment token printed by the server
- Machine B: `patchwork team enroll http://<A-ip>:3001 --name "B" --token <token>`

**Check**
- `patchwork team status` on B reports `enrolled, last_sync: <timestamp>`
- On A, sqlite3 `/tmp/team-test.sqlite` `"SELECT count(*) FROM events WHERE machine = 'B';"` > 0
- HMAC signature on each ingested batch verified (check server log for `SIGN OK`)

**Bridge target**: route to Razer (Windows B) via `python3 /Users/jonogompels/AI/claude-bridge/relay/bridge.py prompt "..."`.

### 2. Sync agent restart resilience

Client sync agent must resume from cursor after a crash or restart — no duplication, no gaps.

**Steps**
- On B: produce 50 fresh events (any Claude Code activity works)
- Start the sync agent — let it push ~20 events
- `kill -9 <sync-agent-pid>` mid-batch
- Restart the sync agent
- Verify server has exactly 50 events tied to machine B, not 49 and not 70

**Instrumentation**: sync agent writes `sync/cursor.json` on every successful push. Verify the cursor advances monotonically and isn't rewound.

### 3. Server down / network loss

Client must buffer via the relay log (which is append-only anyway) and retry with backoff. No event loss.

**Steps**
- Start server, enroll client, confirm baseline sync works
- Stop the server: `launchctl unload com.patchwork.team-server` or `Ctrl-C`
- On client, produce 20 more events
- Confirm sync agent shows retries with exponential backoff in its log (target: `sync/backoff.ts` should produce 1s, 2s, 4s, 8s…)
- Restart the server
- Within 30s of server returning, all 20 events should arrive in the DB

### 4. Enrollment token lifecycle

Tokens must be single-use + time-bound, and API key revocation must stop sync cleanly.

**Steps**
- Issue a token on the server (`patchwork team admin issue-token --expires 5m`)
- Wait 6 minutes, try to enroll — must be rejected with `token_expired`
- Issue a fresh token, enroll successfully
- On server: `patchwork team admin revoke --machine B`
- On client: next sync attempt must fail with `401 api_key_revoked` and halt the sync loop (not infinite-retry)

### 5. Fresh-install smoke test

Simulate what a new user experiences installing from npm.

**Steps**
- Create a clean tmp directory
- `npm pack packages/team` — produces `patchwork-team-0.7.0-alpha.1.tgz`
- In a fresh shell with no env pollution: `npm i -g ./patchwork-team-0.7.0-alpha.1.tgz`
- Check that `patchwork team --help` works (requires patchwork-audit to route into team commands)
- Run the smoke script: `bash packages/team/scripts/smoke-local.sh`

### 6. Cross-platform (Mac + Windows)

Sync agent must work on Windows. Server is Hono + Node so should be portable, but the relay log is macOS-only (`/Library/Patchwork/events.relay.jsonl`). On Windows, the client reads `C:\ProgramData\Patchwork\events.relay.jsonl` — confirm this path is wired.

**Steps**
- Bring up server on Mac (this machine)
- Enroll the Razer Windows laptop (jonorazer.local)
- Produce events on Windows via Claude Code
- Confirm they arrive in the Mac server's DB

**Bridge**: `python3 /Users/jonogompels/AI/claude-bridge/relay/bridge.py prompt "enroll in team server at <mac-ip>:3001 and produce a test event"`

---

## Non-blocking (document as known limitations)

### 7. Concurrent ingest (3+ clients)
No load test yet. Document as "single-team-size validated; >10 concurrent clients untested."

### 8. Clock drift tolerance
HMAC signatures include timestamps. If the current window is tight (e.g. ±60s), clients with bad NTP will fail. Document the window and recommend NTP.

### 9. DB recovery
SQLite is durable with WAL but if the server box dies, there's no replication. Document: "server is single-point-of-failure; run it on reliable hardware or back up the sqlite file."

### 10. Upgrade path
alpha.1 → alpha.2 with a schema change. Need a migration system. For now, document: "data migration across alpha versions is not guaranteed; expect to reset the server DB on upgrade."

### 11. mTLS
Not implemented. Document: "alpha uses HMAC-only auth; deploy behind a reverse proxy that terminates TLS if you need transport encryption."

### 12. Rate limiting / abuse protection
Not implemented. Document: "ingest endpoint is unthrottled; do not expose to the public internet without fronting it with rate-limiting proxy."

### 13. Backup / restore
No tooling. Document: "back up the sqlite file with your regular filesystem backup strategy."

---

## Before publishing to npm

- [ ] Items 1–6 pass on both Mac and Windows
- [ ] `docs/team-mode-architecture.md` is honest about what's shipped (already updated)
- [ ] `docs/guides/team-mode.md` links to this test plan
- [ ] A `SECURITY.md` for the team server exists, covering: HMAC key storage, revocation, network exposure guidance
- [ ] Version bumped to `0.7.0-alpha.2` (not `0.7.0`) — this is explicit opt-in alpha
- [ ] Publish workflow in `.github/workflows/publish.yml` includes `@patchwork/team` (currently only publishes `patchwork-audit`)
