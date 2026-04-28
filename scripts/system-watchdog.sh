#!/bin/bash
# Patchwork System Watchdog (v2 hash-baseline model).
# Runs as root via LaunchDaemon (macOS) or systemd (Linux).
# Monitors all enrolled users from $SYSTEM_DIR/users.conf.
#
# Tamper detection model:
#   - settings.json stays user-owned and writable (so Claude Code can read it)
#   - SHA-256 baseline of settings.json is stored under $SYSTEM_DIR/baselines/
#   - Hooks-present check + baseline mismatch triggers reinstall
#
# This replaces the v1 model where settings.json was root-owned + chflags schg
# (immutable). v1 broke Claude Code's ability to read the hooks file. The
# watchdog migrates v1 deployments by clearing schg + restoring user ownership.

set -euo pipefail

# --- Config ---
PLATFORM="$(uname)"
if [[ "$PLATFORM" == "Darwin" ]]; then
    SYSTEM_DIR="/Library/Patchwork"
elif [[ "$PLATFORM" == "Linux" ]]; then
    SYSTEM_DIR="/etc/patchwork"
else
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) ERROR: unsupported platform: $PLATFORM" >&2
    exit 1
fi
USERS_CONF="$SYSTEM_DIR/users.conf"
LOG_FILE="$SYSTEM_DIR/watchdog.log"
TAMPER_LOG="$SYSTEM_DIR/tamper.log"
BASELINE_DIR="$SYSTEM_DIR/baselines"

# --- Logging ---
log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $1" >> "$LOG_FILE"; }
tamper_log() {
    local user="$1" reason="$2" ts
    ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "$ts [$user] TAMPER: $reason" >> "$TAMPER_LOG"
    log "[$user] TAMPER: $reason"
}

# --- Cross-platform helpers ---
root_group() {
    if [[ "$PLATFORM" == "Darwin" ]]; then echo "wheel"; else echo "root"; fi
}
user_group() {
    local user="$1"
    if [[ "$PLATFORM" == "Darwin" ]]; then echo "staff"
    else id -gn "$user" 2>/dev/null || echo "$user"; fi
}
get_file_perms() {
    if [[ "$PLATFORM" == "Darwin" ]]; then stat -f "%Lp" "$1" 2>/dev/null
    else stat -c "%a" "$1" 2>/dev/null; fi
}
get_file_owner() {
    if [[ "$PLATFORM" == "Darwin" ]]; then stat -f "%Su:%Sg" "$1" 2>/dev/null
    else stat -c "%U:%G" "$1" 2>/dev/null; fi
}
get_file_size() {
    if [[ "$PLATFORM" == "Darwin" ]]; then stat -f%z "$1" 2>/dev/null || echo 0
    else stat -c "%s" "$1" 2>/dev/null || echo 0; fi
}
unlock_file() {
    if [[ "$PLATFORM" == "Darwin" ]]; then chflags noschg "$1" 2>/dev/null || true
    else chattr -i "$1" 2>/dev/null || true; fi
}
lock_file() {
    if [[ "$PLATFORM" == "Darwin" ]]; then chflags schg "$1" 2>/dev/null || true
    else chattr +i "$1" 2>/dev/null || true; fi
}
is_file_locked() {
    if [[ "$PLATFORM" == "Darwin" ]]; then
        local flags; flags=$(stat -f "%Sf" "$1" 2>/dev/null)
        [[ "$flags" == *"schg"* ]]
    else
        local attrs; attrs=$(lsattr "$1" 2>/dev/null | cut -d' ' -f1)
        [[ "$attrs" == *"i"* ]]
    fi
}
get_user_home() {
    local user="$1"
    if [[ "$PLATFORM" == "Darwin" ]]; then
        dscl . read "/Users/$user" NFSHomeDirectory 2>/dev/null | awk '{print $2}'
    else
        getent passwd "$user" 2>/dev/null | cut -d: -f6
    fi
}
compute_hash() { shasum -a 256 "$1" 2>/dev/null | awk '{print $1}'; }

