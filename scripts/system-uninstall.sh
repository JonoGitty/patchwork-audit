#!/bin/bash
set -euo pipefail

# Patchwork System Uninstall — reverses all system-level protections for all enrolled users.
# Must be run with sudo by an admin.
#
# Usage:
#   sudo bash scripts/system-uninstall.sh [--keep-data]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"

KEEP_DATA=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --keep-data) KEEP_DATA=true; shift ;;
        --help|-h)
            echo "Usage: sudo bash $0 [--keep-data]"
            echo ""
            echo "Remove all Patchwork system-level protections."
            echo "Unlocks settings.json for all enrolled users."
            echo "Audit data in ~/.patchwork/ is always preserved."
            echo ""
            echo "Options:"
            echo "  --keep-data  Keep /Library/Patchwork/ (default: remove)"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

if [[ $EUID -ne 0 ]]; then
    echo "Error: This script must be run with sudo."
    exit 1
fi

echo "=== Patchwork System Uninstall ==="
echo ""

# 1. Unlock all enrolled users
echo "[1/3] Unlocking enrolled users..."
if [[ -f "$USERS_CONF" ]]; then
    UNLOCKED=0
    while IFS= read -r user; do
        [[ -z "$user" || "$user" == \#* ]] && continue
        teardown_user "$user"
        ((UNLOCKED++))
    done < "$USERS_CONF"
    echo "  Unlocked $UNLOCKED user(s)"
else
    echo "  No user registry found"
    # Try to unlock SUDO_USER as fallback
    FALLBACK="${SUDO_USER:-$(logname 2>/dev/null || echo "")}"
    if [[ -n "$FALLBACK" ]]; then
        unlock_user_settings "$FALLBACK"
    fi
fi

# 2. Remove system daemon (cross-platform)
echo ""
echo "[2/3] Removing system watchdog daemon..."
uninstall_system_daemon

# 3. Remove system directory
echo ""
echo "[3/3] Removing system directory..."
if [[ -d "$SYSTEM_DIR" ]]; then
    if $KEEP_DATA; then
        echo "  Keeping $SYSTEM_DIR (--keep-data)"
    else
        rm -rf "$SYSTEM_DIR"
        echo "  Removed: $SYSTEM_DIR"
    fi
else
    echo "  Not found"
fi

echo ""
echo "=== Uninstall Complete ==="
echo ""
echo "  All users' settings.json files are unlocked"
echo "  Hooks are still installed but users can now modify them"
echo "  Audit data preserved in each user's ~/.patchwork/"
