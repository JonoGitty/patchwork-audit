#!/bin/bash
set -euo pipefail

# Patchwork System Install — multi-user tamper-proof audit enforcement.
#
# Must be run with sudo by an admin. After installation:
# - Enrolled users cannot remove or modify audit hooks
# - Enrolled users cannot weaken the security policy
# - Enrolled users cannot unload the watchdog daemon
# - The AI agent cannot disable its own monitoring
#
# Usage:
#   sudo bash scripts/system-install.sh                        # current user only
#   sudo bash scripts/system-install.sh --user alice           # specific user
#   sudo bash scripts/system-install.sh --users alice,bob      # multiple users
#   sudo bash scripts/system-install.sh --all-users            # all human users on this Mac
#   sudo bash scripts/system-install.sh --all-users --policy custom.yml

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="${PATCHWORK_REPO:-$(cd "$SCRIPT_DIR/.." && pwd)}"

# shellcheck source=_lib.sh
source "$SCRIPT_DIR/_lib.sh"

# --- Defaults ---
USER_LIST=""
ALL_USERS=false
CUSTOM_POLICY=""

# --- Parse args ---
while [[ $# -gt 0 ]]; do
    case "$1" in
        --user) USER_LIST="$2"; shift 2 ;;
        --users) USER_LIST="$2"; shift 2 ;;
        --all-users) ALL_USERS=true; shift ;;
        --policy) CUSTOM_POLICY="$2"; shift 2 ;;
        --help|-h)
            cat <<HELP
Usage: sudo bash $0 [OPTIONS]

Install Patchwork system-level enforcement for one or more users.

Options:
  --user USERNAME         Single user (default: \$SUDO_USER)
  --users user1,user2     Comma-separated list of users
  --all-users             Auto-detect all human users on this Mac
  --policy PATH           Custom policy file (default: docs/default-policy.yml)
  -h, --help              Show this help

Examples:
  sudo bash $0                          # install for current user
  sudo bash $0 --all-users              # install for everyone
  sudo bash $0 --users alice,bob,charlie

After installation, manage users with:
  sudo bash scripts/system-add-user.sh --user newuser
  sudo bash scripts/system-remove-user.sh --user olduser
  sudo bash scripts/system-uninstall.sh
HELP
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# --- Validation ---
if [[ $EUID -ne 0 ]]; then
    echo "Error: This script must be run with sudo."
    echo "  sudo bash $0"
    exit 1
fi

# --- Resolve user list ---
USERS=()
if $ALL_USERS; then
    while IFS= read -r u; do
        USERS+=("$u")
    done < <(list_human_users)
elif [[ -n "$USER_LIST" ]]; then
    IFS=',' read -ra USERS <<< "$USER_LIST"
else
    # Default to SUDO_USER
    DEFAULT_USER="${SUDO_USER:-$(logname 2>/dev/null || echo "")}"
    if [[ -z "$DEFAULT_USER" ]]; then
        echo "Error: Cannot determine target user. Use --user, --users, or --all-users."
        exit 1
    fi
    USERS=("$DEFAULT_USER")
fi

