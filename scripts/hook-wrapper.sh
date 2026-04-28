#!/bin/bash
# Patchwork hook wrapper — reliable hook execution for any installation method.
#
# Strategy order (fastest to most reliable):
# 1. Cached node+patchwork paths from guard (~100ms, proven on this machine)
# 2. Direct patchwork binary via PATH (~100ms, works for npm global install)
# 3. tsx from repo source (~700ms, always resolves deps, development fallback)

# --- Per-event env defaults ---
# Enable in-toto/DSSE attestations on this machine (v0.6.9+). The post-tool
# handler dual-emits the standard format alongside the bespoke one, with no
# behavioural change to the bespoke path. Comment the next line out to revert
# to v0.6.8-style single-format emission.
[ "$1" = "post-tool" ] && export PATCHWORK_INTOTO=1

# --- Strategy 1: Cached paths from guard (set at session start) ---
if [ -f "$HOME/.patchwork/state/node-path" ] && [ -f "$HOME/.patchwork/state/patchwork-path" ]; then
    _NODE=$(cat "$HOME/.patchwork/state/node-path")
    _PW=$(cat "$HOME/.patchwork/state/patchwork-path")
    if [ -n "$_NODE" ] && [ -x "$_NODE" ] && [ -n "$_PW" ]; then
        "$_NODE" "$_PW" hook "$@" && exit $?
    fi
fi

# --- Strategy 2: Find working node+patchwork ---
for _candidate in \
    "$HOME/local/nodejs/"node-*/bin \
    /usr/local/bin \
    /opt/homebrew/bin \
    "$HOME/.nvm/versions/node/"*/bin \
    "$HOME/.volta/bin"; do
    if [ -x "$_candidate/node" ] && "$_candidate/node" --version &>/dev/null 2>&1; then
        # Check for patchwork in same directory
        for _pw in "$_candidate/patchwork" "$_candidate/patchwork.cmd"; do
            if [ -x "$_pw" ] || [ -f "$_pw" ]; then
                "$_candidate/node" "$_pw" hook "$@" && exit $?
                break
            fi
        done
        break
    fi
done

# --- Strategy 3: tsx from repo source (development fallback) ---
REPO_DIR="$HOME/AI/codex-audit"
if [ -d "$REPO_DIR/packages/cli/src" ]; then
    for _candidate in \
        "$HOME/local/nodejs/"node-*/bin \
        /usr/local/bin \
        /opt/homebrew/bin; do
        if [ -x "$_candidate/node" ] && "$_candidate/node" --version &>/dev/null 2>&1; then
            export PATH="$_candidate:$PATH"
            break
        fi
    done
    if command -v npx &>/dev/null; then
        cd "$REPO_DIR" 2>/dev/null && exec npx --yes tsx packages/cli/src/index.ts hook "$@"
    fi
fi

echo '{"error":"Patchwork: no working hook handler found. Run: npm install -g patchwork-audit"}' >&2
exit 1
