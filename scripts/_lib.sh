#!/bin/bash
# Patchwork system install — shared library functions.
# Sourced by system-install.sh, system-add-user.sh, system-remove-user.sh, system-uninstall.sh.

SYSTEM_DIR="/Library/Patchwork"
USERS_CONF="$SYSTEM_DIR/users.conf"
DAEMON_LABEL="com.patchwork.system-watchdog"
DAEMON_PLIST="/Library/LaunchDaemons/${DAEMON_LABEL}.plist"

# ---------------------------------------------------------------------------
# Node.js discovery — works on Intel and Apple Silicon, any user
# ---------------------------------------------------------------------------
find_node_bin() {
    local user="${1:-}"
    local home
    if [[ -n "$user" ]]; then
        home=$(eval echo "~$user")
    else
        home="$HOME"
    fi

    for candidate in \
        "$home/local/nodejs/"node-*/bin \
        /usr/local/bin \
        /opt/homebrew/bin \
        "$home/.nvm/versions/node/"*/bin \
        "$home/.volta/bin" \
        "$home/.fnm/node-versions/"*/installation/bin; do
        if [[ -x "$candidate/node" ]]; then
            echo "$candidate"
            return 0
        fi
    done
    return 1
}

# ---------------------------------------------------------------------------
# User detection — list all human users on macOS (UID >= 500, real shell)
# ---------------------------------------------------------------------------
list_human_users() {
    dscl . list /Users UniqueID | while read -r user uid; do
        [[ "$uid" -ge 500 ]] 2>/dev/null || continue
        local shell
        shell=$(dscl . read "/Users/$user" UserShell 2>/dev/null | awk '{print $2}')
        [[ "$shell" = "/usr/bin/false" ]] && continue
        [[ "$shell" = "/sbin/nologin" ]] && continue
        local home
        home=$(eval echo "~$user" 2>/dev/null)
        [[ -d "$home" ]] || continue
        echo "$user"
    done
}

# ---------------------------------------------------------------------------
# User registry — /Library/Patchwork/users.conf management
# ---------------------------------------------------------------------------
add_to_registry() {
    local user="$1"
    # Create if not exists
    if [[ ! -f "$USERS_CONF" ]]; then
        echo "# Patchwork enrolled users — one per line" > "$USERS_CONF"
        chown root:wheel "$USERS_CONF"
        chmod 644 "$USERS_CONF"
    fi
    # Add if not already present
    if ! grep -qx "$user" "$USERS_CONF" 2>/dev/null; then
        echo "$user" >> "$USERS_CONF"
    fi
}

remove_from_registry() {
    local user="$1"
    if [[ -f "$USERS_CONF" ]]; then
        local tmp="$USERS_CONF.tmp.$$"
        grep -vx "$user" "$USERS_CONF" > "$tmp" || true
        mv "$tmp" "$USERS_CONF"
        chown root:wheel "$USERS_CONF"
        chmod 644 "$USERS_CONF"
    fi
}