if [[ ${#USERS[@]} -eq 0 ]]; then
    echo "Error: No users found."
    exit 1
fi

echo "=== Patchwork System Install ==="
echo "  Users:       ${USERS[*]}"
echo "  System dir:  $SYSTEM_DIR"
echo ""

# --- Step 1: Create system directory ---
echo "[1/5] Creating $SYSTEM_DIR..."
mkdir -p "$SYSTEM_DIR"
chown "root:$(root_group)" "$SYSTEM_DIR"
chmod 755 "$SYSTEM_DIR"

# --- Step 2: Install shared assets (policy, guard, hook-wrapper) ---
echo "[2/5] Installing shared assets..."

# Policy
POLICY_SRC=""
if [[ -n "$CUSTOM_POLICY" && -f "$CUSTOM_POLICY" ]]; then
    POLICY_SRC="$CUSTOM_POLICY"
elif [[ -f "$REPO_DIR/docs/default-policy.yml" ]]; then
    POLICY_SRC="$REPO_DIR/docs/default-policy.yml"
fi

if [[ -n "$POLICY_SRC" ]]; then
    cp "$POLICY_SRC" "$SYSTEM_DIR/policy.yml"
    chown "root:$(root_group)" "$SYSTEM_DIR/policy.yml"
    chmod 644 "$SYSTEM_DIR/policy.yml"
    echo "  Policy: $SYSTEM_DIR/policy.yml"
fi

# Guard script
cp "$REPO_DIR/scripts/guard.sh" "$SYSTEM_DIR/guard.sh"
chown "root:$(root_group)" "$SYSTEM_DIR/guard.sh"
chmod 755 "$SYSTEM_DIR/guard.sh"
echo "  Guard: $SYSTEM_DIR/guard.sh"

# Hook wrapper
cp "$REPO_DIR/scripts/hook-wrapper.sh" "$SYSTEM_DIR/hook-wrapper.sh"
chown "root:$(root_group)" "$SYSTEM_DIR/hook-wrapper.sh"
chmod 755 "$SYSTEM_DIR/hook-wrapper.sh"
echo "  Hook wrapper: $SYSTEM_DIR/hook-wrapper.sh"

# --- Step 3: Initialize user registry ---
echo "[3/5] Setting up user registry..."
if [[ ! -f "$USERS_CONF" ]]; then
    echo "# Patchwork enrolled users — managed by system-install.sh" > "$USERS_CONF"
    echo "# One username per line. Do not edit manually." >> "$USERS_CONF"
    chown "root:$(root_group)" "$USERS_CONF"
    chmod 644 "$USERS_CONF"
fi

# --- Step 4: Install hooks for each user ---
echo "[4/5] Enrolling users..."
ENROLLED=0
FAILED=0
for user in "${USERS[@]}"; do
    user=$(echo "$user" | xargs)  # trim whitespace
    [[ -z "$user" ]] && continue
    echo ""
    echo "  --- $user ---"
    if setup_user "$user"; then
        ((ENROLLED++))
    else
        ((FAILED++))
    fi
done

# --- Step 5: Install system watchdog daemon ---
echo ""
echo "[5/5] Installing system watchdog daemon..."

# Write the multi-user watchdog script (cross-platform)
cat > "$SYSTEM_DIR/system-watchdog.sh" <<WATCHDOG
#!/bin/bash
# Patchwork System Watchdog — runs as root via LaunchDaemon (macOS) or systemd (Linux).
# Monitors ALL enrolled users and re-locks settings if tampered.

set -euo pipefail

PLATFORM="\$(uname)"
SYSTEM_DIR="$SYSTEM_DIR"
USERS_CONF="\$SYSTEM_DIR/users.conf"
LOG_FILE="\$SYSTEM_DIR/watchdog.log"

log() { echo "\$(date -u +%Y-%m-%dT%H:%M:%SZ) \$1" >> "\$LOG_FILE"; }

get_file_perms() {
    if [[ "\$PLATFORM" == "Darwin" ]]; then stat -f "%Lp" "\$1" 2>/dev/null
    else stat -c "%a" "\$1" 2>/dev/null; fi
}
get_file_owner() {
    if [[ "\$PLATFORM" == "Darwin" ]]; then stat -f "%Su:%Sg" "\$1" 2>/dev/null
    else stat -c "%U:%G" "\$1" 2>/dev/null; fi
}
get_file_size() {
    if [[ "\$PLATFORM" == "Darwin" ]]; then stat -f%z "\$1" 2>/dev/null || echo 0
    else stat -c "%s" "\$1" 2>/dev/null || echo 0; fi
}
root_group() { if [[ "\$PLATFORM" == "Darwin" ]]; then echo "wheel"; else echo "root"; fi; }
lock_file() {
    if [[ "\$PLATFORM" == "Darwin" ]]; then chflags schg "\$1"
    else chattr +i "\$1" 2>/dev/null || true; fi
}
unlock_file() {
    if [[ "\$PLATFORM" == "Darwin" ]]; then chflags noschg "\$1" 2>/dev/null || true
    else chattr -i "\$1" 2>/dev/null || true; fi
}
is_file_locked() {
    if [[ "\$PLATFORM" == "Darwin" ]]; then
        local flags; flags=\$(stat -f "%Sf" "\$1" 2>/dev/null); [[ "\$flags" == *"schg"* ]]
    else
        local attrs; attrs=\$(lsattr "\$1" 2>/dev/null | cut -d' ' -f1); [[ "\$attrs" == *"i"* ]]
    fi
}

find_node_for_user() {
    local user="\$1" home; home=\$(eval echo "~\$user")
    for candidate in "\$home/local/nodejs/"node-*/bin /usr/local/bin /opt/homebrew/bin "\$home/.nvm/versions/node/"*/bin "\$home/.volta/bin"; do
        if [[ -x "\$candidate/node" ]] && "\$candidate/node" --version &>/dev/null; then echo "\$candidate"; return 0; fi
    done
    return 1
}

user_group() {
    if [[ "\$PLATFORM" == "Darwin" ]]; then echo "staff"
    else id -gn "\$1" 2>/dev/null || echo "\$1"; fi
}

monitor_user() {
    local user="\$1" home; home=\$(eval echo "~\$user")
    local settings="\$home/.claude/settings.json"
    [[ -d "\$home" ]] || return

    if [[ ! -f "\$settings" ]]; then
        log "[\$user] CRITICAL: settings.json missing — recreating"
        sudo -u "\$user" mkdir -p "\$home/.claude"
        local node_bin; node_bin=\$(find_node_for_user "\$user") || true
        if [[ -n "\$node_bin" && -x "\$node_bin/patchwork" ]]; then
            sudo -u "\$user" PATH="\$node_bin:\$PATH" "\$node_bin/patchwork" init claude-code --strict-profile --policy-mode fail-closed 2>/dev/null || true
        fi
        if [[ -f "\$settings" ]]; then
            chown "root:\$(root_group)" "\$settings"; chmod 644 "\$settings"; lock_file "\$settings"
            log "[\$user] REINSTALLED: settings.json recreated and locked"
        fi
        return
    fi

    local owner; owner=\$(get_file_owner "\$settings")
    if [[ "\$owner" != "root:\$(root_group)" ]]; then
        log "[\$user] WARNING: settings.json owned by \$owner — relocking"
        unlock_file "\$settings"; chown "root:\$(root_group)" "\$settings"; chmod 644 "\$settings"; lock_file "\$settings"
        log "[\$user] FIXED: ownership restored"
    fi

    if ! is_file_locked "\$settings"; then
        log "[\$user] WARNING: settings.json not immutable — relocking"
        lock_file "\$settings"; log "[\$user] FIXED: immutable flag restored"
    fi

    if ! grep -q "patchwork hook\|hook-wrapper\.sh\|guard\.sh" "\$settings" 2>/dev/null; then
        log "[\$user] CRITICAL: patchwork hooks missing — reinstalling"
        unlock_file "\$settings"; chown "\$user:\$(user_group "\$user")" "\$settings"
        local node_bin; node_bin=\$(find_node_for_user "\$user") || true
        if [[ -n "\$node_bin" && -x "\$node_bin/patchwork" ]]; then
            sudo -u "\$user" PATH="\$node_bin:\$PATH" "\$node_bin/patchwork" init claude-code --strict-profile --policy-mode fail-closed 2>/dev/null || true
        fi
        chown "root:\$(root_group)" "\$settings"; chmod 644 "\$settings"; lock_file "\$settings"
        log "[\$user] REINSTALLED: hooks restored and relocked"
    fi

    local pw_dir="\$home/.patchwork"
    if [[ -d "\$pw_dir" ]]; then
        local perms; perms=\$(get_file_perms "\$pw_dir")
        if [[ "\$perms" != "700" ]]; then chmod 700 "\$pw_dir"; log "[\$user] FIXED: .patchwork permissions"; fi
    fi
}

[[ ! -f "\$USERS_CONF" ]] && { log "ERROR: users.conf not found"; exit 1; }

if [[ -f "\$SYSTEM_DIR/policy.yml" ]]; then
    local_owner=\$(get_file_owner "\$SYSTEM_DIR/policy.yml")
    if [[ "\$local_owner" != "root:\$(root_group)" ]]; then
        chown "root:\$(root_group)" "\$SYSTEM_DIR/policy.yml"; chmod 644 "\$SYSTEM_DIR/policy.yml"
        log "FIXED: system policy ownership restored"
    fi
fi

while IFS= read -r user; do
    [[ -z "\$user" || "\$user" == \\#* ]] && continue
    monitor_user "\$user"
done < "\$USERS_CONF"

if [[ -f "\$LOG_FILE" ]] && [[ "\$(get_file_size "\$LOG_FILE")" -gt 512000 ]]; then
    tail -500 "\$LOG_FILE" > "\$LOG_FILE.tmp" && mv "\$LOG_FILE.tmp" "\$LOG_FILE"
    log "ROTATED: watchdog log trimmed"
fi
WATCHDOG

chown "root:$(root_group)" "$SYSTEM_DIR/system-watchdog.sh"
chmod 755 "$SYSTEM_DIR/system-watchdog.sh"

# Install the daemon (cross-platform: launchctl on macOS, systemd on Linux)
install_system_daemon

echo "  Daemon installed"

# --- Summary ---
echo ""
echo "=== System Install Complete ==="
echo ""
echo "  Enrolled users ($ENROLLED):"
while IFS= read -r u; do
    [[ -z "$u" || "$u" == \#* ]] && continue
    echo "    - $u"
done < "$USERS_CONF"
[[ $FAILED -gt 0 ]] && echo "  Failed: $FAILED"
echo ""
echo "  Protected:"
echo "    ~/.claude/settings.json   (root:$(root_group), 644, immutable) per user"
echo "    $SYSTEM_DIR/policy.yml    (root:$(root_group), 644)"
echo ""
echo "  Manage users:"
echo "    sudo bash $REPO_DIR/scripts/system-add-user.sh --user USERNAME"
echo "    sudo bash $REPO_DIR/scripts/system-remove-user.sh --user USERNAME"
echo "    sudo bash $REPO_DIR/scripts/system-uninstall.sh"
