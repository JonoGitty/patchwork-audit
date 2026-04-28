#!/bin/bash
# Patchwork Dashboard — persistent server launcher.
# Runs via LaunchAgent (KeepAlive=true), restarts on crash.
# Configurable via ~/.patchwork/dashboard.conf
#
# By default uses the bundled CLI (absolute paths, no PATH/npx dependency).
# Set PATCHWORK_DEV=1 to run from repo source via tsx instead — useful when
# iterating on CLI/web changes locally without rebuilding.

CONF="$HOME/.patchwork/dashboard.conf"
PORT=3000
NO_OPEN="--no-open"

# Load config if exists
if [ -f "$CONF" ]; then
    # shellcheck source=/dev/null
    source "$CONF"
fi

# Resolve a working node + patchwork CLI on this machine.
# Prefer architecture-matched user-installed Node over system paths so
# Intel/ARM mismatches under Rosetta don't trip launchd.
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
        if [ -x "$candidate/patchwork" ]; then
            PW="$candidate/patchwork"
        fi
        export PATH="$candidate:$PATH"
        break
    fi
done

if [ -z "$NODE" ]; then
    echo "ERROR: No working node found in any of HOME/local, /usr/local/bin, /opt/homebrew/bin, NVM, Volta" >&2
    exit 1
fi

if [ -z "$PW" ]; then
    PW=$(command -v patchwork 2>/dev/null || echo "")
fi

if [ -z "$PW" ]; then
    echo "ERROR: patchwork CLI not found alongside node ($NODE) or in PATH" >&2
    exit 1
fi

# Dev mode (opt-in): run from repo source via tsx.
# Requires `pnpm install` in the repo root so tsx is reachable, and that
# npx itself is on the resolved PATH (it ships alongside node).
REPO_DIR="$HOME/AI/codex-audit"
if [ "${PATCHWORK_DEV:-0}" = "1" ] && [ -d "$REPO_DIR" ]; then
    cd "$REPO_DIR" || exit 1
    exec npx tsx packages/cli/src/index.ts dashboard $NO_OPEN --port "$PORT"
fi

# Default: bundled CLI (absolute paths — survives launchd's restricted env).
exec "$NODE" "$PW" dashboard $NO_OPEN --port "$PORT"
