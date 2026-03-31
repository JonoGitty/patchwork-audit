#!/bin/bash
# Patchwork session guard — verifies audit system is operational before Claude Code starts.
# If patchwork CLI is not available or the audit store is not writable, this hook
# outputs an error to stderr. In fail-closed mode, the PreToolUse hook will
# deny all actions if patchwork is broken, so this acts as an early warning.
#
# Works for any user on any architecture (runtime Node discovery).

# --- Runtime Node discovery ---
for _candidate in \
    "$HOME/local/nodejs/"node-*/bin \
    /usr/local/bin \
    /opt/homebrew/bin \
    "$HOME/.nvm/versions/node/"*/bin \
    "$HOME/.volta/bin"; do
    if [ -x "$_candidate/node" ]; then
        export PATH="$_candidate:$PATH"
        break
    fi
done

PATCHWORK_DIR="$HOME/.patchwork"
EVENTS_FILE="$PATCHWORK_DIR/events.jsonl"
GUARD_STATUS_FILE="$PATCHWORK_DIR/state/guard-status.json"

# 1. Check patchwork CLI is available AND executable
# Find the correct node binary (handles Intel Mac with ARM homebrew)
_NODE=""
_PW=""
for _candidate in \
    "$HOME/local/nodejs/"node-*/bin \
    /usr/local/bin \
    /opt/homebrew/bin \
    "$HOME/.nvm/versions/node/"*/bin \
    "$HOME/.volta/bin"; do
    if [ -x "$_candidate/node" ] && [ -x "$_candidate/patchwork" ]; then
        # Verify this node can actually run (correct architecture)
        if "$_candidate/node" --version &>/dev/null; then
            _NODE="$_candidate/node"
            _PW="$_candidate/patchwork"
            export PATH="$_candidate:$PATH"
            break
        fi
    fi
done

if [ -z "$_NODE" ]; then
    # Fallback: try bare patchwork
    if command -v patchwork &>/dev/null && patchwork --version &>/dev/null; then
        _PW="$(command -v patchwork)"
        _NODE=""
    else
        echo '{"error": "Patchwork CLI not found or node has wrong architecture."}' >&2
        mkdir -p "$PATCHWORK_DIR/state"
        echo '{"status":"failed","reason":"cli_not_found","ts":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' > "$GUARD_STATUS_FILE"
        exit 1
    fi
fi

# Store for later use
echo "$_NODE" > "$PATCHWORK_DIR/state/node-path"
echo "$_PW" > "$PATCHWORK_DIR/state/patchwork-path"

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

# 3. Check for policy (system-level or user-level)
if [ ! -f "/Library/Patchwork/policy.yml" ] && [ ! -f "$PATCHWORK_DIR/policy.yml" ]; then
    echo "[patchwork-guard] Warning: No policy file found" >&2
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

# 5. Check hooks in settings.json use correct node path
SETTINGS_FILE="$HOME/.claude/settings.json"
if [ -f "$SETTINGS_FILE" ]; then
    if grep -q "/node " "$SETTINGS_FILE" 2>/dev/null; then
        : # explicit node path — good
    elif grep -q "patchwork hook" "$SETTINGS_FILE" 2>/dev/null; then
        echo "[patchwork-guard] WARNING: Hooks use bare 'patchwork' — may fail on mixed-arch Macs. Run: patchwork init claude-code --strict-profile --policy-mode fail-closed" >&2
    fi
fi

# 6. All checks passed — record guard success and forward to patchwork
mkdir -p "$PATCHWORK_DIR/state" 2>/dev/null
echo '{"status":"ok","ts":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' > "$GUARD_STATUS_FILE"

# Forward stdin to patchwork hook session-start
if [ -n "$_NODE" ]; then
    exec "$_NODE" "$_PW" hook session-start
else
    exec patchwork hook session-start
fi
