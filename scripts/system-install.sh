#!/bin/bash
set -euo pipefail

# Patchwork System Install — makes audit trail tamper-proof for non-admin users.
#
# Must be run with sudo by an admin. After installation:
# - Non-admin users cannot remove or modify audit hooks
# - Non-admin users cannot weaken the security policy
# - Non-admin users cannot unload the watchdog daemon
# - The AI agent cannot disable its own monitoring
#
# Usage:
#   sudo bash scripts/system-install.sh [--user USERNAME] [--policy PATH]
#
# Run from the codex-audit repo root, or set PATCHWORK_REPO to the repo path.

# --- Defaults ---
REPO_DIR="${PATCHWORK_REPO:-$(cd "$(dirname "$0")/.." && pwd)}"
TARGET_USER="${SUDO_USER:-$(logname 2>/dev/null || echo "")}"
CUSTOM_POLICY=""
SYSTEM_DIR="/Library/Patchwork"
DAEMON_LABEL="com.patchwork.system-watchdog"
DAEMON_PLIST="/Library/LaunchDaemons/${DAEMON_LABEL}.plist"

# --- Parse args ---
while [[ $# -gt 0 ]]; do
    case "$1" in
        --user) TARGET_USER="$2"; shift 2 ;;
        --policy) CUSTOM_POLICY="$2"; shift 2 ;;
        --help|-h)
            echo "Usage: sudo bash $0 [--user USERNAME] [--policy /path/to/policy.yml]"
            echo ""
            echo "Installs Patchwork system-level enforcement so non-admin users"
            echo "cannot tamper with or remove the audit trail."
            echo ""
            echo "Options:"
            echo "  --user USERNAME   Target user (default: \$SUDO_USER)"
            echo "  --policy PATH     Custom policy file (default: docs/default-policy.yml)"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# --- Validation ---
if [[ $EUID -ne 0 ]]; then
    echo "Error: This script must be run with sudo."
    echo "  sudo bash $0"
    exit 1
fi

if [[ -z "$TARGET_USER" ]]; then
    echo "Error: Cannot determine target user. Use --user USERNAME."
    exit 1
fi

USER_HOME=$(eval echo "~$TARGET_USER")
if [[ ! -d "$USER_HOME" ]]; then
    echo "Error: Home directory not found for user '$TARGET_USER': $USER_HOME"
    exit 1
fi

CLAUDE_SETTINGS="$USER_HOME/.claude/settings.json"
USER_PATCHWORK="$USER_HOME/.patchwork"

# Find Node.js
NODE_BIN=""
for candidate in \
    "$USER_HOME/local/nodejs/"node-*/bin/node \
    /usr/local/bin/node \
    /opt/homebrew/bin/node; do
    if [[ -x "$candidate" ]]; then
        NODE_BIN="$(dirname "$candidate")"
        break
    fi
done

if [[ -z "$NODE_BIN" ]]; then
    echo "Error: Node.js not found. Install Node.js first."
    exit 1
fi

PATCHWORK_BIN="$NODE_BIN/patchwork"
if [[ ! -x "$PATCHWORK_BIN" ]]; then
    echo "Error: patchwork CLI not found at $PATCHWORK_BIN"
    echo "Run: cd $REPO_DIR/packages/cli && npm link"
    exit 1
fi

echo "=== Patchwork System Install ==="
echo "  User:          $TARGET_USER"
echo "  Home:          $USER_HOME"
echo "  Node:          $NODE_BIN"
echo "  Patchwork:     $PATCHWORK_BIN"
echo "  System dir:    $SYSTEM_DIR"
echo ""

# --- Step 1: Create system directory ---
echo "[1/7] Creating $SYSTEM_DIR..."
mkdir -p "$SYSTEM_DIR"
chown root:wheel "$SYSTEM_DIR"
chmod 755 "$SYSTEM_DIR"

