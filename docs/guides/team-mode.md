# Team Mode

::: warning Alpha
Team Mode is in active development (v0.7.0-alpha). The features described here may change.
:::

Team Mode lets you aggregate audit trails from multiple machines into a centralised team server — giving managers and security teams a single view of all AI agent activity across the organisation.

## Architecture

```
Developer A (Mac)                   Team Server
┌────────────────┐                  ┌────────────────────┐
│ Relay daemon   │──sync agent────▶│ Ingest endpoint     │
│ Local audit    │                  │ SQLite database     │
└────────────────┘                  │ Team dashboard      │
                                    │ Policy distribution │
Developer B (Linux)                 └────────────────────┘
┌────────────────┐                         ▲
│ Relay daemon   │──sync agent────────────┘
│ Local audit    │
└────────────────┘

Developer C (Windows)
┌────────────────┐
│ Relay daemon   │──sync agent────────────┘
│ Local audit    │
└────────────────┘
```

## Getting Started

### 1. Start the Team Server

On the machine that will host the server:

```bash
patchwork team server start --port 3001
```

### 2. Enroll Machines

On each developer's machine:

```bash
patchwork team enroll http://server-host:3001 --name "Alice" --token <enrollment-token>
```

### 3. Check Status

```bash
patchwork team status
```

## How Sync Works

The **sync agent** runs on each developer's machine and:

1. Reads events from the relay log (root-owned, tamper-proof)
2. Batches events (up to 500 events or 1 MB per batch)
3. Signs the batch with the machine's API key (HMAC-SHA256)
4. Pushes to the team server's ingest endpoint
5. Tracks sync progress with a local cursor

Events are synced from the **relay log**, not the user log — ensuring the team server receives the tamper-proof copy.

## Unenrolling

```bash
patchwork team unenroll
```

## What's Coming

- Team dashboard (aggregated view across all machines)
- Centralised policy distribution (push policies from server to machines)
- Alert engine (notify on high-risk events across the team)
- Compliance reports spanning multiple machines
