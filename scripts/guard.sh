#!/bin/bash
# Patchwork session guard — verifies audit system is operational before Claude Code starts.
# If patchwork CLI is not available or the audit store is not writable, this hook
# outputs an error to stderr. In fail-closed mode, the PreToolUse hook will
# deny all actions if patchwork is broken, so this acts as an early warning.

export PATH="$HOME/local/nodejs/node-v22.16.0-darwin-x64/bin:$PATH"

PATCHWORK_DIR="$HOME/.patchwork"
EVENTS_FILE="$PATCHWORK_DIR/events.jsonl"
GUARD_STATUS_FILE="$PATCHWORK_DIR/state/guard-status.json"

# 1. Check patchwork CLI is available
if ! command -v patchwork &>/dev/null; then
    echo '{"error": "Patchwork CLI not found. Audit trail is not active."}' >&2
    # Write guard failure status so PreToolUse can check it
    mkdir -p "$PATCHWORK_DIR/state"
    echo '{"status":"failed","reason":"cli_not_found","ts":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' > "$GUARD_STATUS_FILE"
    exit 1
fi

# 2. Check audit store directory exists and is writable
if [ ! -d "$PATCHWORK_DIR" ]; then
    mkdir -p "$PATCHWORK_DIR" 2>/dev/null
fi

if [ ! -w "$PATCHWORK_DIR" ]; then
    echo '{"error": "Patchwork data directory is not writable: '"$PATCHWORK_DIR"'"}' >&2
    mkdir -p "$PATCHWORK_DIR/state" 2>/dev/null
    echo '{"status":"failed","reason":"store_not_writable","ts":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' > "$GUARD_STATUS_FILE"
    exit 1
fi

# 3. Check policy file exists
if [ ! -f "$PATCHWORK_DIR/policy.yml" ]; then
    echo "[patchwork-guard] Warning: No policy file at $PATCHWORK_DIR/policy.yml" >&2
fi

# 4. Verify permissions on audit data
EVENTS_PERMS=$(stat -f "%Lp" "$EVENTS_FILE" 2>/dev/null)
if [ -n "$EVENTS_PERMS" ] && [ "$EVENTS_PERMS" != "600" ]; then
    chmod 600 "$EVENTS_FILE" 2>/dev/null
fi

DIR_PERMS=$(stat -f "%Lp" "$PATCHWORK_DIR" 2>/dev/null)
if [ -n "$DIR_PERMS" ] && [ "$DIR_PERMS" != "700" ]; then
    chmod 700 "$PATCHWORK_DIR" 2>/dev/null
fi

# 5. All checks passed — record guard success and forward to patchwork
mkdir -p "$PATCHWORK_DIR/state" 2>/dev/null
echo '{"status":"ok","ts":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' > "$GUARD_STATUS_FILE"

# Forward stdin to patchwork hook session-start
exec patchwork hook session-start
