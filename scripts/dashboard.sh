#!/bin/bash
# Patchwork Dashboard — persistent server launcher.
# Runs via LaunchAgent, restarts on crash.
# Configurable via ~/.patchwork/dashboard.conf

CONF="$HOME/.patchwork/dashboard.conf"
PORT=3000
NO_OPEN="--no-open"

# Load config if exists
if [ -f "$CONF" ]; then
    source "$CONF"
fi

# Find working node
NODE=""
PW=""
for candidate in \
    "$HOME/local/nodejs/"node-*/bin \
    /usr/local/bin \
    /opt/homebrew/bin \
    "$HOME/.nvm/versions/node/"*/bin \
    "$HOME/.volta/bin"; do
    if [ -x "$candidate/node" ] && "$candidate/node" --version &>/dev/null; then
        NODE="$candidate/node"
        # Check for patchwork in same dir
        if [ -x "$candidate/patchwork" ]; then
            PW="$candidate/patchwork"
        fi
        export PATH="$candidate:$PATH"
        break
    fi
done

if [ -z "$NODE" ]; then
    echo "ERROR: No working node found" >&2
    exit 1
fi

if [ -z "$PW" ]; then
    PW=$(command -v patchwork 2>/dev/null || echo "")
fi

if [ -z "$PW" ]; then
    echo "ERROR: patchwork CLI not found" >&2
    exit 1
fi

# Run from repo source using tsx (resolves all workspace deps correctly)
REPO_DIR="$HOME/AI/codex-audit"
if [ -d "$REPO_DIR" ]; then
    cd "$REPO_DIR"
    exec npx tsx packages/cli/src/index.ts dashboard $NO_OPEN --port "$PORT"
fi

# Fallback: try bundled dist
exec "$NODE" "$PW" dashboard $NO_OPEN --port "$PORT"
