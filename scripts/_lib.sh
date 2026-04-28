#!/bin/bash
# Patchwork system install — shared library functions.
# Cross-platform: macOS (launchctl, chflags) and Linux (systemd, chattr).
# Sourced by system-install.sh, system-add-user.sh, system-remove-user.sh, system-uninstall.sh.

# ---------------------------------------------------------------------------
# Platform detection
# ---------------------------------------------------------------------------
PLATFORM="$(uname)"

if [[ "$PLATFORM" == "Darwin" ]]; then
    SYSTEM_DIR="/Library/Patchwork"
    DAEMON_LABEL="com.patchwork.system-watchdog"
    DAEMON_PLIST="/Library/LaunchDaemons/${DAEMON_LABEL}.plist"
elif [[ "$PLATFORM" == "Linux" ]]; then
    SYSTEM_DIR="/etc/patchwork"
    SYSTEMD_SERVICE="patchwork-watchdog.service"
    SYSTEMD_TIMER="patchwork-watchdog.timer"
    SYSTEMD_DIR="/etc/systemd/system"
else
    echo "Unsupported platform: $PLATFORM"
    exit 1
fi

USERS_CONF="$SYSTEM_DIR/users.conf"

# ---------------------------------------------------------------------------
# Safe home directory resolution (no eval)
# ---------------------------------------------------------------------------
get_user_home() {
    local user="$1"
    if [[ "$PLATFORM" == "Darwin" ]]; then
        dscl . read "/Users/$user" NFSHomeDirectory 2>/dev/null | awk '{print $2}'
    else
        getent passwd "$user" 2>/dev/null | cut -d: -f6
    fi
}

# ---------------------------------------------------------------------------
# Cross-platform helpers
# ---------------------------------------------------------------------------

# Returns root group name ("wheel" on macOS, "root" on Linux)
root_group() {
    if [[ "$PLATFORM" == "Darwin" ]]; then echo "wheel"; else echo "root"; fi
}

# Returns user's primary group
user_group() {
    local user="$1"
    if [[ "$PLATFORM" == "Darwin" ]]; then
        echo "staff"
    else
        id -gn "$user" 2>/dev/null || echo "$user"
    fi
}

# Get file permissions as octal (e.g. "600")
get_file_perms() {
    if [[ "$PLATFORM" == "Darwin" ]]; then
        stat -f "%Lp" "$1" 2>/dev/null
    else
        stat -c "%a" "$1" 2>/dev/null
    fi
}

# Get file owner:group (e.g. "root:wheel")
get_file_owner() {
    if [[ "$PLATFORM" == "Darwin" ]]; then
        stat -f "%Su:%Sg" "$1" 2>/dev/null
    else
        stat -c "%U:%G" "$1" 2>/dev/null
    fi
}

# Get file size in bytes
get_file_size() {
    if [[ "$PLATFORM" == "Darwin" ]]; then
        stat -f%z "$1" 2>/dev/null || echo 0
    else
        stat -c "%s" "$1" 2>/dev/null || echo 0
    fi
}

# Make a file immutable (requires root)
lock_file() {
    local file="$1"
    if [[ "$PLATFORM" == "Darwin" ]]; then
        chflags schg "$file"
    else
        chattr +i "$file" 2>/dev/null || echo "  Warning: chattr +i not supported on this filesystem"
    fi
}

# Remove immutable flag (requires root)
unlock_file() {
    local file="$1"
    if [[ "$PLATFORM" == "Darwin" ]]; then
        chflags noschg "$file" 2>/dev/null || true
    else
        chattr -i "$file" 2>/dev/null || true
    fi
}

# Check if file has immutable flag
is_file_locked() {
    local file="$1"
    if [[ "$PLATFORM" == "Darwin" ]]; then
        local flags
        flags=$(stat -f "%Sf" "$file" 2>/dev/null)
        [[ "$flags" == *"schg"* ]]
    else
        local attrs
        attrs=$(lsattr "$file" 2>/dev/null | cut -d' ' -f1)
        [[ "$attrs" == *"i"* ]]
    fi
}

# ---------------------------------------------------------------------------
# Node.js discovery — works on Intel and Apple Silicon, any user
# ---------------------------------------------------------------------------
find_node_bin() {
    local user="${1:-}"
    local home
    if [[ -n "$user" ]]; then
        home=$(get_user_home "$user")
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
            # Verify node actually runs (correct architecture)
            if "$candidate/node" --version &>/dev/null; then
                echo "$candidate"
                return 0
            fi
        fi
    done
    return 1
}

