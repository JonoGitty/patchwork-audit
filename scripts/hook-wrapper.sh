#!/bin/bash
# Patchwork hook wrapper — shared across all users.
# Discovers Node at runtime and forwards to patchwork hook.
# Installed to /Library/Patchwork/hook-wrapper.sh by system-install.sh.
#
# Usage: bash /Library/Patchwork/hook-wrapper.sh <hook-event>
# e.g.:  bash /Library/Patchwork/hook-wrapper.sh pre-tool

# --- Runtime Node discovery ---
for _candidate in \
    "$HOME/local/nodejs/"node-*/bin \
    /usr/local/bin \
    /opt/homebrew/bin \
    "$HOME/.nvm/versions/node/"*/bin \
    "$HOME/.volta/bin"; do
    if [ -x "$_candidate/node" ]; then
        export PATH="$_candidate:$PATH"
        break
    fi
done

exec patchwork hook "$@"
