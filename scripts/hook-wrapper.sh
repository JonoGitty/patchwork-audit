#!/bin/bash
# Patchwork hook wrapper — shared across all users.
# Discovers a working Node.js at runtime (correct architecture) and forwards to patchwork.
# Installed to /Library/Patchwork/hook-wrapper.sh by system-install.sh.
#
# Usage: bash /Library/Patchwork/hook-wrapper.sh <hook-event>

# Try to read cached paths from guard (set at session start)
_NODE=""
_PW=""
if [ -f "$HOME/.patchwork/state/node-path" ] && [ -f "$HOME/.patchwork/state/patchwork-path" ]; then
    _NODE=$(cat "$HOME/.patchwork/state/node-path")
    _PW=$(cat "$HOME/.patchwork/state/patchwork-path")
fi

# Verify cached paths still work
if [ -n "$_NODE" ] && [ -x "$_NODE" ] && [ -n "$_PW" ]; then
    exec "$_NODE" "$_PW" hook "$@"
fi

# Fallback: discover at runtime
for _candidate in \
    "$HOME/local/nodejs/"node-*/bin \
    /usr/local/bin \
    /opt/homebrew/bin \
    "$HOME/.nvm/versions/node/"*/bin \
    "$HOME/.volta/bin"; do
    if [ -x "$_candidate/node" ] && [ -x "$_candidate/patchwork" ]; then
        if "$_candidate/node" --version &>/dev/null; then
            exec "$_candidate/node" "$_candidate/patchwork" hook "$@"
        fi
    fi
done

# Last resort
exec patchwork hook "$@"
