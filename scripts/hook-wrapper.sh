#!/bin/bash
# Patchwork hook wrapper — reliable hook execution for any installation method.
#
# Strategy order (fastest to most reliable):
# 1. Direct binary (npm install -g patchwork-audit) — ~50ms
# 2. Cached node+patchwork from guard discovery — ~50ms
# 3. tsx from repo source (development) — ~500ms
# 4. Bare patchwork via PATH — ~50ms

# --- Runtime Node discovery ---
for _candidate in \
    "$HOME/local/nodejs/"node-*/bin \
    /usr/local/bin \
    /opt/homebrew/bin \
    "$HOME/.nvm/versions/node/"*/bin \
    "$HOME/.volta/bin"; do
    if [ -x "$_candidate/node" ] && "$_candidate/node" --version &>/dev/null 2>&1; then
        export PATH="$_candidate:$PATH"
        break
    fi
done

# --- Strategy 1: Direct patchwork binary (npm global install) ---
# This is the fast path for production users
if command -v patchwork &>/dev/null; then
    patchwork hook "$@" 2>/dev/null && exit 0
    # If it failed (e.g., missing better-sqlite3), fall through
fi

# --- Strategy 2: Cached paths from guard ---
if [ -f "$HOME/.patchwork/state/node-path" ] && [ -f "$HOME/.patchwork/state/patchwork-path" ]; then
    _NODE=$(cat "$HOME/.patchwork/state/node-path")
    _PW=$(cat "$HOME/.patchwork/state/patchwork-path")
    if [ -n "$_NODE" ] && [ -x "$_NODE" ] && [ -n "$_PW" ]; then
        "$_NODE" "$_PW" hook "$@" 2>/dev/null && exit 0
    fi
fi

# --- Strategy 3: tsx from repo source (development fallback) ---
REPO_DIR="$HOME/AI/codex-audit"
if [ -d "$REPO_DIR/packages/cli/src" ] && command -v npx &>/dev/null; then
    cd "$REPO_DIR" 2>/dev/null && npx --yes tsx packages/cli/src/index.ts hook "$@" && exit 0
fi

echo '{"error":"Patchwork: no working hook handler found. Run: npm install -g patchwork-audit"}' >&2
exit 1
