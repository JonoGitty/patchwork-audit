#!/bin/bash
set -euo pipefail

# Patchwork — add a user to an existing system install.
#
# Usage:
#   sudo bash scripts/system-add-user.sh --user USERNAME

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"

TARGET_USER=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --user) TARGET_USER="$2"; shift 2 ;;
        --help|-h)
            echo "Usage: sudo bash $0 --user USERNAME"
            echo ""
            echo "Add a user to the Patchwork system install."
            echo "The system install must already exist (run system-install.sh first)."
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

if [[ ! -d "$SYSTEM_DIR" ]]; then
    echo "Error: System install not found at $SYSTEM_DIR"
    echo "Run system-install.sh first."
    exit 1
fi

# Check user exists
if ! id "$TARGET_USER" &>/dev/null; then
    echo "Error: User '$TARGET_USER' does not exist."
    exit 1
fi

# Check if already enrolled
if grep -qx "$TARGET_USER" "$USERS_CONF" 2>/dev/null; then
    echo "User '$TARGET_USER' is already enrolled. Re-installing hooks..."
fi

echo "=== Adding user: $TARGET_USER ==="
echo ""

if setup_user "$TARGET_USER"; then
    echo ""
    echo "Done. $TARGET_USER is now monitored by Patchwork."
    echo "  Settings locked: ~/.claude/settings.json (root:wheel, schg)"
    echo "  Audit data: ~/.patchwork/"
else
    echo ""
    echo "Failed to set up user $TARGET_USER."
    exit 1
fi
