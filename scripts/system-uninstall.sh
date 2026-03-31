#!/bin/bash
set -euo pipefail

# Patchwork System Uninstall — reverses system-level protections.
# Must be run with sudo by an admin.
#
# Usage:
#   sudo bash scripts/system-uninstall.sh [--user USERNAME] [--keep-data]

TARGET_USER="${SUDO_USER:-$(logname 2>/dev/null || echo "")}"
KEEP_DATA=false
SYSTEM_DIR="/Library/Patchwork"
DAEMON_LABEL="com.patchwork.system-watchdog"
DAEMON_PLIST="/Library/LaunchDaemons/${DAEMON_LABEL}.plist"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --user) TARGET_USER="$2"; shift 2 ;;
        --keep-data) KEEP_DATA=true; shift ;;
        --help|-h)
            echo "Usage: sudo bash $0 [--user USERNAME] [--keep-data]"
            echo ""
            echo "Removes system-level Patchwork protections."
            echo "Audit data in ~/.patchwork/ is preserved by default."
            echo ""
            echo "Options:"
            echo "  --user USERNAME   Target user (default: \$SUDO_USER)"
            echo "  --keep-data       Keep /Library/Patchwork/ (default: remove)"
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
    echo "Error: Cannot determine target user. Use --user USERNAME."
    exit 1
fi

USER_HOME=$(eval echo "~$TARGET_USER")
CLAUDE_SETTINGS="$USER_HOME/.claude/settings.json"

echo "=== Patchwork System Uninstall ==="
echo "  User: $TARGET_USER"
echo ""

# 1. Unload and remove system daemon
echo "[1/4] Removing system watchdog daemon..."
if [[ -f "$DAEMON_PLIST" ]]; then
    launchctl unload "$DAEMON_PLIST" 2>/dev/null || true
    rm -f "$DAEMON_PLIST"
    echo "  Removed: $DAEMON_PLIST"
else
    echo "  Not found (already removed)"
fi

# Also remove user-level LaunchAgent if present
USER_AGENT="$USER_HOME/Library/LaunchAgents/com.patchwork.watchdog.plist"
if [[ -f "$USER_AGENT" ]]; then
    sudo -u "$TARGET_USER" launchctl unload "$USER_AGENT" 2>/dev/null || true
    rm -f "$USER_AGENT"
    echo "  Removed user LaunchAgent: $USER_AGENT"
fi

# 2. Unlock and restore settings.json ownership
echo "[2/4] Unlocking settings.json..."
if [[ -f "$CLAUDE_SETTINGS" ]]; then
    chflags noschg "$CLAUDE_SETTINGS" 2>/dev/null || true
    chown "$TARGET_USER:staff" "$CLAUDE_SETTINGS"
    chmod 644 "$CLAUDE_SETTINGS"
    echo "  Restored: $CLAUDE_SETTINGS (owned by $TARGET_USER, no schg)"
else
    echo "  Not found"
fi

# 3. Remove system directory
echo "[3/4] Removing system directory..."
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

# 4. Note about user data
echo "[4/4] User audit data..."
echo "  Preserved: $USER_HOME/.patchwork/"
echo "  Hooks in settings.json are still installed (user can now edit them)"
echo ""
echo "=== Uninstall Complete ==="
echo ""
echo "  Patchwork hooks are still active but the user can now modify or remove them."
echo "  To fully remove hooks: patchwork init claude-code (reinstall) or edit settings.json"
echo "  To remove audit data: rm -rf ~/.patchwork/"
