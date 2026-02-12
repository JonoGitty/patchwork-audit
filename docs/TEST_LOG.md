# Test Log

Rolling record of test runs during development.

## How To Update

- Run `pnpm test:log` from repo root.
- The command runs tests for each package and appends a timestamped entry here.

## 2026-02-12T17:30:38.000Z

- Overall status: PASS
- Totals: 265/265 passed, 0 failed across 73 suites

### @patchwork/core
- Status: PASS
- Totals: 163/163 passed, 0 failed, 0 skipped/todo across 48 suites
- Coverage by test file:
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (35 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 64/64 passed, 0 failed, 0 skipped/todo across 15 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (23 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (9 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 38/38 passed, 0 failed, 0 skipped/todo across 10 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---
