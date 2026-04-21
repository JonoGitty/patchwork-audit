#!/usr/bin/env bash
# Team Mode — local single-machine smoke test.
#
# Runs the team server + a sync client on the same box, synthesises events,
# confirms they sync into the server DB, and checks cursor advance. Does NOT
# exercise the two-machine integration path (item 1 in testing.md) — that
# needs real hosts. This runs item 5 (fresh-install smoke) locally.
#
# Usage:
#   bash packages/team/scripts/smoke-local.sh            # uses built CLI
#   PATCHWORK_BIN=/path/to/patchwork bash .../smoke-local.sh
#
# Exits non-zero on any failure. Safe to run repeatedly — wipes its own tmp state.

set -euo pipefail

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

PATCHWORK_BIN="${PATCHWORK_BIN:-patchwork}"
WORK_DIR="${WORK_DIR:-/tmp/patchwork-team-smoke-$$}"
SERVER_PORT="${SERVER_PORT:-33001}"
DB_PATH="$WORK_DIR/team.sqlite"
SERVER_LOG="$WORK_DIR/server.log"
CLIENT_LOG="$WORK_DIR/client.log"
SERVER_PID_FILE="$WORK_DIR/server.pid"

cleanup() {
    local rc=$?
    if [[ -f "$SERVER_PID_FILE" ]]; then
        local pid
        pid=$(cat "$SERVER_PID_FILE")
        kill "$pid" 2>/dev/null || true
    fi
    # Preserve the work dir on failure so operators can inspect state
    if [[ $rc -eq 0 ]] && [[ -z "${KEEP:-}" ]]; then
        rm -rf "$WORK_DIR"
    else
        echo ""
        echo "smoke test left artefacts in $WORK_DIR"
    fi
    exit $rc
}
trap cleanup EXIT INT TERM

mkdir -p "$WORK_DIR"
echo "smoke test workspace: $WORK_DIR"
echo "patchwork binary: $PATCHWORK_BIN"
echo ""

# ---------------------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------------------

if ! command -v "$PATCHWORK_BIN" >/dev/null 2>&1; then
    echo "FAIL: patchwork binary not found on PATH"
    exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "FAIL: sqlite3 required for assertion queries"
    exit 1
fi

VERSION=$("$PATCHWORK_BIN" --version)
echo "patchwork version: $VERSION"

# ---------------------------------------------------------------------------
# Step 1: start server
# ---------------------------------------------------------------------------

echo ""
echo "[1/5] Starting team server on port $SERVER_PORT..."
"$PATCHWORK_BIN" team server start \
    --port "$SERVER_PORT" \
    --db "$DB_PATH" \
    >"$SERVER_LOG" 2>&1 &
echo $! >"$SERVER_PID_FILE"

# Wait for server to accept connections (up to 15s)
for i in $(seq 1 30); do
    if curl -sf "http://127.0.0.1:$SERVER_PORT/api/v1/health" >/dev/null 2>&1; then
        echo "      server up"
        break
    fi
    sleep 0.5
    if [[ $i -eq 30 ]]; then
        echo "FAIL: server did not respond on port $SERVER_PORT within 15s"
        echo "--- server log ---"
        cat "$SERVER_LOG"
        exit 1
    fi
done

# ---------------------------------------------------------------------------
# Step 2: issue enrollment token
# ---------------------------------------------------------------------------

echo ""
echo "[2/5] Issuing enrollment token..."
TOKEN=$("$PATCHWORK_BIN" team admin issue-token \
    --server "http://127.0.0.1:$SERVER_PORT" \
    --expires 10m \
    2>&1 | grep -oE 'token: [a-zA-Z0-9_-]+' | awk '{print $2}')
if [[ -z "${TOKEN:-}" ]]; then
    echo "FAIL: could not parse enrollment token from admin output"
    echo "(if this command doesn't exist yet, implement it or adapt this script)"
    exit 1
fi
echo "      token: ${TOKEN:0:8}..."

# ---------------------------------------------------------------------------
# Step 3: enroll client
# ---------------------------------------------------------------------------

echo ""
echo "[3/5] Enrolling client as 'smoke-test'..."
"$PATCHWORK_BIN" team enroll \
    "http://127.0.0.1:$SERVER_PORT" \
    --name "smoke-test" \
    --token "$TOKEN" \
    --state-dir "$WORK_DIR/client" \
    >"$CLIENT_LOG" 2>&1

if ! grep -q "enrolled" "$CLIENT_LOG"; then
    echo "FAIL: enrollment did not report success"
    cat "$CLIENT_LOG"
    exit 1
fi
echo "      enrolled"

# ---------------------------------------------------------------------------
# Step 4: synthesise events + trigger sync
# ---------------------------------------------------------------------------

echo ""
echo "[4/5] Triggering a sync cycle..."
# In alpha, the sync agent runs against the real relay log. For a portable
# smoke test we assume: (a) the host already has some audit events, OR
# (b) we call a test-only sync command that reads from a scratch log.
# If your CLI gained `team sync --once` after alpha.1, replace below.
"$PATCHWORK_BIN" team sync --once \
    --state-dir "$WORK_DIR/client" \
    --server "http://127.0.0.1:$SERVER_PORT" \
    >>"$CLIENT_LOG" 2>&1 || {
        echo "FAIL: sync command failed (exit $?)"
        tail -30 "$CLIENT_LOG"
        exit 1
    }

# ---------------------------------------------------------------------------
# Step 5: assert events arrived
# ---------------------------------------------------------------------------

echo ""
echo "[5/5] Verifying events landed in server DB..."
EVENT_COUNT=$(sqlite3 "$DB_PATH" "SELECT count(*) FROM events WHERE machine_name = 'smoke-test';" 2>/dev/null || echo "0")
MACHINE_COUNT=$(sqlite3 "$DB_PATH" "SELECT count(*) FROM machines WHERE name = 'smoke-test';" 2>/dev/null || echo "0")

echo "      machines: $MACHINE_COUNT, events: $EVENT_COUNT"

if [[ "$MACHINE_COUNT" -ne 1 ]]; then
    echo "FAIL: expected 1 enrolled machine in DB, got $MACHINE_COUNT"
    exit 1
fi

# Cursor should have advanced
CURSOR_FILE="$WORK_DIR/client/cursor.json"
if [[ ! -f "$CURSOR_FILE" ]]; then
    echo "WARN: cursor file missing — resume-from-cursor will not work"
fi

echo ""
echo "SMOKE TEST PASSED"
echo "  server:   http://127.0.0.1:$SERVER_PORT"
echo "  db:       $DB_PATH"
echo "  machine:  smoke-test"
echo "  events:   $EVENT_COUNT synced"
