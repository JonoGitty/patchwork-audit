# Patchwork Team Mode: Architecture

> **Status: Alpha (v0.7.0-alpha.1) — experimental, partially shipped, not published to npm.**
>
> The `@patchwork/team` package exists and has 99 passing unit tests, but has not been run in any real multi-machine deployment. Several features described below are still on the design path rather than in code. See **[Current Implementation Status](#current-implementation-status)** for what's actually shipped vs planned.

---

## Current Implementation Status

| Capability | Design | Implemented | Notes |
|---|---|---|---|
| Sync agent (reads relay log, batches, pushes) | ✅ | ✅ | `packages/team/src/sync/` |
| Machine enrollment (HMAC API key) | ✅ | ✅ | `sync/enrollment.ts` + server `/routes/enroll.ts` |
| Cursor tracking + resume | ✅ | ✅ | `sync/cursor.ts` |
| Exponential backoff on network errors | ✅ | ✅ | `sync/backoff.ts` |
| Seal-batch reader | ✅ | ✅ | `sync/seal-reader.ts` |
| Team server: `/api/v1/ingest` | ✅ | ✅ | HMAC-verified event ingestion |
| Team server: `/api/v1/health` | ✅ | ✅ | |
| Team server: `/api/v1/machines` | ✅ | ✅ | List enrolled machines |
| Team server: `/api/v1/admin/*` | ✅ | Partial | Admin endpoints scaffold exists |
| Storage backend | **Postgres + FTS** (plan) | **SQLite** (actual) | Shipped with better-sqlite3; Postgres deferred |
| Query endpoints (`/api/v1/events`, `/sessions`, `/stats`) | ✅ | ❌ | No query API yet |
| Policy distribution (`/api/v1/policy`) | ✅ | ❌ | Not wired |
| Verify endpoint (`/api/v1/verify`) | ✅ | ❌ | Not wired |
| Alert engine + rules | ✅ | ❌ | Not wired |
| Reports API | ✅ | ❌ | Not wired |
| Team dashboard (web UI) | ✅ | ❌ | Not built |
| mTLS | ✅ | ❌ | HMAC-only today |
| Rate limiting | ✅ | ❌ | Not wired |
| CLI commands (`team server start`, `enroll`, `status`, `unenroll`) | ✅ | ✅ | Shipped in CLI v0.6.x |

**What the alpha can do today**: run a team server on one machine, enroll clients, sync their audit events into a single SQLite database. That's it.

**What the alpha can NOT do yet**: query those events, distribute policy from server to client, alert on high-risk activity, show a dashboard, or enforce mTLS.

See the [**Team Mode guide**](./guides/team-mode.md) for the user-facing alpha walkthrough.

---

## Overview

Team Mode adds a centralized aggregation layer on top of the existing single-machine architecture. Each developer's machine continues to operate as-is — hooks intercept tool calls, events are written locally, the relay daemon seals them. A new **sync agent** pushes sealed event batches to a **team server**, which stores, indexes, and presents them. Policy flows in reverse: admin sets policy on the server, machines pull updates.

```
Developer Machine A                    Team Server
+------------------+                 +--------------------+
| Claude Code      |                 |  Hono REST API     |
|   -> hooks       |                 |  PostgreSQL + FTS  |
|   -> events.jsonl|                 |  Policy store      |
|   -> relay daemon|                 |  Alert engine      |
|   -> seals.jsonl |   HTTPS/mTLS   |  Team dashboard    |
|   -> sync-agent -+--[push events]-+->  /api/v1/ingest  |
|                  |<-[pull policy]-+--  /api/v1/policy   |
+------------------+                 +--------------------+
                                           |
Developer Machine B   --push events-->     |
Developer Machine C   --push events-->     |
```

The architecture is **additive**: zero changes to the hook pipeline or relay daemon.

---

## New Package: `@patchwork/team`

Fifth package in the monorepo containing both the sync agent and team server.

```
packages/team/
  src/
    sync/
      agent.ts          -- SyncAgent: reads relay log, batches, pushes
      cursor.ts         -- Tracks sync position (byte offset into relay log)
      transport.ts      -- HTTPS client with retry, backoff, mTLS
      enrollment.ts     -- Machine enrollment and API key provisioning
    server/
      app.ts            -- Hono application factory
      middleware/
        auth.ts         -- Bearer token + mTLS validation
        rate-limit.ts   -- Per-machine rate limiting
      routes/
        ingest.ts       -- POST /api/v1/ingest
        policy.ts       -- GET/PUT /api/v1/policy
        query.ts        -- GET /api/v1/events, sessions, stats
        verify.ts       -- POST /api/v1/verify
        alerts.ts       -- GET/PUT /api/v1/alerts
        machines.ts     -- GET /api/v1/machines
        reports.ts      -- GET /api/v1/reports
      db/
        schema.ts       -- PostgreSQL schema + migrations
        queries.ts      -- Prepared query builders
      alerts/
        engine.ts       -- Alert rule evaluation
        channels.ts     -- Slack, email, webhook dispatch
      dashboard/
        routes.ts       -- Team dashboard HTML routes
        templates/      -- htmx templates
    protocol.ts         -- Sync protocol types, envelope schemas
    crypto.ts           -- Envelope signing, machine identity
```

---

## Sync Protocol

### Sync Agent

Runs as a background daemon (launchd/systemd/Task Scheduler) alongside the relay daemon. Reads from the relay's append-only log and pushes batches to the team server.

**Reads from relay log, not user log.** The relay log at `/Library/Patchwork/events.relay.jsonl` is root-owned and tamper-proof. A malicious user cannot modify it.

**Sync cursor** persisted at `/Library/Patchwork/team/sync-cursor.json`:
```json
{
  "schema_version": 1,
  "last_synced_offset": 48372,
  "last_synced_event_hash": "sha256:a1b2c3...",
  "last_synced_at": "2026-04-02T14:30:00.000Z",
  "last_seal_synced": "2026-04-02T14:15:00.000Z",
  "consecutive_failures": 0
}
```

**Sync cycle (every 30 seconds):**
1. Read cursor
2. Seek to `last_synced_offset` in relay log
3. Read new lines (skip heartbeats), collect up to 500 events or 1 MB
4. If no new events, sleep and retry
5. Build SyncEnvelope
6. POST to team server `/api/v1/ingest`
7. On 200: advance cursor, reset failure count
8. On 409 (duplicate): advance cursor
9. On 4xx/5xx: increment failure count, exponential backoff (30s, 1m, 2m, 5m, 10m cap)
10. Check for new seals in `seals.relay.jsonl` — push those too

**Hook pipeline impact: zero.** The sync agent is completely decoupled. Hooks write to JSONL and relay as today. No impact on the 2-second hook timeout.

### Sync Envelope Format

```typescript
interface SyncEnvelope {
  schema_version: 1;
  type: "event-batch" | "seal-batch" | "attestation";
  machine_id: string;
  machine_name: string;
  developer_id: string;
  team_id: string;
  events: RelayEvent[];
  seals?: SealRecord[];
  batch_hash: string;           // SHA-256 of canonical JSON of events
  first_event_hash: string;
  last_event_hash: string;
  relay_chain_tip: string;
  signature: string;            // HMAC-SHA256 using machine API key
  signed_at: string;
  byte_offset_start: number;
  byte_offset_end: number;
}
```

### Offline Handling

Events remain safe in the local relay log (never deleted). When connectivity resumes, the agent reads from last synced offset and catches up. Server de-duplicates by `(machine_id, event_id)`.

---

## Team Server

### Technology

- **Web framework:** Hono (consistent with existing `@patchwork/web`)
- **Database:** PostgreSQL (production) or SQLite (small teams)
- **Full-text search:** PostgreSQL tsvector/GIN or SQLite FTS5
- **Auth:** API keys (machine-to-server), JWT + bcrypt (admin dashboard)
- **Transport:** HTTPS (TLS 1.3), optional mTLS

### Database Schema

```sql
CREATE TABLE teams (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    settings    JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE team_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID NOT NULL REFERENCES teams(id),
    email       TEXT NOT NULL,
    name        TEXT NOT NULL,
    role        TEXT NOT NULL CHECK (role IN ('admin', 'lead', 'viewer')),
    password_hash TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login  TIMESTAMPTZ,
    UNIQUE(team_id, email)
);

CREATE TABLE machines (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID NOT NULL REFERENCES teams(id),
    machine_id  TEXT NOT NULL,
    machine_name TEXT NOT NULL,
    developer_id UUID REFERENCES team_members(id),
    developer_name TEXT NOT NULL,
    api_key_hash TEXT NOT NULL,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ,
    last_chain_tip TEXT,
    last_seal_at TIMESTAMPTZ,
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
    os          TEXT,
    agent_version TEXT,
    UNIQUE(team_id, machine_id)
);

CREATE TABLE events (
    id              TEXT NOT NULL,
    machine_id      UUID NOT NULL REFERENCES machines(id),
    team_id         UUID NOT NULL REFERENCES teams(id),
    session_id      TEXT NOT NULL,
    timestamp       TIMESTAMPTZ NOT NULL,
    agent           TEXT NOT NULL,
    action          TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'completed',
    target_type     TEXT,
    target_path     TEXT,
    target_command  TEXT,
    risk_level      TEXT NOT NULL DEFAULT 'none',
    risk_flags      TEXT[],
    event_hash      TEXT,
    prev_hash       TEXT,
    relay_hash      TEXT,
    raw_json        JSONB NOT NULL,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (machine_id, id),
    search_vector   tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(target_path, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(target_command, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(action, '')), 'B')
    ) STORED
);

CREATE INDEX idx_events_team_timestamp ON events(team_id, timestamp DESC);
CREATE INDEX idx_events_machine ON events(machine_id, timestamp DESC);
CREATE INDEX idx_events_risk ON events(team_id, risk_level) WHERE risk_level IN ('high', 'critical');
CREATE INDEX idx_events_search ON events USING GIN(search_vector);

CREATE TABLE seals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id      UUID NOT NULL REFERENCES machines(id),
    team_id         UUID NOT NULL REFERENCES teams(id),
    sealed_at       TIMESTAMPTZ NOT NULL,
    tip_hash        TEXT NOT NULL,
    chained_events  INTEGER NOT NULL,
    signature       TEXT NOT NULL,
    key_id          TEXT,
    verified        BOOLEAN DEFAULT false,
    UNIQUE(machine_id, tip_hash)
);

CREATE TABLE policies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID NOT NULL REFERENCES teams(id),
    version         INTEGER NOT NULL,
    name            TEXT NOT NULL,
    policy_yaml     TEXT NOT NULL,
    policy_hash     TEXT NOT NULL,
    created_by      UUID REFERENCES team_members(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active       BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(team_id, version)
);

CREATE TABLE policy_deployments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id       UUID NOT NULL REFERENCES policies(id),
    machine_id      UUID NOT NULL REFERENCES machines(id),
    deployed_at     TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    policy_hash     TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'deployed', 'acknowledged', 'rejected')),
    UNIQUE(policy_id, machine_id)
);

CREATE TABLE alert_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID NOT NULL REFERENCES teams(id),
    name            TEXT NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    condition       JSONB NOT NULL,
    channels        TEXT[] NOT NULL,
    created_by      UUID REFERENCES team_members(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE alert_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id         UUID NOT NULL REFERENCES alert_rules(id),
    team_id         UUID NOT NULL REFERENCES teams(id),
    machine_id      UUID REFERENCES machines(id),
    event_id        TEXT,
    triggered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    details         JSONB NOT NULL,
    channels_notified TEXT[] NOT NULL
);

CREATE TABLE compliance_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID NOT NULL REFERENCES teams(id),
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    period_start    TIMESTAMPTZ NOT NULL,
    period_end      TIMESTAMPTZ NOT NULL,
    report_json     JSONB NOT NULL,
    report_hash     TEXT NOT NULL
);
```

### API Endpoints

**Machine-facing (Bearer token):**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/ingest` | Receive event batch |
| POST | `/api/v1/ingest/seals` | Receive seal records |
| POST | `/api/v1/ingest/attestation` | Receive commit attestation |
| GET | `/api/v1/policy/active` | Get active policy |
| POST | `/api/v1/policy/ack` | Acknowledge policy deployment |
| POST | `/api/v1/heartbeat` | Machine heartbeat |
| POST | `/api/v1/enroll` | Enroll new machine |

**Dashboard-facing (JWT):**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/login` | Login |
| GET | `/api/v1/team/overview` | Aggregated team stats |
| GET | `/api/v1/team/events` | Events across all machines |
| GET | `/api/v1/team/sessions` | Sessions across all machines |
| GET | `/api/v1/team/machines` | Enrolled machines |
| GET | `/api/v1/team/developers` | Per-developer activity |
| GET | `/api/v1/team/risk` | Risk distribution |
| POST | `/api/v1/team/verify` | Cross-machine seal verification |
| PUT | `/api/v1/team/policy` | Create new policy version |
| POST | `/api/v1/team/reports/generate` | Generate compliance report |

### Ingest Processing

1. Validate Bearer token → resolve machine_id, team_id
2. Verify machine status is active
3. Verify envelope HMAC signature
4. Verify batch_hash
5. Verify chain continuity (first_event_hash.prev_hash matches server's last known tip)
6. INSERT events (ON CONFLICT DO NOTHING for idempotency)
7. Update machine last_seen_at, last_sync_at, last_chain_tip
8. Queue events for alert evaluation (async)
9. Return 200 with accepted/duplicate counts

---

## Policy Distribution

1. Admin creates new policy version on server (is_active = true, previous deactivated)
2. Policy deployments created for each active machine (status = pending)
3. On next sync cycle, machine calls `GET /api/v1/policy/active`
4. If hash differs from local: write to `/Library/Patchwork/policy.yml` (system path)
5. Call `POST /api/v1/policy/ack`

**Why this works:** `loadActivePolicy()` already checks `/Library/Patchwork/policy.yml` first. Zero code changes to the policy engine.

---

## Alert System

### Alert Conditions

```typescript
interface AlertCondition {
  type: "risk_level" | "action" | "status" | "pattern" | "threshold";
  min_risk?: "low" | "medium" | "high" | "critical";
  actions?: string[];
  statuses?: string[];
  pattern?: string;
  threshold?: number;
  window_minutes?: number;
  machine_ids?: string[];  // empty = all
}
```

### Default Rules (created for every new team)

1. "Critical Risk Event" — risk_level = critical → webhook
2. "Policy Denial" — status = denied → webhook
3. "Machine Offline" — not seen for 1 hour → webhook

### Channels

- **Webhook:** POST to configured URL (Slack/Discord/generic JSON)
- **Email:** SMTP or HTTP mail API
- **In-dashboard:** Always stored in alert_history

---

## Team Dashboard

Extends the existing dark theme design system (Hono + htmx + Chart.js).

**Pages:**
- **Team Overview** — stat cards, stacked activity chart by developer, risk donut, machine status grid
- **Developers** — per-developer rows with event/session counts, risk levels
- **Machines** — machine cards with sync status (green/yellow/red), chain tips, seal freshness
- **Events** — existing event table + Machine/Developer columns
- **Policy** — active policy, version history with diffs, deployment status
- **Alerts** — rule management, alert history feed
- **Compliance** — report generation, export (JSON/CSV/PDF)

---

## Seal Verification

**Server-side chain verification:** Stores full `(event_hash, prev_hash)` chain per machine. Re-runs `verifyChain()` on demand or nightly.

**Countersignature:** Sync agent signs each batch envelope with a team-sync key (generated at enrollment, root-owned). Server can independently verify.

**Verification endpoint response:**
```json
{
  "machines": [{
    "machine_name": "jono-mbp",
    "chain": { "total_events": 12483, "is_valid": true },
    "seals": { "total": 847, "verified": 847, "failed": 0 },
    "sync": { "last_sync_at": "...", "sync_lag_seconds": 30 }
  }],
  "team_summary": {
    "all_chains_valid": true,
    "all_seals_verified": true,
    "machines_current": 3,
    "machines_offline": 0
  }
}
```

---

## Machine Enrollment

1. Admin creates team, gets enrollment token
2. Developer runs `patchwork team enroll https://server.url`
3. CLI collects machine_id (hardware-derived), hostname, OS, developer info
4. POST `/api/v1/enroll` with token + machine info
5. Server returns API key
6. CLI stores config at `/Library/Patchwork/team/config.json` (root-owned, 0600)
7. CLI starts sync agent daemon

**Machine identity** derived from hardware:
- macOS: `IOPlatformUUID` from `ioreg`
- Linux: `/etc/machine-id`
- Windows: `MachineGuid` from registry

Hashed with team salt: `machine_id = SHA-256(hardware_id + team_id)`

---

## Security Model

| Context | Mechanism |
|---------|-----------|
| Machine → Server | Bearer API key (256-bit, `pw_` prefix) |
| Admin → Dashboard | JWT + bcrypt |
| Optional | mTLS client certificates |

**RBAC:**
- `admin` — full access
- `lead` — view all, configure alerts, generate reports
- `viewer` — own machine events only

**Data privacy:** Events already have secrets redacted at the hook level. Team server receives hashes, not file contents or prompt text.

**Tamper resistance:** Three independent verification layers — local event chain, relay chain, and sync envelope countersignature.

---

## Deployment Options

**Docker (production):**
```yaml
services:
  patchwork-team:
    image: ghcr.io/jonogitty/patchwork-team:latest
    ports: ["3001:3001"]
    environment:
      DATABASE_URL: postgres://patchwork:secret@db:5432/patchwork_team
      JWT_SECRET: <random-256-bit>
    depends_on: [db]
  db:
    image: postgres:16-alpine
```

**Single-binary (small teams):**
```bash
patchwork team server start --port 3001 --db /opt/patchwork-team/team.db
```

**Cloud:** Railway, Render, Fly.io, AWS ECS + RDS.

---

## Changes to Existing Codebase

Minimal and non-breaking:

- `@patchwork/core`: Add `"sync_status"` to relay message types (backwards-compatible), optional `machineId` to EventFilter
- `@patchwork/web`: Add `/api/team-sync-status` endpoint for local dashboard indicator
- `patchwork-audit` CLI: Register `team` command group (enroll, status, sync, unenroll, policy, server start)
- `@patchwork/agents`: No changes

---

## Implementation Phases

| Phase | Scope | Weeks |
|-------|-------|-------|
| 1 | Sync infrastructure (agent, cursor, transport, ingest, enrollment, DB) | 1-2 |
| 2 | Policy distribution (API, sync pull, local write, ack) | 2-3 |
| 3 | Team dashboard (overview, events, sessions, machines, developers) | 3-4 |
| 4 | Verification and alerts (chain verify, seal verify, alert engine, channels) | 4-5 |
| 5 | Compliance, Docker, docs | 5-6 |