# --- Step 2: Install system policy ---
echo "[2/7] Installing system policy..."
if [[ -n "$CUSTOM_POLICY" && -f "$CUSTOM_POLICY" ]]; then
    POLICY_SRC="$CUSTOM_POLICY"
elif [[ -f "$REPO_DIR/docs/default-policy.yml" ]]; then
    POLICY_SRC="$REPO_DIR/docs/default-policy.yml"
elif [[ -f "$USER_PATCHWORK/policy.yml" ]]; then
    POLICY_SRC="$USER_PATCHWORK/policy.yml"
else
    echo "  Warning: No policy file found. Generating strict default..."
    sudo -u "$TARGET_USER" PATH="$NODE_BIN:$PATH" "$PATCHWORK_BIN" policy init --strict 2>/dev/null || true
    POLICY_SRC="$USER_PATCHWORK/policy.yml"
fi

cp "$POLICY_SRC" "$SYSTEM_DIR/policy.yml"
chown root:wheel "$SYSTEM_DIR/policy.yml"
chmod 644 "$SYSTEM_DIR/policy.yml"
echo "  Policy installed: $SYSTEM_DIR/policy.yml (root:wheel, 644)"

# --- Step 3: Install guard and watchdog scripts ---
echo "[3/7] Installing guard and watchdog scripts..."
cp "$REPO_DIR/scripts/guard.sh" "$SYSTEM_DIR/guard.sh"
chown root:wheel "$SYSTEM_DIR/guard.sh"
chmod 755 "$SYSTEM_DIR/guard.sh"

# Update guard.sh to use discovered Node path
sed -i '' "s|export PATH=.*|export PATH=\"$NODE_BIN:\$PATH\"|" "$SYSTEM_DIR/guard.sh"

# --- Step 4: Install hooks into Claude Code settings ---
echo "[4/7] Installing hooks into settings.json..."

# Ensure .claude directory exists
sudo -u "$TARGET_USER" mkdir -p "$USER_HOME/.claude"

# Install hooks using patchwork init (as the target user first)
sudo -u "$TARGET_USER" PATH="$NODE_BIN:$PATH" "$PATCHWORK_BIN" \
    init claude-code --strict-profile --policy-mode fail-closed 2>/dev/null || true

# Patch hooks with correct PATH prefix and system guard
python3 - "$CLAUDE_SETTINGS" "$NODE_BIN" "$SYSTEM_DIR" <<'PYEOF'
import json, sys, os

settings_path = sys.argv[1]
node_bin = sys.argv[2]
system_dir = sys.argv[3]
path_prefix = f"PATH={node_bin}:$PATH"

with open(settings_path) as f:
    s = json.load(f)

hooks = s.get("hooks", {})

for event, hook_list in hooks.items():
    for hook in hook_list:
        cmd = hook.get("command", "")
        if "patchwork hook" in cmd and node_bin not in cmd:
            hook["command"] = f"{path_prefix} {cmd}"

# Replace SessionStart with system guard
if "SessionStart" in hooks:
    for hook in hooks["SessionStart"]:
        if "patchwork hook session-start" in hook.get("command", "") or "guard.sh" in hook.get("command", ""):
            hook["command"] = f"bash {system_dir}/guard.sh"
            hook["timeout"] = 1500

with open(settings_path, "w") as f:
    json.dump(s, f, indent=2)
    f.write("\n")
PYEOF

echo "  Hooks installed with fail-closed + PATH prefix"

# --- Step 5: Lock settings.json ---
echo "[5/7] Locking settings.json..."

# Make root-owned but readable by the user (Claude Code needs to read it)
chown root:wheel "$CLAUDE_SETTINGS"
chmod 644 "$CLAUDE_SETTINGS"

# Set system immutable flag — requires root to remove
chflags schg "$CLAUDE_SETTINGS"

echo "  $CLAUDE_SETTINGS: root:wheel, 644, schg (system immutable)"
echo "  Non-admin users CANNOT modify this file."