find_node_for_user() {
    local user="$1" home
    home=$(get_user_home "$user")
    [[ -z "$home" ]] && return 1
    for candidate in \
        "$home/local/nodejs/"node-*/bin \
        /usr/local/bin /opt/homebrew/bin \
        "$home/.nvm/versions/node/"*/bin \
        "$home/.volta/bin"; do
        if [[ -x "$candidate/node" ]] && "$candidate/node" --version &>/dev/null; then
            echo "$candidate"
            return 0
        fi
    done
    return 1
}

# --- Hash baseline (per user) ---
baseline_file_for() { echo "$BASELINE_DIR/$1.sha256"; }

record_baseline() {
    local user="$1" settings="$2" baseline hash
    baseline="$(baseline_file_for "$user")"
    hash="$(compute_hash "$settings")"
    [[ -z "$hash" ]] && return 1
    echo "$hash" > "$baseline"
    chmod 600 "$baseline"
    chown "root:$(root_group)" "$baseline"
    log "[$user] BASELINE: recorded $hash"
}

# --- Hooks reinstall (v2 ownership) ---
reinstall_hooks() {
    local user="$1" settings="$2" home node_bin
    home=$(get_user_home "$user")
    log "[$user] REINSTALLING: hooks into settings.json"

    # Remove legacy v1 immutable flag if present (migration)
    unlock_file "$settings" || true

    if node_bin=$(find_node_for_user "$user"); then
        if [[ -x "$node_bin/patchwork" ]]; then
            sudo -u "$user" PATH="$node_bin:$PATH" "$node_bin/patchwork" \
                init claude-code --strict-profile --policy-mode fail-closed \
                2>/dev/null || true
        fi
    fi

    # v2 ownership: user-owned, NOT root
    if [[ -f "$settings" ]]; then
        chown "$user:$(user_group "$user")" "$settings" 2>/dev/null || true
        chmod 644 "$settings" 2>/dev/null || true
        record_baseline "$user" "$settings"
        log "[$user] REINSTALLED: hooks restored, baseline updated"
    fi
}

# --- Per-user monitoring ---
monitor_user() {
    local user="$1" home settings owner expected_owner perms node_bin baseline expected actual
    home=$(get_user_home "$user")
    [[ -z "$home" || ! -d "$home" ]] && return
    settings="$home/.claude/settings.json"

    # 1. Recreate settings.json if missing
    if [[ ! -f "$settings" ]]; then
        log "[$user] CRITICAL: settings.json missing — recreating"
        sudo -u "$user" mkdir -p "$home/.claude" 2>/dev/null || true
        reinstall_hooks "$user" "$settings"
        return
    fi

    # 2. Migrate from v1 immutable flag if present
    if is_file_locked "$settings"; then
        log "[$user] MIGRATION: removing legacy schg flag (v1 → v2)"
        unlock_file "$settings"
    fi

    # 3. Restore user ownership if root-owned (v1 leftover or tampering)
    owner=$(get_file_owner "$settings")
    expected_owner="$user:$(user_group "$user")"
    if [[ -n "$owner" && "$owner" != "$expected_owner" ]]; then
        log "[$user] WARNING: settings.json owned by $owner — fixing to $expected_owner"
        chown "$expected_owner" "$settings"
        chmod 644 "$settings"
        record_baseline "$user" "$settings"
    fi

    # 4. Hooks must be present
    if ! grep -q "patchwork hook\|hook-wrapper\.sh\|guard\.sh" "$settings" 2>/dev/null; then
        tamper_log "$user" "patchwork hooks missing from settings.json"
        reinstall_hooks "$user" "$settings"
        return
    fi

    # 5. Hash baseline verification
    baseline="$(baseline_file_for "$user")"
    if [[ -f "$baseline" ]]; then
        expected=$(cat "$baseline" 2>/dev/null)
        actual=$(compute_hash "$settings")
        if [[ -n "$expected" && -n "$actual" && "$expected" != "$actual" ]]; then
            # File changed. If hooks still intact, accept and re-baseline silently.
            # If hooks are gone, that's tampering — reinstall.
            if grep -q "patchwork hook\|hook-wrapper\.sh\|guard\.sh" "$settings" 2>/dev/null; then
                record_baseline "$user" "$settings"
            else
                tamper_log "$user" "settings.json modified AND hooks removed (hash $expected → $actual)"
                reinstall_hooks "$user" "$settings"
            fi
        fi
    else
        record_baseline "$user" "$settings"
    fi

    # 6. Enforce ~/.patchwork directory permissions (user-owned, 0700)
    local pw_dir="$home/.patchwork"
    if [[ -d "$pw_dir" ]]; then
        perms=$(get_file_perms "$pw_dir")
        if [[ -n "$perms" && "$perms" != "700" ]]; then
            chmod 700 "$pw_dir"
            log "[$user] FIXED: .patchwork directory permissions → 0700"
        fi
    fi

    # 7. Cache resolved node + patchwork paths for hook-wrapper (fast lookup)
    if node_bin=$(find_node_for_user "$user"); then
        sudo -u "$user" mkdir -p "$home/.patchwork/state" 2>/dev/null || true
        sudo -u "$user" sh -c "echo '$node_bin/node' > '$home/.patchwork/state/node-path'" 2>/dev/null || true
        if [[ -x "$node_bin/patchwork" ]] || [[ -f "$node_bin/patchwork" ]]; then
            sudo -u "$user" sh -c "echo '$node_bin/patchwork' > '$home/.patchwork/state/patchwork-path'" 2>/dev/null || true
        fi
    fi
}

