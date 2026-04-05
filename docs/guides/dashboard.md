# Web Dashboard

The Patchwork dashboard is a locally-served web interface that gives you real-time visibility into everything your AI agents are doing.

## Launching the Dashboard

```bash
patchwork dashboard
```

Opens [localhost:3000](http://localhost:3000) in your browser. All data is served locally — nothing leaves your machine.

**Options:**

```bash
# Custom port
patchwork dashboard --port 8080

# Don't auto-open browser
patchwork dashboard --no-open
```

## Pages

### Overview

The landing page shows:
- **Event count** and **session count** for the current period
- **Risk distribution** chart (none/low/medium/high/critical)
- **Recent events** with colour-coded risk levels
- **Active sessions** with status indicators
- **Policy status** (active policy, mode, denial count)

### Events

Searchable, filterable table of all audit events:
- Filter by agent, action type, risk level, session, and date range
- Click any event to see full details (target, risk flags, hash chain position)
- Colour-coded risk levels for quick scanning

### Sessions

Timeline view of all AI agent sessions:
- Duration, event count, and risk breakdown per session
- Click to expand and see session events
- Link to session replay

### Risk

Dedicated risk analysis page:
- Risk distribution over time (chart)
- Highest-risk events with full context
- Risk flag frequency analysis
- Trend indicators (improving/worsening)

### Search

Full-text search across all events:
- Powered by SQLite FTS5
- Matches file paths, commands, tool names, and actions
- Results ranked by relevance

### Doctor

Health check page showing:
- Hook installation status
- Relay daemon status
- Policy configuration
- Watchdog status
- Chain integrity summary

### Replay

Interactive session replay (also available via CLI):
- Step through events chronologically
- See git diffs for file changes
- Filter by risk level or file events only

### Compliance

Compliance dashboard showing:
- Framework coverage status (SOC 2, ISO 27001, EU AI Act, etc.)
- Control-by-control evaluation
- Gap analysis with remediation suggestions
- Compliance trend over time

## Technology

The dashboard is built with:
- **Hono** — lightweight HTTP framework
- **htmx** — server-rendered interactivity (no heavy JS framework)
- **Chart.js** — data visualisation
- **SQLite FTS5** — full-text search

It runs as a single Node.js process with no external dependencies.
