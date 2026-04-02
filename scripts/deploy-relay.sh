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
CONFIG="/Library/Patchwork/relay-config.json"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Dynamic node discovery — check cached path, then common locations
NODE=""
for candidate in \
    "$(cat "$HOME/.patchwork/state/node-path" 2>/dev/null)" \
    "$HOME/local/nodejs/"node-*/bin/node \
    /usr/local/bin/node \
    /opt/homebrew/bin/node; do
    if [[ -n "$candidate" ]] && [[ -x "$candidate" ]] && "$candidate" --version &>/dev/null; then
        NODE="$candidate"
        break
    fi
done

if [[ -z "$NODE" ]]; then
    echo "Error: cannot find a working node binary"
    exit 1
fi

# Dynamic CLI discovery — check cached path, then repo dist, then npm global
CLI=""
for candidate in \
    "$(cat "$HOME/.patchwork/state/patchwork-path" 2>/dev/null)" \
    "$SCRIPT_DIR/../packages/cli/dist/index.js" \
    "$(dirname "$NODE")/patchwork"; do
    if [[ -n "$candidate" ]] && [[ -f "$candidate" ]]; then
        CLI="$(cd "$(dirname "$candidate")" && pwd)/$(basename "$candidate")"
        break
    fi
done

if [[ -z "$CLI" ]]; then
    echo "Error: cannot find patchwork CLI"
    exit 1
fi

echo "Node: $NODE"
echo "CLI:  $CLI"

# Ensure data directory
mkdir -p /Library/Patchwork
chown root:wheel /Library/Patchwork
chmod 755 /Library/Patchwork

# Write default config if missing
if [[ ! -f "$CONFIG" ]]; then
    cat > "$CONFIG" <<'EOF'
{
  "auto_seal": {
    "enabled": true,
    "interval_minutes": 15,
    "min_events_between_seals": 1
  },
  "witness": {
    "enabled": false,
    "endpoints": [],
    "quorum": 1
  }
}
EOF
    chown root:wheel "$CONFIG"
    chmod 640 "$CONFIG"
    echo "Wrote default config → $CONFIG"
fi

# Generate plist
sed -e "s|__NODE_PATH__|$NODE|g" \
    -e "s|__PATCHWORK_CLI__|$CLI|g" \
    "$(dirname "$0")/com.patchwork.relay.plist" > "$PLIST_SRC"

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
