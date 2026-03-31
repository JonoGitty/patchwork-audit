#!/bin/bash
set -euo pipefail

# Patchwork — remove a user from system-level monitoring.
#
# Usage:
#   sudo bash scripts/system-remove-user.sh --user USERNAME

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"

TARGET_USER=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --user) TARGET_USER="$2"; shift 2 ;;
        --help|-h)
            echo "Usage: sudo bash $0 --user USERNAME"
            echo ""
            echo "Remove a user from Patchwork system monitoring."
            echo "Unlocks their settings.json and removes them from the watchdog."
            echo "Audit data in ~/.patchwork/ is preserved."
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

if [[ $EUID -ne 0 ]]; then
    echo "Error: This script must be run with sudo."
    exit 1
fi

if [[ -z "$TARGET_USER" ]]; then
    echo "Error: --user USERNAME is required."
    exit 1
fi

if [[ ! -f "$USERS_CONF" ]]; then
    echo "Error: No user registry found. Is the system install active?"
    exit 1
fi

if ! grep -qx "$TARGET_USER" "$USERS_CONF" 2>/dev/null; then
    echo "User '$TARGET_USER' is not enrolled."
    exit 0
fi

echo "=== Removing user: $TARGET_USER ==="
echo ""

teardown_user "$TARGET_USER"

echo ""
echo "Done. $TARGET_USER is no longer monitored."
echo "  Settings unlocked — user can now modify hooks"
echo "  Audit data preserved at ~/.patchwork/"
echo ""
echo "Remaining enrolled users:"
list_enrolled_users | sed 's/^/  - /'
