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
echo "[1/6] Creating $SYSTEM_DIR..."
mkdir -p "$SYSTEM_DIR"
chown "root:$(root_group)" "$SYSTEM_DIR"
chmod 755 "$SYSTEM_DIR"

# --- Step 2: Install shared assets (policy, guard, hook-wrapper) ---
echo "[2/6] Installing shared assets..."

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
echo "[3/6] Setting up user registry..."
if [[ ! -f "$USERS_CONF" ]]; then
    echo "# Patchwork enrolled users — managed by system-install.sh" > "$USERS_CONF"
    echo "# One username per line. Do not edit manually." >> "$USERS_CONF"
    chown "root:$(root_group)" "$USERS_CONF"
    chmod 644 "$USERS_CONF"
fi

# --- Step 4: Install hooks for each user ---
echo "[4/6] Enrolling users..."
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
echo "[5/6] Installing system watchdog daemon..."

# Copy the v2 hash-baseline watchdog script from template
WATCHDOG_TEMPLATE="$REPO_DIR/scripts/system-watchdog.sh"
if [[ ! -f "$WATCHDOG_TEMPLATE" ]]; then
    echo "  ERROR: watchdog template not found at $WATCHDOG_TEMPLATE"
    exit 1
fi
unlock_file "$SYSTEM_DIR/system-watchdog.sh" 2>/dev/null || true
cp "$WATCHDOG_TEMPLATE" "$SYSTEM_DIR/system-watchdog.sh"
chown "root:$(root_group)" "$SYSTEM_DIR/system-watchdog.sh"
chmod 755 "$SYSTEM_DIR/system-watchdog.sh"

# Install the daemon (cross-platform: launchctl on macOS, systemd on Linux)
install_system_daemon

echo "  Watchdog daemon installed (v2 hash-baseline model)"

# --- Step 6: Install relay daemon (layer 2 tamper-proof audit) ---
echo ""
echo "[6/6] Installing relay daemon..."

# Find node binary for the relay
RELAY_NODE=""
for user in "${USERS[@]}"; do
    user=$(echo "$user" | xargs)
    [[ -z "$user" ]] && continue
    user_home=$(eval echo "~$user")
    for candidate in "$user_home/local/nodejs/"node-*/bin/node /usr/local/bin/node /opt/homebrew/bin/node; do
        if [[ -x "$candidate" ]]; then
            RELAY_NODE="$candidate"
            break 2
        fi
    done
done

if [[ -n "$RELAY_NODE" ]]; then
    RELAY_PATCHWORK="$(dirname "$RELAY_NODE")/patchwork"
    if [[ -x "$RELAY_PATCHWORK" ]] || [[ -f "$RELAY_PATCHWORK" ]]; then
        # Install relay LaunchDaemon plist
        RELAY_PLIST="/Library/LaunchDaemons/com.patchwork.relay.plist"
        if [[ -f "$REPO_DIR/scripts/com.patchwork.relay.plist" ]]; then
            sed -e "s|__NODE_PATH__|$RELAY_NODE|g" \
                -e "s|__PATCHWORK_CLI__|$RELAY_PATCHWORK|g" \
                "$REPO_DIR/scripts/com.patchwork.relay.plist" > "$RELAY_PLIST"
            chown "root:$(root_group)" "$RELAY_PLIST"
            chmod 644 "$RELAY_PLIST"

            # Load the daemon
            launchctl unload "$RELAY_PLIST" 2>/dev/null || true
            launchctl load -w "$RELAY_PLIST"
            echo "  Relay daemon installed and started"
            echo "  Socket: /Library/Patchwork/relay.sock"
            echo "  Log:    /Library/Patchwork/events.relay.jsonl"
        else
            echo "  WARNING: relay plist template not found — skipping relay daemon"
        fi
    else
        echo "  WARNING: patchwork CLI not found — skipping relay daemon"
    fi
else
    echo "  WARNING: Node.js not found — skipping relay daemon"
fi

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
echo "    ~/.claude/settings.json           (user-owned, 644, hash-baseline) per user"
echo "    $SYSTEM_DIR/baselines/<user>.sha256 (root:$(root_group), 600) per user"
echo "    $SYSTEM_DIR/policy.yml            (root:$(root_group), 644, immutable)"
echo "    $SYSTEM_DIR/system-watchdog.sh    (root:$(root_group), 755, immutable)"
echo "    $SYSTEM_DIR/events.relay.jsonl    (root:$(root_group), 644, append-only)"
echo ""
echo "  Manage users:"
echo "    sudo bash $REPO_DIR/scripts/system-add-user.sh --user USERNAME"
echo "    sudo bash $REPO_DIR/scripts/system-remove-user.sh --user USERNAME"
echo "    sudo bash $REPO_DIR/scripts/system-uninstall.sh"
