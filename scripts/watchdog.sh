#!/bin/bash
# Patchwork Watchdog — verifies audit hooks are installed and reinstalls if missing.
# Runs via macOS LaunchAgent every 30 minutes.

export PATH="$HOME/local/nodejs/node-v22.16.0-darwin-x64/bin:$PATH"
LOG="$HOME/.patchwork/watchdog.log"
SETTINGS="$HOME/.claude/settings.json"

NODE_PATH_PREFIX="PATH=\$HOME/local/nodejs/node-v22.16.0-darwin-x64/bin:\$PATH"

log() {
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $1" >> "$LOG"
}

# After patchwork init reinstalls hooks, patch them to include PATH prefix
# and use the guard script for SessionStart
patch_hooks() {
    python3 - "$SETTINGS" "$NODE_PATH_PREFIX" <<'PYEOF'
import json, sys, re
settings_path = sys.argv[1]
path_prefix = sys.argv[2]

with open(settings_path) as f:
    s = json.load(f)

hooks = s.get("hooks", {})
changed = False

for event, hook_list in hooks.items():
    for hook in hook_list:
        cmd = hook.get("command", "")
        if "patchwork hook" in cmd and path_prefix not in cmd:
            # Add PATH prefix
            hook["command"] = f"{path_prefix} {cmd}"
            changed = True

# Replace SessionStart with guard script
if "SessionStart" in hooks:
    for hook in hooks["SessionStart"]:
        if "patchwork hook session-start" in hook.get("command", ""):
            hook["command"] = "bash ~/.patchwork/guard.sh"
            hook["timeout"] = 1500
            changed = True

if changed:
    with open(settings_path, "w") as f:
        json.dump(s, f, indent=2)
        f.write("\n")

sys.exit(0 if changed else 1)
PYEOF
    if [ $? -eq 0 ]; then
        log "PATCHED: added PATH prefix and guard script to hooks"
    fi
}

# 1. Check patchwork CLI exists
if ! command -v patchwork &>/dev/null; then
    log "CRITICAL: patchwork CLI not found in PATH"
    # Try to re-link
    if [ -d "$HOME/AI/codex-audit/packages/cli" ]; then
        cd "$HOME/AI/codex-audit/packages/cli" && npm link 2>/dev/null
        if command -v patchwork &>/dev/null; then
            log "RECOVERED: re-linked patchwork CLI"
        else
            log "FAILED: could not re-link patchwork CLI"
            exit 1
        fi
    else
        exit 1
    fi
fi

# 2. Check settings.json exists and has patchwork hooks
if [ ! -f "$SETTINGS" ]; then
    log "CRITICAL: $SETTINGS missing — reinstalling hooks"
    patchwork init claude-code --strict-profile --policy-mode fail-closed 2>/dev/null
    patch_hooks
    log "REINSTALLED: hooks written to new settings.json"
    exit 0
fi

# 3. Check hooks are present
if ! grep -q "patchwork hook" "$SETTINGS" 2>/dev/null; then
    log "WARNING: patchwork hooks missing from settings.json — reinstalling"
    patchwork init claude-code --strict-profile --policy-mode fail-closed 2>/dev/null
    patch_hooks
    log "REINSTALLED: hooks restored"
    exit 0
fi

# 4. Check fail-closed is set
if ! grep -q "PATCHWORK_PRETOOL_FAIL_CLOSED=1" "$SETTINGS" 2>/dev/null; then
    log "WARNING: fail-closed not set — reinstalling with strict profile"
    patchwork init claude-code --strict-profile --policy-mode fail-closed 2>/dev/null
    patch_hooks
    log "REINSTALLED: fail-closed restored"
    exit 0
fi

# 4b. Check hooks have PATH prefix (needed on this Intel Mac)
if grep -q "patchwork hook" "$SETTINGS" && ! grep -q "local/nodejs" "$SETTINGS"; then
    log "WARNING: hooks missing PATH prefix — patching"
    patch_hooks
fi

# 5. Check guard script exists
if [ ! -x "$HOME/.patchwork/guard.sh" ]; then
    log "WARNING: guard.sh missing or not executable"
fi

# 6. Check policy exists
if [ ! -f "$HOME/.patchwork/policy.yml" ]; then
    log "WARNING: policy.yml missing — enforcement may be permissive"
fi

# 7. Check audit store is writable
if [ ! -w "$HOME/.patchwork" ]; then
    log "CRITICAL: .patchwork directory not writable"
    exit 1
fi

# 8. Verify Node.js is the right architecture
NODE_ARCH=$(file "$(which node)" 2>/dev/null | grep -o 'x86_64\|arm64')
MACHINE_ARCH=$(uname -m)
if [ "$NODE_ARCH" = "arm64" ] && [ "$MACHINE_ARCH" = "x86_64" ]; then
    log "WARNING: Node.js architecture mismatch (arm64 on x86_64)"
fi

# 9. Check permissions on audit data
EVENTS="$HOME/.patchwork/events.jsonl"
if [ -f "$EVENTS" ]; then
    PERMS=$(stat -f "%Lp" "$EVENTS" 2>/dev/null)
    if [ "$PERMS" != "600" ]; then
        chmod 600 "$EVENTS"
        log "FIXED: events.jsonl permissions corrected to 0600"
    fi
fi

DIR_PERMS=$(stat -f "%Lp" "$HOME/.patchwork" 2>/dev/null)
if [ "$DIR_PERMS" != "700" ]; then
    chmod 700 "$HOME/.patchwork"
    log "FIXED: .patchwork directory permissions corrected to 0700"
fi

# 10. Rotate watchdog log if > 100KB
if [ -f "$LOG" ] && [ "$(stat -f%z "$LOG" 2>/dev/null || echo 0)" -gt 102400 ]; then
    tail -200 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
    log "ROTATED: watchdog log trimmed"
fi

# All checks passed — no log entry needed for routine success
