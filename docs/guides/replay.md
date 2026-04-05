# Session Replay

Session replay lets you step through an AI agent session event by event, seeing exactly what happened in chronological order — including git diffs for file changes.

## Interactive Replay

```bash
patchwork replay <session-id>
```

This opens an interactive terminal UI where you can:
- Step forward/backward through events
- See risk levels and policy decisions for each action
- View git diffs for file modifications
- Skip to high-risk events

### Finding Session IDs

```bash
# List recent sessions
patchwork sessions

# Replay the most recent session
patchwork replay $(patchwork sessions -n 1 --json | jq -r '.[0].id')
```

## HTML Replay

Generate a standalone HTML file for sharing or archival:

```bash
# Auto-saved to ~/.patchwork/reports/
patchwork replay <session-id> --html

# Custom output path
patchwork replay <session-id> -o replay.html
```

The HTML replay includes all events, risk indicators, and git diffs in a self-contained file that can be opened in any browser.

## Filtering

Focus on what matters:

```bash
# Only high-risk events
patchwork replay <session-id> --risk high

# Only file changes
patchwork replay <session-id> --files-only

# Skip git diff integration
patchwork replay <session-id> --no-git
```

## Non-Interactive Mode

Dump all events at once:

```bash
# Print all events to terminal
patchwork replay <session-id> --all

# Auto-play at 500ms intervals
patchwork replay <session-id> --speed 500
```

## Use Cases

- **Post-incident review:** What did the AI do during the session that caused the bug?
- **Code review:** Step through a session before approving the PR
- **Compliance evidence:** Generate HTML replays for auditors
- **Training:** Show new team members what AI agents actually do
