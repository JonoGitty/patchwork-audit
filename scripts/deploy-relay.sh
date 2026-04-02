#!/bin/bash
# Deploy the Patchwork relay daemon (layer 2).
# Run with: sudo bash scripts/deploy-relay.sh
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
    echo "Error: run with sudo"
    exit 1
fi

PLIST_SRC="/tmp/com.patchwork.relay.plist"
PLIST_DST="/Library/LaunchDaemons/com.patchwork.relay.plist"
NODE="/Users/jonogompels/local/nodejs/node-v22.16.0-darwin-x64/bin/node"
CLI="/Users/jonogompels/AI/codex-audit/packages/cli/dist/index.js"

# Generate plist if not already in /tmp
if [[ ! -f "$PLIST_SRC" ]]; then
    sed -e "s|__NODE_PATH__|$NODE|g" \
        -e "s|__PATCHWORK_CLI__|$CLI|g" \
        "$(dirname "$0")/com.patchwork.relay.plist" > "$PLIST_SRC"
fi

# Unload if already loaded
launchctl unload "$PLIST_DST" 2>/dev/null || true

# Install
cp "$PLIST_SRC" "$PLIST_DST"
chown root:wheel "$PLIST_DST"
chmod 644 "$PLIST_DST"

# Load
launchctl load -w "$PLIST_DST"

echo "Relay daemon deployed."
echo "Check: patchwork relay status"