# ---------------------------------------------------------------------------
# User detection — list all human users (cross-platform)
# ---------------------------------------------------------------------------
list_human_users() {
    if [[ "$PLATFORM" == "Darwin" ]]; then
        dscl . list /Users UniqueID | while read -r user uid; do
            [[ "$uid" -ge 500 ]] 2>/dev/null || continue
            local shell
            shell=$(dscl . read "/Users/$user" UserShell 2>/dev/null | awk '{print $2}')
            [[ "$shell" = "/usr/bin/false" ]] && continue
            [[ "$shell" = "/sbin/nologin" ]] && continue
            local home
            home=$(get_user_home "$user")
            [[ -d "$home" ]] || continue
            echo "$user"
        done
    else
        # Linux: parse /etc/passwd via getent
        getent passwd | awk -F: '{
            if ($3 >= 1000 && $3 != 65534 && $7 !~ /nologin|false/) print $1
        }' | while read -r user; do
            local home
            home=$(get_user_home "$user")
            [[ -d "$home" ]] || continue
            echo "$user"
        done
    fi
}

# ---------------------------------------------------------------------------
# User registry — users.conf management
# ---------------------------------------------------------------------------
add_to_registry() {
    local user="$1"
    if [[ ! -f "$USERS_CONF" ]]; then
        echo "# Patchwork enrolled users — one per line" > "$USERS_CONF"
        chown "root:$(root_group)" "$USERS_CONF"
        chmod 644 "$USERS_CONF"
    fi
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
        chown "root:$(root_group)" "$USERS_CONF"
        chmod 644 "$USERS_CONF"
    fi
}