# --- Step 6: Ensure user audit data directory exists ---
echo "[6/7] Setting up user audit data directory..."
sudo -u "$TARGET_USER" mkdir -p "$USER_PATCHWORK"
sudo -u "$TARGET_USER" mkdir -p "$USER_PATCHWORK/state"
sudo -u "$TARGET_USER" mkdir -p "$USER_PATCHWORK/db"
chmod 700 "$USER_PATCHWORK"

# --- Step 7: Install system LaunchDaemon ---
echo "[7/7] Installing system watchdog daemon..."

cat > "$DAEMON_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$DAEMON_LABEL</string>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$SYSTEM_DIR/system-watchdog.sh</string>
        <string>$TARGET_USER</string>
    </array>

    <!-- Run every 15 minutes -->
    <key>StartInterval</key>
    <integer>900</integer>

    <!-- Also run at boot -->
    <key>RunAtLoad</key>
    <true/>

    <key>StandardErrorPath</key>
    <string>$SYSTEM_DIR/watchdog-stderr.log</string>

    <key>StandardOutPath</key>
    <string>$SYSTEM_DIR/watchdog.log</string>

    <key>KeepAlive</key>
    <false/>
</dict>
</plist>
PLIST

chown root:wheel "$DAEMON_PLIST"
chmod 644 "$DAEMON_PLIST"

# Install system watchdog script
cat > "$SYSTEM_DIR/system-watchdog.sh" <<'WATCHDOG'
#!/bin/bash
# Patchwork System Watchdog — runs as root via LaunchDaemon.
# Monitors Claude Code settings and re-locks if tampered with.
# Cannot be unloaded by non-admin users.

set -euo pipefail

TARGET_USER="${1:-}"
if [[ -z "$TARGET_USER" ]]; then
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) ERROR: No target user specified"
    exit 1
fi

USER_HOME=$(eval echo "~$TARGET_USER")
CLAUDE_SETTINGS="$USER_HOME/.claude/settings.json"
SYSTEM_DIR="/Library/Patchwork"
NODE_BIN=""

# Find Node.js
for candidate in \
    "$USER_HOME/local/nodejs/"node-*/bin/node \
    /usr/local/bin/node \
    /opt/homebrew/bin/node; do
    if [[ -x "$candidate" ]]; then
        NODE_BIN="$(dirname "$candidate")"
        break
    fi
done

log() {
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [$TARGET_USER] $1"
}

# 1. Check settings.json exists
if [[ ! -f "$CLAUDE_SETTINGS" ]]; then
    log "CRITICAL: settings.json missing — recreating"
    sudo -u "$TARGET_USER" mkdir -p "$USER_HOME/.claude"
    if [[ -n "$NODE_BIN" ]]; then
        sudo -u "$TARGET_USER" PATH="$NODE_BIN:$PATH" patchwork init claude-code \
            --strict-profile --policy-mode fail-closed 2>/dev/null || true
    fi
    # Re-lock
    chown root:wheel "$CLAUDE_SETTINGS" 2>/dev/null
    chmod 644 "$CLAUDE_SETTINGS" 2>/dev/null
    chflags schg "$CLAUDE_SETTINGS" 2>/dev/null
    log "REINSTALLED: settings.json recreated and locked"
    exit 0
fi

# 2. Check settings.json has correct ownership (root:wheel)
OWNER=$(stat -f "%Su:%Sg" "$CLAUDE_SETTINGS" 2>/dev/null)
if [[ "$OWNER" != "root:wheel" ]]; then
    log "WARNING: settings.json owned by $OWNER instead of root:wheel — relocking"
    chflags noschg "$CLAUDE_SETTINGS" 2>/dev/null || true
    chown root:wheel "$CLAUDE_SETTINGS"
    chmod 644 "$CLAUDE_SETTINGS"
    chflags schg "$CLAUDE_SETTINGS"
    log "FIXED: ownership restored to root:wheel + schg"
fi