list_enrolled_users() {
    if [[ ! -f "$USERS_CONF" ]]; then
        return
    fi
    while IFS= read -r line; do
        [[ -z "$line" || "$line" == \#* ]] && continue
        echo "$line"
    done < "$USERS_CONF"
}

# ---------------------------------------------------------------------------
# Per-user hook installation
# ---------------------------------------------------------------------------
install_user_hooks() {
    local user="$1"
    local home
    home=$(eval echo "~$user")

    local claude_dir="$home/.claude"
    local settings="$claude_dir/settings.json"
    local patchwork_dir="$home/.patchwork"

    # Ensure directories exist (as the target user)
    sudo -u "$user" mkdir -p "$claude_dir" 2>/dev/null || mkdir -p "$claude_dir"
    sudo -u "$user" mkdir -p "$patchwork_dir" 2>/dev/null || mkdir -p "$patchwork_dir"
    sudo -u "$user" mkdir -p "$patchwork_dir/state" 2>/dev/null || true
    sudo -u "$user" mkdir -p "$patchwork_dir/db" 2>/dev/null || true
    chmod 700 "$patchwork_dir" 2>/dev/null || true

    # Temporarily unlock if already locked
    chflags noschg "$settings" 2>/dev/null || true
    chown "$user:staff" "$settings" 2>/dev/null || true

    # Try to install hooks via patchwork CLI
    local node_bin
    node_bin=$(find_node_bin "$user") || true

    if [[ -n "$node_bin" && -x "$node_bin/patchwork" ]]; then
        sudo -u "$user" PATH="$node_bin:$PATH" "$node_bin/patchwork" \
            init claude-code --strict-profile --policy-mode fail-closed 2>/dev/null || true
    fi

    # Patch hooks to use the shared hook-wrapper and guard
    if [[ -f "$settings" ]]; then
        python3 - "$settings" "$SYSTEM_DIR" <<'PYEOF'
import json, sys

settings_path = sys.argv[1]
system_dir = sys.argv[2]
wrapper = f"bash {system_dir}/hook-wrapper.sh"
guard = f"bash {system_dir}/guard.sh"

try:
    with open(settings_path) as f:
        s = json.load(f)
except (json.JSONDecodeError, FileNotFoundError):
    s = {}

hooks = s.get("hooks", {})

# Define desired hook configuration
desired = {
    "PreToolUse": [{
        "type": "command",
        "command": f"PATCHWORK_PRETOOL_FAIL_CLOSED=1 PATCHWORK_PRETOOL_WARN_MS=500 PATCHWORK_PRETOOL_TELEMETRY_JSON=1 {wrapper} pre-tool",
        "timeout": 1500,
    }],
    "PostToolUse": [{"type": "command", "command": f"{wrapper} post-tool", "timeout": 1000}],
    "PostToolUseFailure": [{"type": "command", "command": f"{wrapper} post-tool-failure", "timeout": 1000}],
    "SessionStart": [{"type": "command", "command": guard, "timeout": 1500}],
    "SessionEnd": [{"type": "command", "command": f"{wrapper} session-end", "timeout": 500}],
    "UserPromptSubmit": [{"type": "command", "command": f"{wrapper} prompt-submit", "timeout": 500}],
    "SubagentStart": [{"type": "command", "command": f"{wrapper} subagent-start", "timeout": 500}],
    "SubagentStop": [{"type": "command", "command": f"{wrapper} subagent-stop", "timeout": 500}],
}

import re
PATCHWORK_RE = re.compile(r'\bpatchwork hook\b|hook-wrapper\.sh|guard\.sh')

for event, hook_defs in desired.items():
    existing = hooks.get(event, [])
    # Remove any existing patchwork hooks
    cleaned = [h for h in existing if not (isinstance(h.get("command"), str) and PATCHWORK_RE.search(h["command"]))]
    # Add desired hooks
    hooks[event] = cleaned + hook_defs

s["hooks"] = hooks

with open(settings_path, "w") as f:
    json.dump(s, f, indent=2)
    f.write("\n")
PYEOF
    fi

    echo "  [$user] Hooks installed"
}

# ---------------------------------------------------------------------------
# Settings.json locking / unlocking
# ---------------------------------------------------------------------------
lock_user_settings() {
    local user="$1"
    local home
    home=$(eval echo "~$user")
    local settings="$home/.claude/settings.json"

    if [[ -f "$settings" ]]; then
        chown root:wheel "$settings"
        chmod 644 "$settings"
        chflags schg "$settings"
        echo "  [$user] settings.json locked (root:wheel, schg)"
    fi
}

unlock_user_settings() {
    local user="$1"
    local home
    home=$(eval echo "~$user")
    local settings="$home/.claude/settings.json"

    if [[ -f "$settings" ]]; then
        chflags noschg "$settings" 2>/dev/null || true
        chown "$user:staff" "$settings" 2>/dev/null || true
        chmod 644 "$settings"
        echo "  [$user] settings.json unlocked"
    fi
}

# ---------------------------------------------------------------------------
# Full per-user setup (install + lock + register)
# ---------------------------------------------------------------------------
setup_user() {
    local user="$1"
    local home
    home=$(eval echo "~$user")

    if [[ ! -d "$home" ]]; then
        echo "  [$user] SKIP — home directory not found: $home"
        return 1
    fi

    install_user_hooks "$user"
    lock_user_settings "$user"
    add_to_registry "$user"
    return 0
}

# ---------------------------------------------------------------------------
# Full per-user teardown (unlock + unregister)
# ---------------------------------------------------------------------------
teardown_user() {
    local user="$1"
    unlock_user_settings "$user"
    remove_from_registry "$user"

    # Remove user-level LaunchAgent if present
    local user_agent
    user_agent=$(eval echo "~$user")/Library/LaunchAgents/com.patchwork.watchdog.plist
    if [[ -f "$user_agent" ]]; then
        sudo -u "$user" launchctl unload "$user_agent" 2>/dev/null || true
        rm -f "$user_agent"
        echo "  [$user] Removed user LaunchAgent"
    fi
}
