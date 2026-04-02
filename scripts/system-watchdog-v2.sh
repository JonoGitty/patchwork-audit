#!/bin/bash
# Patchwork System Watchdog v2 — hash-baseline approach.
# Runs as root via LaunchDaemon. Monitors Claude Code settings
# and repairs hooks if tampered, WITHOUT making the file immutable.
#
# Key change from v1: settings.json stays user-owned so Claude Code
# can read and trust the hooks. Tamper detection via SHA-256 baseline.

set -euo pipefail

TARGET_USER="${1:-}"
if [[ -z "$TARGET_USER" ]]; then
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) ERROR: No target user specified"
    exit 1
fi

USER_HOME=$(eval echo "~$TARGET_USER")
CLAUDE_SETTINGS="$USER_HOME/.claude/settings.json"
SYSTEM_DIR="/Library/Patchwork"
BASELINE_FILE="$SYSTEM_DIR/settings-baseline.sha256"
TAMPER_LOG="$SYSTEM_DIR/tamper.log"
NODE_BIN=""

# Find Node.js
for candidate in \
    "$USER_HOME/local/nodejs/"node-*/bin/node \
    /usr/local/bin/node \
    /opt/homebrew/bin/node; do
    if [[ -x "$candidate" ]]; then
        NODE_BIN="$(dirname "$candidate")"
        break
    fi
done

log() {
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [$TARGET_USER] $1"
}

tamper_alert() {
    local reason="$1"
    local ts
    ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "$ts TAMPER: $reason" >> "$TAMPER_LOG"
    log "TAMPER DETECTED: $reason"
    # Future: webhook alert here
}

compute_hash() {
    shasum -a 256 "$1" 2>/dev/null | awk '{print $1}'
}

record_baseline() {
    local hash
    hash="$(compute_hash "$CLAUDE_SETTINGS")"
    echo "$hash" > "$BASELINE_FILE"
    chmod 600 "$BASELINE_FILE"
    chown root:wheel "$BASELINE_FILE"
    log "BASELINE: recorded $hash"
}

reinstall_hooks() {
    log "REINSTALLING: hooks into settings.json"
    if [[ -n "$NODE_BIN" ]]; then
        sudo -u "$TARGET_USER" PATH="$NODE_BIN:$PATH" patchwork init claude-code \
            --strict-profile --policy-mode fail-closed 2>/dev/null || true
    fi
    # Ensure correct ownership (user, NOT root)
    chown "$TARGET_USER:staff" "$CLAUDE_SETTINGS" 2>/dev/null
    chmod 644 "$CLAUDE_SETTINGS" 2>/dev/null
    # Record new baseline
    record_baseline
    log "REINSTALLED: hooks restored, baseline updated"
}

# --- Checks ---

# 1. Ensure settings.json exists
if [[ ! -f "$CLAUDE_SETTINGS" ]]; then
    log "CRITICAL: settings.json missing — recreating"
    sudo -u "$TARGET_USER" mkdir -p "$USER_HOME/.claude"
    reinstall_hooks
    exit 0
fi

# 2. Ensure settings.json is user-owned (NOT root — this is the v2 change)
OWNER=$(stat -f "%Su:%Sg" "$CLAUDE_SETTINGS" 2>/dev/null)
if [[ "$OWNER" != "$TARGET_USER:staff" ]]; then
    log "WARNING: settings.json owned by $OWNER — fixing to $TARGET_USER:staff"
    chflags noschg "$CLAUDE_SETTINGS" 2>/dev/null || true
    chown "$TARGET_USER:staff" "$CLAUDE_SETTINGS"
    chmod 644 "$CLAUDE_SETTINGS"
    record_baseline
fi

# 3. Remove immutable flag if present (legacy cleanup)
FLAGS=$(stat -f "%Sf" "$CLAUDE_SETTINGS" 2>/dev/null)
if [[ "$FLAGS" == *"schg"* ]]; then
    log "WARNING: removing legacy schg flag from settings.json"
    chflags noschg "$CLAUDE_SETTINGS"
fi

# 4. Check patchwork hooks are present
if ! grep -q "hook-wrapper.sh\|patchwork hook" "$CLAUDE_SETTINGS" 2>/dev/null; then
    tamper_alert "hooks missing from settings.json"
    reinstall_hooks
    exit 0
fi

# 5. Hash-baseline verification
if [[ -f "$BASELINE_FILE" ]]; then
    EXPECTED=$(cat "$BASELINE_FILE" 2>/dev/null)
    ACTUAL=$(compute_hash "$CLAUDE_SETTINGS")
    if [[ "$EXPECTED" != "$ACTUAL" ]]; then
        # Settings changed — check if hooks are still intact
        if grep -q "hook-wrapper.sh\|patchwork hook" "$CLAUDE_SETTINGS" 2>/dev/null; then
            # Hooks still there, just other changes — update baseline silently
            record_baseline
        else
            tamper_alert "settings.json modified and hooks removed (hash mismatch)"
            reinstall_hooks
        fi
    fi