# 3. Check system immutable flag is set
FLAGS=$(stat -f "%Sf" "$CLAUDE_SETTINGS" 2>/dev/null)
if [[ "$FLAGS" != *"schg"* ]]; then
    log "WARNING: settings.json missing schg flag — relocking"
    chflags schg "$CLAUDE_SETTINGS"
    log "FIXED: schg flag restored"
fi

# 4. Check patchwork hooks are present
if ! grep -q "patchwork hook" "$CLAUDE_SETTINGS" 2>/dev/null; then
    log "CRITICAL: patchwork hooks missing — reinstalling"
    # Temporarily unlock to modify
    chflags noschg "$CLAUDE_SETTINGS"

    if [[ -n "$NODE_BIN" ]]; then
        sudo -u "$TARGET_USER" PATH="$NODE_BIN:$PATH" patchwork init claude-code \
            --strict-profile --policy-mode fail-closed 2>/dev/null || true
    fi

    # Re-lock
    chown root:wheel "$CLAUDE_SETTINGS"
    chmod 644 "$CLAUDE_SETTINGS"
    chflags schg "$CLAUDE_SETTINGS"
    log "REINSTALLED: hooks restored and file relocked"
fi

# 5. Check system policy exists
if [[ ! -f "$SYSTEM_DIR/policy.yml" ]]; then
    log "CRITICAL: system policy missing at $SYSTEM_DIR/policy.yml"
fi

# 6. Check system policy ownership
if [[ -f "$SYSTEM_DIR/policy.yml" ]]; then
    POWNER=$(stat -f "%Su:%Sg" "$SYSTEM_DIR/policy.yml" 2>/dev/null)
    if [[ "$POWNER" != "root:wheel" ]]; then
        log "WARNING: policy.yml owned by $POWNER — fixing"
        chown root:wheel "$SYSTEM_DIR/policy.yml"
        chmod 644 "$SYSTEM_DIR/policy.yml"
        log "FIXED: policy ownership restored"
    fi
fi

# 7. Verify user audit data directory permissions
USER_PW="$USER_HOME/.patchwork"
if [[ -d "$USER_PW" ]]; then
    DIR_PERMS=$(stat -f "%Lp" "$USER_PW" 2>/dev/null)
    if [[ "$DIR_PERMS" != "700" ]]; then
        chmod 700 "$USER_PW"
        log "FIXED: .patchwork directory permissions to 0700"
    fi
fi

# 8. Rotate log if > 500KB
LOG_FILE="$SYSTEM_DIR/watchdog.log"
if [[ -f "$LOG_FILE" ]] && [[ "$(stat -f%z "$LOG_FILE" 2>/dev/null || echo 0)" -gt 512000 ]]; then
    tail -500 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
    log "ROTATED: watchdog log trimmed"
fi
WATCHDOG

chown root:wheel "$SYSTEM_DIR/system-watchdog.sh"
chmod 755 "$SYSTEM_DIR/system-watchdog.sh"

# Unload existing daemon if present, then load
launchctl unload "$DAEMON_PLIST" 2>/dev/null || true
launchctl load "$DAEMON_PLIST"

echo ""
echo "=== System Install Complete ==="
echo ""
echo "  Protected files:"
echo "    $CLAUDE_SETTINGS         (root:wheel, 644, schg)"
echo "    $SYSTEM_DIR/policy.yml   (root:wheel, 644)"
echo "    $SYSTEM_DIR/guard.sh     (root:wheel, 755)"
echo ""
echo "  System daemon:"
echo "    $DAEMON_PLIST"
echo "    Runs every 15 minutes + at boot"
echo "    Cannot be unloaded by non-admin users"
echo ""
echo "  What non-admin users CANNOT do:"
echo "    - Modify ~/.claude/settings.json (root-owned + schg flag)"
echo "    - Modify /Library/Patchwork/policy.yml (root-owned)"
echo "    - Unload the watchdog daemon (requires root)"
echo "    - The AI agent cannot disable its own monitoring"
echo ""
echo "  To uninstall:"
echo "    sudo bash $REPO_DIR/scripts/system-uninstall.sh --user $TARGET_USER"
