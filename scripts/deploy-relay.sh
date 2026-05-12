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

# Detect the deploying user's primary group so the daemon can chgrp
# the relay socket to a group hook processes can actually connect to.
# Without this, the daemon's default root:wheel ownership locks out
# every non-wheel user and silently fills the relay-divergence log
# with connect EACCES errors. SUDO_USER is the unprivileged caller
# of `sudo bash scripts/deploy-relay.sh`; on systems where the script
# is invoked some other way, default to "staff" on darwin and the
# Linux-style "users" elsewhere.
DEPLOY_USER="${SUDO_USER:-${USER:-}}"
if [[ -n "$DEPLOY_USER" ]] && getent_group=$(id -gn "$DEPLOY_USER" 2>/dev/null); then
    SOCKET_GROUP="$getent_group"
elif [[ "$(uname -s)" == "Darwin" ]]; then
    SOCKET_GROUP="staff"
else
    SOCKET_GROUP="users"
fi

# Write default config if missing
if [[ ! -f "$CONFIG" ]]; then
    cat > "$CONFIG" <<EOF
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
  },
  "socket_group": "${SOCKET_GROUP}"
}
EOF
    chown root:wheel "$CONFIG"
    chmod 640 "$CONFIG"
    echo "Wrote default config → $CONFIG (socket_group=$SOCKET_GROUP)"
elif ! grep -q '"socket_group"' "$CONFIG"; then
    # Pre-existing config without socket_group — log a one-line hint
    # but don't rewrite the user's config. They can add it by hand or
    # let a fresh deploy regenerate via `rm $CONFIG && rerun`.
    echo "NOTE: $CONFIG has no socket_group; relay socket will remain root:wheel."
    echo "      Hook processes outside the wheel group will see EACCES."
    echo "      Add \"socket_group\": \"$SOCKET_GROUP\" to fix, then restart the daemon."
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
