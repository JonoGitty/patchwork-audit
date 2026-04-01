#!/bin/bash
# Patchwork Watchdog — verifies audit hooks are installed and reinstalls if missing.
# Cross-platform: macOS (LaunchAgent) and Linux (systemd user timer).
# Runs every 5 minutes + on settings.json change.

PLATFORM="$(uname)"
LOG="$HOME/.patchwork/watchdog.log"
SETTINGS="$HOME/.claude/settings.json"

# --- Platform helpers ---
get_file_perms() {
    if [[ "$PLATFORM" == "Darwin" ]]; then stat -f "%Lp" "$1" 2>/dev/null
    else stat -c "%a" "$1" 2>/dev/null; fi
}

get_file_size() {
    if [[ "$PLATFORM" == "Darwin" ]]; then stat -f%z "$1" 2>/dev/null || echo 0
    else stat -c "%s" "$1" 2>/dev/null || echo 0; fi
}

# --- Find working node + patchwork ---
NODE_BIN=""
PATCHWORK_BIN=""
for _candidate in \
    "$HOME/local/nodejs/"node-*/bin \
    /usr/local/bin \
    /opt/homebrew/bin \
    "$HOME/.nvm/versions/node/"*/bin \
    "$HOME/.volta/bin"; do
    if [[ -x "$_candidate/node" ]] && [[ -x "$_candidate/patchwork" ]]; then
        if "$_candidate/node" --version &>/dev/null; then
            NODE_BIN="$_candidate/node"
            PATCHWORK_BIN="$_candidate/patchwork"
            export PATH="$_candidate:$PATH"
            break
        fi
    fi
done

GUARD_SCRIPT="$HOME/AI/codex-audit/scripts/guard.sh"

log() {
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $1" >> "$LOG"
}

# Write correct hooks with explicit node + patchwork paths
write_hooks() {
    python3 - "$SETTINGS" "$NODE_BIN" "$PATCHWORK_BIN" "$GUARD_SCRIPT" <<'PYEOF'
import json, sys

settings_path = sys.argv[1]
node_bin = sys.argv[2]
patchwork_bin = sys.argv[3]
guard_script = sys.argv[4]
run = f"{node_bin} {patchwork_bin}"

try:
    with open(settings_path) as f:
        s = json.load(f)
except (json.JSONDecodeError, FileNotFoundError):
    s = {}

s["hooks"] = {
    "PreToolUse": [{
        "type": "command",
        "command": f"PATCHWORK_PRETOOL_FAIL_CLOSED=1 PATCHWORK_PRETOOL_WARN_MS=500 PATCHWORK_PRETOOL_TELEMETRY_JSON=1 {run} hook pre-tool",
        "timeout": 1500,
    }],
    "PostToolUse": [{"type": "command", "command": f"{run} hook post-tool", "timeout": 1000}],
    "PostToolUseFailure": [{"type": "command", "command": f"{run} hook post-tool-failure", "timeout": 1000}],
    "SessionStart": [{"type": "command", "command": f"bash {guard_script}", "timeout": 1500}],
    "SessionEnd": [{"type": "command", "command": f"{run} hook session-end", "timeout": 500}],
    "UserPromptSubmit": [{"type": "command", "command": f"{run} hook prompt-submit", "timeout": 500}],
    "SubagentStart": [{"type": "command", "command": f"{run} hook subagent-start", "timeout": 500}],
    "SubagentStop": [{"type": "command", "command": f"{run} hook subagent-stop", "timeout": 500}],
}

with open(settings_path, "w") as f:
    json.dump(s, f, indent=2)
    f.write("\n")
PYEOF
}

# 1. Check patchwork CLI exists
if [[ -z "$PATCHWORK_BIN" ]]; then
    log "CRITICAL: patchwork binary not found"
    if [[ -d "$HOME/AI/codex-audit/packages/cli" ]]; then
        cd "$HOME/AI/codex-audit/packages/cli" && npm link 2>/dev/null
        log "Attempted re-link"
    fi
    exit 1
fi

# 2. Check settings.json exists
if [[ ! -f "$SETTINGS" ]]; then
    log "CRITICAL: $SETTINGS missing — writing hooks"
    mkdir -p "$(dirname "$SETTINGS")"
    write_hooks
    log "REINSTALLED: hooks written"
    exit 0
fi

# 3. Check hooks use correct node path
if ! grep -q "$PATCHWORK_BIN" "$SETTINGS" 2>/dev/null; then
    log "WARNING: hooks missing or wrong path — rewriting"
    write_hooks
    log "REINSTALLED: hooks rewritten"
    exit 0
fi

# 4. Check fail-closed
if ! grep -q "PATCHWORK_PRETOOL_FAIL_CLOSED=1" "$SETTINGS" 2>/dev/null; then
    log "WARNING: fail-closed not set — rewriting"
    write_hooks
    log "REINSTALLED: fail-closed restored"
    exit 0
fi

# 5. Check guard script exists
if [[ ! -f "$GUARD_SCRIPT" ]]; then
    log "WARNING: guard.sh not found at $GUARD_SCRIPT"
fi

# 6. Check policy
if [[ ! -f "$HOME/.patchwork/policy.yml" ]] && [[ ! -f "/Library/Patchwork/policy.yml" ]] && [[ ! -f "/etc/patchwork/policy.yml" ]]; then
    log "WARNING: no policy file found"
fi

# 7. Check audit store
if [[ ! -w "$HOME/.patchwork" ]]; then
    log "CRITICAL: .patchwork directory not writable"
    exit 1
fi

# 8. Check permissions
EVENTS="$HOME/.patchwork/events.jsonl"
if [[ -f "$EVENTS" ]]; then
    PERMS=$(get_file_perms "$EVENTS")
    if [[ "$PERMS" != "600" ]]; then
        chmod 600 "$EVENTS"
        log "FIXED: events.jsonl permissions"
    fi
fi

DIR_PERMS=$(get_file_perms "$HOME/.patchwork")
if [[ "$DIR_PERMS" != "700" ]]; then
    chmod 700 "$HOME/.patchwork"
    log "FIXED: .patchwork directory permissions"
fi

# 9. Rotate log if > 100KB
if [[ -f "$LOG" ]] && [[ "$(get_file_size "$LOG")" -gt 102400 ]]; then
    tail -200 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
    log "ROTATED: watchdog log trimmed"
fi