list_enrolled_users() {
    if [[ ! -f "$USERS_CONF" ]]; then return; fi
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
    home=$(get_user_home "$user")

    local claude_dir="$home/.claude"
    local settings="$claude_dir/settings.json"
    local patchwork_dir="$home/.patchwork"

    # Ensure directories exist
    sudo -u "$user" mkdir -p "$claude_dir" 2>/dev/null || mkdir -p "$claude_dir"
    sudo -u "$user" mkdir -p "$patchwork_dir" 2>/dev/null || mkdir -p "$patchwork_dir"
    sudo -u "$user" mkdir -p "$patchwork_dir/state" 2>/dev/null || true
    sudo -u "$user" mkdir -p "$patchwork_dir/db" 2>/dev/null || true
    chmod 700 "$patchwork_dir" 2>/dev/null || true

    # Temporarily unlock if already locked
    unlock_file "$settings"
    chown "$user:$(user_group "$user")" "$settings" 2>/dev/null || true

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
import json, sys, re

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

PATCHWORK_RE = re.compile(r'\bpatchwork hook\b|hook-wrapper\.sh|guard\.sh')

for event, hook_defs in desired.items():
    existing = hooks.get(event, [])
    cleaned = [h for h in existing if not (isinstance(h.get("command"), str) and PATCHWORK_RE.search(h["command"]))]
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
# Settings.json baseline (v2 hash-baseline tamper detection)
# ---------------------------------------------------------------------------
# v2 model: settings.json stays user-owned and writable so Claude Code can
# read it normally. Tampering is detected via SHA-256 baseline comparison
# in the system watchdog. See scripts/system-watchdog.sh.
record_settings_baseline() {
    local user="$1"
    local home settings baseline_dir baseline_file hash
    home=$(get_user_home "$user")
    settings="$home/.claude/settings.json"
    baseline_dir="$SYSTEM_DIR/baselines"
    baseline_file="$baseline_dir/$user.sha256"

    if [[ ! -f "$settings" ]]; then
        echo "  [$user] WARN: settings.json missing — skipping baseline"
        return 1
    fi

    mkdir -p "$baseline_dir" 2>/dev/null || true
    chmod 700 "$baseline_dir" 2>/dev/null || true
    chown "root:$(root_group)" "$baseline_dir" 2>/dev/null || true

    hash=$(shasum -a 256 "$settings" 2>/dev/null | awk '{print $1}')
    if [[ -z "$hash" ]]; then
        echo "  [$user] ERROR: failed to compute settings.json hash"
        return 1
    fi

    echo "$hash" > "$baseline_file"
    chmod 600 "$baseline_file"
    chown "root:$(root_group)" "$baseline_file"
    echo "  [$user] settings.json baseline recorded ($hash)"
}

clear_settings_baseline() {
    local user="$1"
    local baseline_file="$SYSTEM_DIR/baselines/$user.sha256"
    if [[ -f "$baseline_file" ]]; then
        rm -f "$baseline_file"
        echo "  [$user] settings.json baseline cleared"
    fi
}

# ---------------------------------------------------------------------------
# Settings.json locking / unlocking
# ---------------------------------------------------------------------------
# DEPRECATED (v1 model): lock_user_settings made settings.json root-owned and
# immutable (chflags schg / chattr +i). This broke Claude Code's ability to
# read the file. v2 uses record_settings_baseline above. Kept for migration
# compatibility — unlock_user_settings is still used by teardown to clear any
# legacy v1 immutable flag.
lock_user_settings() {
    local user="$1"
    local home
    home=$(get_user_home "$user")
    local settings="$home/.claude/settings.json"

    if [[ -f "$settings" ]]; then
        chown "root:$(root_group)" "$settings"
        chmod 644 "$settings"
        lock_file "$settings"
        echo "  [$user] settings.json locked (root:$(root_group), immutable)"
    fi
}

unlock_user_settings() {
    local user="$1"
    local home
    home=$(get_user_home "$user")
    local settings="$home/.claude/settings.json"

    if [[ -f "$settings" ]]; then
        unlock_file "$settings"
        chown "$user:$(user_group "$user")" "$settings" 2>/dev/null || true
        chmod 644 "$settings"
        echo "  [$user] settings.json unlocked"
    fi
}

# ---------------------------------------------------------------------------
# Daemon install / uninstall (cross-platform)
# ---------------------------------------------------------------------------
install_system_daemon() {
    local watchdog_script="$SYSTEM_DIR/system-watchdog.sh"
    local repo_dir="${PATCHWORK_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

    if [[ "$PLATFORM" == "Darwin" ]]; then
        # macOS: copy LaunchDaemon plist template
        local plist_template="$repo_dir/scripts/com.patchwork.system-watchdog.plist"
        if [[ ! -f "$plist_template" ]]; then
            echo "  ERROR: plist template not found at $plist_template"
            return 1
        fi
        cp "$plist_template" "$DAEMON_PLIST"
        chown "root:$(root_group)" "$DAEMON_PLIST"
        chmod 644 "$DAEMON_PLIST"
        launchctl unload "$DAEMON_PLIST" 2>/dev/null || true
        launchctl load "$DAEMON_PLIST"

    elif [[ "$PLATFORM" == "Linux" ]]; then
        # Linux: systemd service + timer
        cat > "$SYSTEMD_DIR/$SYSTEMD_SERVICE" <<SERVICE
[Unit]
Description=Patchwork System Watchdog
After=network.target

[Service]
Type=oneshot
ExecStart=/bin/bash $watchdog_script
StandardOutput=journal
StandardError=journal
SERVICE

        cat > "$SYSTEMD_DIR/$SYSTEMD_TIMER" <<TIMER
[Unit]
Description=Patchwork System Watchdog Timer

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Persistent=true

[Install]
WantedBy=timers.target
TIMER

        systemctl daemon-reload
        systemctl enable --now "$SYSTEMD_TIMER"
    fi
}

uninstall_system_daemon() {
    if [[ "$PLATFORM" == "Darwin" ]]; then
        if [[ -f "$DAEMON_PLIST" ]]; then
            launchctl unload "$DAEMON_PLIST" 2>/dev/null || true
            rm -f "$DAEMON_PLIST"
            echo "  Removed: $DAEMON_PLIST"
        fi
    elif [[ "$PLATFORM" == "Linux" ]]; then
        systemctl disable --now "$SYSTEMD_TIMER" 2>/dev/null || true
        rm -f "$SYSTEMD_DIR/$SYSTEMD_SERVICE" "$SYSTEMD_DIR/$SYSTEMD_TIMER"
        systemctl daemon-reload 2>/dev/null || true
        echo "  Removed: systemd units"
    fi
}

# ---------------------------------------------------------------------------
# Full per-user setup / teardown
# ---------------------------------------------------------------------------
setup_user() {
    local user="$1"
    local home
    home=$(get_user_home "$user")

    if [[ ! -d "$home" ]]; then
        echo "  [$user] SKIP — home directory not found: $home"
        return 1
    fi

    install_user_hooks "$user"
    record_settings_baseline "$user"
    add_to_registry "$user"
    return 0
}

teardown_user() {
    local user="$1"
    unlock_user_settings "$user"
    clear_settings_baseline "$user"
    remove_from_registry "$user"

    # Remove user-level daemon/agent
    if [[ "$PLATFORM" == "Darwin" ]]; then
        local user_agent
        user_agent=$(get_user_home "$user")/Library/LaunchAgents/com.patchwork.watchdog.plist
        if [[ -f "$user_agent" ]]; then
            sudo -u "$user" launchctl unload "$user_agent" 2>/dev/null || true
            rm -f "$user_agent"
            echo "  [$user] Removed user LaunchAgent"
        fi
    elif [[ "$PLATFORM" == "Linux" ]]; then
        local user_home
        user_home=$(get_user_home "$user")
        local user_timer="$user_home/.config/systemd/user/patchwork-watchdog.timer"
        if [[ -f "$user_timer" ]]; then
            sudo -u "$user" systemctl --user disable --now patchwork-watchdog.timer 2>/dev/null || true
            rm -f "$user_home/.config/systemd/user/patchwork-watchdog."{service,timer}
            echo "  [$user] Removed user systemd units"
        fi
    fi
}
