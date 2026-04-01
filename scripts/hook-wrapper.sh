#!/bin/bash
# Patchwork hook wrapper — shared across all users.
# Runs patchwork hook commands reliably on any setup:
#   1. From repo source via tsx (always resolves deps correctly)
#   2. Via npx patchwork-audit (npm global install)
#   3. Via bundled dist (npm link, if better-sqlite3 is resolvable)
#
# Usage: bash hook-wrapper.sh <hook-event>
# e.g.:  bash hook-wrapper.sh pre-tool

# --- Runtime Node discovery ---
for _candidate in \
    "$HOME/local/nodejs/"node-*/bin \
    /usr/local/bin \
    /opt/homebrew/bin \
    "$HOME/.nvm/versions/node/"*/bin \
    "$HOME/.volta/bin"; do
    if [ -x "$_candidate/node" ] && "$_candidate/node" --version &>/dev/null; then
        export PATH="$_candidate:$PATH"
        break
    fi
done

# --- Strategy 1: Run from repo source via tsx (most reliable) ---
REPO_DIR="$HOME/AI/codex-audit"
if [ -d "$REPO_DIR/packages/cli/src" ] && command -v npx &>/dev/null; then
    cd "$REPO_DIR" 2>/dev/null && exec npx --yes tsx packages/cli/src/index.ts hook "$@"
fi

# --- Strategy 2: Try cached node+patchwork paths from guard ---
if [ -f "$HOME/.patchwork/state/node-path" ] && [ -f "$HOME/.patchwork/state/patchwork-path" ]; then
    _NODE=$(cat "$HOME/.patchwork/state/node-path")
    _PW=$(cat "$HOME/.patchwork/state/patchwork-path")
    if [ -n "$_NODE" ] && [ -x "$_NODE" ] && [ -n "$_PW" ]; then
        exec "$_NODE" "$_PW" hook "$@"
    fi
fi

# --- Strategy 3: Bare patchwork (npm global install) ---
if command -v patchwork &>/dev/null; then
    exec patchwork hook "$@"
fi

echo '{"error":"Patchwork hook-wrapper: no working patchwork found"}' >&2
exit 1