# --- Main ---

# Ensure baseline directory exists (root-owned, 0700)
mkdir -p "$BASELINE_DIR" 2>/dev/null || true
chmod 700 "$BASELINE_DIR" 2>/dev/null || true
chown "root:$(root_group)" "$BASELINE_DIR" 2>/dev/null || true

if [[ ! -f "$USERS_CONF" ]]; then
    log "ERROR: users.conf not found at $USERS_CONF"
    exit 1
fi

# Restore policy.yml ownership + lock if drifted
if [[ -f "$SYSTEM_DIR/policy.yml" ]]; then
    pol_owner=$(get_file_owner "$SYSTEM_DIR/policy.yml")
    if [[ -n "$pol_owner" && "$pol_owner" != "root:$(root_group)" ]]; then
        log "FIXED: policy.yml ownership $pol_owner → root:$(root_group)"
        unlock_file "$SYSTEM_DIR/policy.yml"
        chown "root:$(root_group)" "$SYSTEM_DIR/policy.yml"
        chmod 644 "$SYSTEM_DIR/policy.yml"
    fi
fi

# Lock system scripts (these SHOULD be immutable — they're root-owned bash that runs at root)
for sysfile in \
    "$SYSTEM_DIR/system-watchdog.sh" \
    "$SYSTEM_DIR/policy.yml" \
    "$SYSTEM_DIR/guard.sh" \
    "$SYSTEM_DIR/hook-wrapper.sh"; do
    if [[ -f "$sysfile" ]] && ! is_file_locked "$sysfile"; then
        lock_file "$sysfile"
    fi
done

# Per-user monitoring loop
ENROLLED=0
while IFS= read -r line; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    user=$(echo "$line" | xargs)
    [[ -z "$user" ]] && continue
    monitor_user "$user"
    ((ENROLLED++)) || true
done < "$USERS_CONF"

# Rotate logs > 500KB
for logfile in "$LOG_FILE" "$TAMPER_LOG"; do
    if [[ -f "$logfile" ]] && [[ "$(get_file_size "$logfile")" -gt 512000 ]]; then
        tail -500 "$logfile" > "$logfile.tmp" && mv "$logfile.tmp" "$logfile"
        log "ROTATED: $(basename "$logfile") trimmed"
    fi
done

log "OK: $ENROLLED user(s) monitored"
