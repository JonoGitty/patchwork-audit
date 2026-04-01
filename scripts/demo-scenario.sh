#!/bin/bash
# Patchwork Demo Scenario — generates realistic audit data for demo videos.
#
# This script simulates a Claude Code session that:
# 1. Does normal development work (file reads, writes, commands)
# 2. Attempts something dangerous (gets blocked by policy)
# 3. Accesses sensitive files (gets flagged)
# 4. Then generates a replay + compliance report
#
# Usage:
#   bash scripts/demo-scenario.sh
#
# Prerequisites:
#   - Patchwork hooks installed (patchwork init claude-code --strict-profile)
#   - Policy active (patchwork policy init --strict OR ~/.patchwork/policy.yml)
#
# After running, demonstrate:
#   - patchwork log                    (see all events)
#   - patchwork log --risk high        (see blocked/flagged events)
#   - patchwork replay <session-id>    (step through timeline)
#   - patchwork report --framework all --include-gaps -o demo-report.html
#   - patchwork dashboard              (open localhost:3000)
#   - patchwork doctor                 (health check)

set -euo pipefail

# --- Find working node + patchwork ---
for candidate in \
    "$HOME/local/nodejs/"node-*/bin \
    /usr/local/bin \
    /opt/homebrew/bin; do
    if [ -x "$candidate/node" ] && "$candidate/node" --version &>/dev/null; then
        export PATH="$candidate:$PATH"
        break
    fi
done

NODE=$(command -v node)
PW=$(command -v patchwork)

if [ -z "$PW" ]; then
    echo "Error: patchwork not found. Run: npm install -g patchwork-audit"
    exit 1
fi

echo ""
echo "  ┌──────────────────────────────────────────┐"
echo "  │  Patchwork Demo Scenario                  │"
echo "  │  Generating realistic audit data...       │"
echo "  └──────────────────────────────────────────┘"
echo ""

SESSION="demo-$(date +%Y%m%d-%H%M%S)"
DEMO_DIR=$(mktemp -d)
cd "$DEMO_DIR"
git init -q

echo "  Session: $SESSION"
echo "  Demo dir: $DEMO_DIR"
echo ""

# Helper: simulate a hook event
hook_event() {
    local event="$1"
    local json="$2"
    echo "$json" | "$NODE" "$PW" hook "$event" 2>/dev/null || true
}

# --- Phase 1: Normal development ---
echo "  [Phase 1] Normal development..."

# Session start
hook_event "session-start" "{\"session_id\":\"$SESSION\",\"cwd\":\"$DEMO_DIR\"}"

# Read some files
for file in "src/index.ts" "src/auth/middleware.ts" "package.json" "README.md"; do
    hook_event "post-tool" "{\"session_id\":\"$SESSION\",\"tool_name\":\"Read\",\"tool_input\":{\"file_path\":\"$file\"},\"cwd\":\"$DEMO_DIR\"}"
    sleep 0.2
done
echo "    ✓ 4 file reads"

# Write some code
for file in "src/api/routes.ts" "src/utils/helpers.ts" "src/config.ts"; do
    hook_event "post-tool" "{\"session_id\":\"$SESSION\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$file\",\"content\":\"// generated code\"},\"cwd\":\"$DEMO_DIR\"}"
    sleep 0.2
done
echo "    ✓ 3 file writes"

# Run tests
hook_event "post-tool" "{\"session_id\":\"$SESSION\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"npm test\"},\"cwd\":\"$DEMO_DIR\"}"
hook_event "post-tool" "{\"session_id\":\"$SESSION\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"npm run lint\"},\"cwd\":\"$DEMO_DIR\"}"
echo "    ✓ 2 commands (npm test, npm run lint)"

# --- Phase 2: Something dangerous ---
echo ""
echo "  [Phase 2] Dangerous operations (should be DENIED)..."

# Try rm -rf
hook_event "pre-tool" "{\"session_id\":\"$SESSION\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"rm -rf /\"},\"tool_use_id\":\"danger_1\",\"cwd\":\"$DEMO_DIR\"}"
echo "    ✗ rm -rf / — DENIED"

