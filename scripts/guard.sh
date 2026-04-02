#!/bin/bash
# Patchwork session guard — verifies audit system is operational before Claude Code starts.
# Cross-platform: macOS and Linux.

# --- Platform detection ---
PLATFORM="$(uname)"
if [[ "$PLATFORM" == "Darwin" ]]; then
    SYSTEM_POLICY="/Library/Patchwork/policy.yml"
else
    SYSTEM_POLICY="/etc/patchwork/policy.yml"
fi

# --- Platform helpers ---
get_file_perms() {
    if [[ "$PLATFORM" == "Darwin" ]]; then stat -f "%Lp" "$1" 2>/dev/null
    else stat -c "%a" "$1" 2>/dev/null; fi
}

# --- Runtime Node discovery ---
_NODE=""
_PW=""
for _candidate in \
    "$HOME/local/nodejs/"node-*/bin \
    /usr/local/bin \
    /opt/homebrew/bin \
    "$HOME/.nvm/versions/node/"*/bin \
    "$HOME/.volta/bin"; do
    if [ -x "$_candidate/node" ] && [ -x "$_candidate/patchwork" ]; then
        if "$_candidate/node" --version &>/dev/null; then
            _NODE="$_candidate/node"
            _PW="$_candidate/patchwork"
            export PATH="$_candidate:$PATH"
            break
        fi
    fi
done

PATCHWORK_DIR="$HOME/.patchwork"
EVENTS_FILE="$PATCHWORK_DIR/events.jsonl"
GUARD_STATUS_FILE="$PATCHWORK_DIR/state/guard-status.json"

# 1. Check patchwork CLI is available AND executable
if [ -z "$_NODE" ]; then
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

# Store paths for hook-wrapper (0600 — no reason for other users to read these)
mkdir -p "$PATCHWORK_DIR/state" 2>/dev/null
chmod 700 "$PATCHWORK_DIR/state" 2>/dev/null
echo "$_NODE" > "$PATCHWORK_DIR/state/node-path"
echo "$_PW" > "$PATCHWORK_DIR/state/patchwork-path"
chmod 600 "$PATCHWORK_DIR/state/node-path" "$PATCHWORK_DIR/state/patchwork-path" 2>/dev/null

# 2. Check audit store directory exists and is writable
if [ ! -d "$PATCHWORK_DIR" ]; then
    mkdir -p "$PATCHWORK_DIR" 2>/dev/null
fi

if [ ! -w "$PATCHWORK_DIR" ]; then
    echo '{"error": "Patchwork data directory is not writable: '"$PATCHWORK_DIR"'"}' >&2
    echo '{"status":"failed","reason":"store_not_writable","ts":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' > "$GUARD_STATUS_FILE"
    exit 1
fi

# 3. Check for policy (system-level or user-level)
if [ ! -f "$SYSTEM_POLICY" ] && [ ! -f "$PATCHWORK_DIR/policy.yml" ]; then
    echo "[patchwork-guard] Warning: No policy file found" >&2
fi

# 4. Verify permissions on audit data
EVENTS_PERMS=$(get_file_perms "$EVENTS_FILE")
if [ -n "$EVENTS_PERMS" ] && [ "$EVENTS_PERMS" != "600" ]; then
    chmod 600 "$EVENTS_FILE" 2>/dev/null
fi

DIR_PERMS=$(get_file_perms "$PATCHWORK_DIR")
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
echo '{"status":"ok","ts":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' > "$GUARD_STATUS_FILE"
chmod 600 "$GUARD_STATUS_FILE" 2>/dev/null

# Forward stdin to patchwork hook session-start
# Strategy 1: tsx from repo source (most reliable)
REPO_DIR="$HOME/AI/codex-audit"
if [ -d "$REPO_DIR/packages/cli/src" ] && command -v npx &>/dev/null; then
    cd "$REPO_DIR" 2>/dev/null && exec npx --yes tsx packages/cli/src/index.ts hook session-start
fi

# Strategy 2: cached node+patchwork from discovery above
if [ -n "$_NODE" ]; then
    exec "$_NODE" "$_PW" hook session-start
fi

# Strategy 3: bare patchwork (npm global)
exec patchwork hook session-start