else
    # No baseline yet — record one
    record_baseline
fi

# 6. Check system policy exists
if [[ ! -f "$SYSTEM_DIR/policy.yml" ]]; then
    log "WARNING: system policy missing at $SYSTEM_DIR/policy.yml"
fi

# 7. Check system policy ownership
if [[ -f "$SYSTEM_DIR/policy.yml" ]]; then
    POWNER=$(stat -f "%Su:%Sg" "$SYSTEM_DIR/policy.yml" 2>/dev/null)
    if [[ "$POWNER" != "root:wheel" ]]; then
        log "WARNING: policy.yml owned by $POWNER — fixing"
        chown root:wheel "$SYSTEM_DIR/policy.yml"
        chmod 644 "$SYSTEM_DIR/policy.yml"
    fi
fi

# 8. Verify user audit data directory permissions
USER_PW="$USER_HOME/.patchwork"
if [[ -d "$USER_PW" ]]; then
    DIR_PERMS=$(stat -f "%Lp" "$USER_PW" 2>/dev/null)
    if [[ "$DIR_PERMS" != "700" ]]; then
        chmod 700 "$USER_PW"
        log "FIXED: .patchwork directory permissions to 0700"
    fi
fi

# 9. Protect system scripts with immutable flag (these SHOULD be locked)
for sysfile in "$SYSTEM_DIR/system-watchdog.sh" "$SYSTEM_DIR/policy.yml"; do
    if [[ -f "$sysfile" ]]; then
        SFLAGS=$(stat -f "%Sf" "$sysfile" 2>/dev/null)
        if [[ "$SFLAGS" != *"schg"* ]]; then
            chflags schg "$sysfile" 2>/dev/null
        fi
    fi
done

# 10. Store paths for hook-wrapper (so hooks resolve fast)
mkdir -p "$USER_HOME/.patchwork/state" 2>/dev/null
if [[ -n "$NODE_BIN" ]]; then
    echo "$NODE_BIN/node" > "$USER_HOME/.patchwork/state/node-path"
    PW_BIN="$NODE_BIN/patchwork"
    if [[ -x "$PW_BIN" ]] || [[ -f "$PW_BIN" ]]; then
        echo "$PW_BIN" > "$USER_HOME/.patchwork/state/patchwork-path"
    fi
fi

# 11. Check relay daemon health
RELAY_PID_FILE="$SYSTEM_DIR/relay.pid"
RELAY_SOCKET="$SYSTEM_DIR/relay.sock"
RELAY_LOG="$SYSTEM_DIR/events.relay.jsonl"

if [[ -f "$RELAY_PID_FILE" ]]; then
    RELAY_PID=$(cat "$RELAY_PID_FILE" 2>/dev/null)
    if [[ -n "$RELAY_PID" ]] && ! kill -0 "$RELAY_PID" 2>/dev/null; then
        log "WARNING: relay daemon not running (stale PID $RELAY_PID)"
        # Try to restart via launchd
        RELAY_PLIST="/Library/LaunchDaemons/com.patchwork.relay.plist"
        if [[ -f "$RELAY_PLIST" ]]; then
            launchctl unload "$RELAY_PLIST" 2>/dev/null || true
            launchctl load -w "$RELAY_PLIST" 2>/dev/null || true
            log "RESTARTED: relay daemon via launchctl"
        fi
    fi
fi

if [[ -f "$RELAY_LOG" ]]; then
    # Check relay log permissions (should be root-owned)
    RELAY_OWNER=$(stat -f "%Su:%Sg" "$RELAY_LOG" 2>/dev/null)
    if [[ "$RELAY_OWNER" != "root:wheel" ]]; then
        log "WARNING: relay log owned by $RELAY_OWNER — fixing"
        chown root:wheel "$RELAY_LOG"
        chmod 644 "$RELAY_LOG"
    fi
fi

# 12. Rotate logs if > 500KB
for logfile in "$SYSTEM_DIR/watchdog.log" "$TAMPER_LOG"; do
    if [[ -f "$logfile" ]] && [[ "$(stat -f%z "$logfile" 2>/dev/null || echo 0)" -gt 512000 ]]; then
        tail -500 "$logfile" > "$logfile.tmp" && mv "$logfile.tmp" "$logfile"
        log "ROTATED: $(basename "$logfile") trimmed"
    fi
done

log "OK: all checks passed"