# Try sudo
hook_event "pre-tool" "{\"session_id\":\"$SESSION\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"sudo rm /etc/hosts\"},\"tool_use_id\":\"danger_2\",\"cwd\":\"$DEMO_DIR\"}"
echo "    ✗ sudo rm /etc/hosts — DENIED"

# Try git push --force
hook_event "pre-tool" "{\"session_id\":\"$SESSION\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git push --force origin main\"},\"tool_use_id\":\"danger_3\",\"cwd\":\"$DEMO_DIR\"}"
echo "    ✗ git push --force — DENIED"

# Try ssh
hook_event "pre-tool" "{\"session_id\":\"$SESSION\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"ssh root@production-server\"},\"tool_use_id\":\"danger_4\",\"cwd\":\"$DEMO_DIR\"}"
echo "    ✗ ssh root@production — DENIED"

# --- Phase 3: Sensitive file access ---
echo ""
echo "  [Phase 3] Sensitive file access (flagged)..."

# Try to read .env
hook_event "pre-tool" "{\"session_id\":\"$SESSION\",\"tool_name\":\"Read\",\"tool_input\":{\"file_path\":\".env\"},\"tool_use_id\":\"sensitive_1\",\"cwd\":\"$DEMO_DIR\"}"
echo "    ⚠ .env read — HIGH RISK"

# Try to read credentials
hook_event "pre-tool" "{\"session_id\":\"$SESSION\",\"tool_name\":\"Read\",\"tool_input\":{\"file_path\":\".aws/credentials\"},\"tool_use_id\":\"sensitive_2\",\"cwd\":\"$DEMO_DIR\"}"
echo "    ⚠ .aws/credentials — HIGH RISK"

# Try to read SSH key
hook_event "pre-tool" "{\"session_id\":\"$SESSION\",\"tool_name\":\"Read\",\"tool_input\":{\"file_path\":\".ssh/id_rsa\"},\"tool_use_id\":\"sensitive_3\",\"cwd\":\"$DEMO_DIR\"}"
echo "    ⚠ .ssh/id_rsa — HIGH RISK"

# --- Phase 4: More normal work ---
echo ""
echo "  [Phase 4] More normal work..."

hook_event "post-tool" "{\"session_id\":\"$SESSION\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git add -A\"},\"cwd\":\"$DEMO_DIR\"}"
hook_event "post-tool" "{\"session_id\":\"$SESSION\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git commit -m 'Add API routes'\"},\"cwd\":\"$DEMO_DIR\"}"
hook_event "post-tool" "{\"session_id\":\"$SESSION\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git push origin main\"},\"cwd\":\"$DEMO_DIR\"}"
echo "    ✓ git add, commit, push (normal push allowed)"

# Session end
hook_event "session-end" "{\"session_id\":\"$SESSION\",\"cwd\":\"$DEMO_DIR\"}"

# --- Phase 5: Generate outputs ---
echo ""
echo "  [Phase 5] Generating outputs..."

# Wait for events to be written
sleep 1

echo ""
echo "  ── Results ──"
echo ""

# Show event count
EVENTS=$("$NODE" "$PW" log --session "$SESSION" 2>/dev/null | tail -1)
echo "  Events: $EVENTS"

# Show risk events
echo ""
echo "  High-risk events:"
"$NODE" "$PW" log --session "$SESSION" --risk high 2>/dev/null || echo "  (none)"

echo ""
echo "  ── Ready for demo ──"
echo ""
echo "  Run these commands to showcase Patchwork:"
echo ""
echo "    patchwork log --session $SESSION"
echo "    patchwork replay $SESSION --all"
echo "    patchwork replay $SESSION --html -o ~/Desktop/demo-replay.html"
echo "    patchwork report --framework all --include-gaps -o ~/Desktop/demo-report.html"
echo "    patchwork doctor"
echo "    open http://localhost:3000"
echo ""

# Cleanup
rm -rf "$DEMO_DIR"
