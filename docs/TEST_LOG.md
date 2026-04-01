# Test Log

Rolling record of test runs during development.

## How To Update

- Run `pnpm test:log` from repo root.
- The command runs tests for each package and appends a timestamped entry here.
- Run `pnpm hooks:install` once to enable the local `pre-push` hook that runs `pnpm test:log`.
- CI also runs `pnpm test:log` on Node 22 and uploads this file as an artifact.

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

## 2026-02-12T17:33:11.999Z

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

## 2026-02-12T17:41:39.004Z

- Overall status: PASS
- Totals: 270/270 passed, 0 failed across 73 suites

### @patchwork/core
- Status: PASS
- Totals: 168/168 passed, 0 failed, 0 skipped/todo across 48 suites
- Coverage by test file:
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (40 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
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

## 2026-02-12T17:43:14.855Z

- Overall status: PASS
- Totals: 270/270 passed, 0 failed across 73 suites

### @patchwork/core
- Status: PASS
- Totals: 168/168 passed, 0 failed, 0 skipped/todo across 48 suites
- Coverage by test file:
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (40 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
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

## 2026-02-12T17:51:13.854Z

- Overall status: PASS
- Totals: 272/272 passed, 0 failed across 74 suites

### @patchwork/core
- Status: PASS
- Totals: 170/170 passed, 0 failed, 0 skipped/todo across 49 suites
- Coverage by test file:
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (42 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
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

## 2026-02-12T17:54:25.733Z

- Overall status: PASS
- Totals: 272/272 passed, 0 failed across 74 suites

### @patchwork/core
- Status: PASS
- Totals: 170/170 passed, 0 failed, 0 skipped/todo across 49 suites
- Coverage by test file:
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (42 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
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

## 2026-02-12T18:01:32.691Z

- Overall status: PASS
- Totals: 300/300 passed, 0 failed across 81 suites

### @patchwork/core
- Status: PASS
- Totals: 194/194 passed, 0 failed, 0 skipped/todo across 54 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (24 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (42 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
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
- Totals: 42/42 passed, 0 failed, 0 skipped/todo across 12 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/verify.test.ts` (4 tests): verify command logic. Example cases: passes for a valid chain written to JSONL; detects tampered event in chain; strict mode flags legacy events.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T18:02:07.834Z

- Overall status: PASS
- Totals: 300/300 passed, 0 failed across 81 suites

### @patchwork/core
- Status: PASS
- Totals: 194/194 passed, 0 failed, 0 skipped/todo across 54 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (24 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (42 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
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
- Totals: 42/42 passed, 0 failed, 0 skipped/todo across 12 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/verify.test.ts` (4 tests): verify command logic. Example cases: passes for a valid chain written to JSONL; detects tampered event in chain; strict mode flags legacy events.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T18:13:35.164Z

- Overall status: PASS
- Totals: 303/303 passed, 0 failed across 81 suites

### @patchwork/core
- Status: PASS
- Totals: 196/196 passed, 0 failed, 0 skipped/todo across 54 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (43 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
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
- Totals: 43/43 passed, 0 failed, 0 skipped/todo across 12 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/verify.test.ts` (5 tests): verify command. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T18:19:14.735Z

- Overall status: PASS
- Totals: 330/330 passed, 0 failed across 89 suites

### @patchwork/core
- Status: PASS
- Totals: 214/214 passed, 0 failed, 0 skipped/todo across 59 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (18 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (43 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
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
- Totals: 52/52 passed, 0 failed, 0 skipped/todo across 15 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (9 tests): seal command, verify with seal. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/verify.test.ts` (5 tests): verify command. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T18:20:42.029Z

- Overall status: PASS
- Totals: 330/330 passed, 0 failed across 89 suites

### @patchwork/core
- Status: PASS
- Totals: 214/214 passed, 0 failed, 0 skipped/todo across 59 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (18 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (43 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
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
- Totals: 52/52 passed, 0 failed, 0 skipped/todo across 15 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (9 tests): seal command, verify with seal. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/verify.test.ts` (5 tests): verify command. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T18:24:56.296Z

- Overall status: PASS
- Totals: 338/338 passed, 0 failed across 91 suites

### @patchwork/core
- Status: PASS
- Totals: 214/214 passed, 0 failed, 0 skipped/todo across 59 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (18 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (43 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
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
- Totals: 60/60 passed, 0 failed, 0 skipped/todo across 17 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (15 tests): seal command, verify with seal, verify --require-seal, verify --max-seal-age-seconds. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/verify.test.ts` (7 tests): verify command. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T18:25:12.120Z

- Overall status: PASS
- Totals: 338/338 passed, 0 failed across 91 suites

### @patchwork/core
- Status: PASS
- Totals: 214/214 passed, 0 failed, 0 skipped/todo across 59 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (18 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (43 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
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
- Totals: 60/60 passed, 0 failed, 0 skipped/todo across 17 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (15 tests): seal command, verify with seal, verify --require-seal, verify --max-seal-age-seconds. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/verify.test.ts` (7 tests): verify command. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T18:26:16.531Z

- Overall status: PASS
- Totals: 338/338 passed, 0 failed across 91 suites

### @patchwork/core
- Status: PASS
- Totals: 214/214 passed, 0 failed, 0 skipped/todo across 59 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (18 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (43 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
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
- Totals: 60/60 passed, 0 failed, 0 skipped/todo across 17 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (15 tests): seal command, verify with seal, verify --require-seal, verify --max-seal-age-seconds. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/verify.test.ts` (7 tests): verify command. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T18:33:31.777Z

- Overall status: PASS
- Totals: 350/350 passed, 0 failed across 93 suites

### @patchwork/core
- Status: PASS
- Totals: 214/214 passed, 0 failed, 0 skipped/todo across 59 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (18 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (43 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
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
- Totals: 72/72 passed, 0 failed, 0 skipped/todo across 19 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (19 tests): seal command, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/verify.test.ts` (15 tests): verify command, verify --max-seal-age-seconds input validation. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T18:34:44.762Z

- Overall status: PASS
- Totals: 350/350 passed, 0 failed across 93 suites

### @patchwork/core
- Status: PASS
- Totals: 214/214 passed, 0 failed, 0 skipped/todo across 59 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (18 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (43 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
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
- Totals: 72/72 passed, 0 failed, 0 skipped/todo across 19 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (19 tests): seal command, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/verify.test.ts` (15 tests): verify command, verify --max-seal-age-seconds input validation. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T18:40:28.985Z

- Overall status: PASS
- Totals: 359/359 passed, 0 failed across 95 suites

### @patchwork/core
- Status: PASS
- Totals: 214/214 passed, 0 failed, 0 skipped/todo across 59 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (18 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (43 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
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
- Totals: 81/81 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (28 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/verify.test.ts` (15 tests): verify command, verify --max-seal-age-seconds input validation. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T18:42:29.936Z

- Overall status: PASS
- Totals: 359/359 passed, 0 failed across 95 suites

### @patchwork/core
- Status: PASS
- Totals: 214/214 passed, 0 failed, 0 skipped/todo across 59 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (18 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (43 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
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
- Totals: 81/81 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (28 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/verify.test.ts` (15 tests): verify command, verify --max-seal-age-seconds input validation. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T18:43:35.347Z

- Overall status: PASS
- Totals: 359/359 passed, 0 failed across 95 suites

### @patchwork/core
- Status: PASS
- Totals: 214/214 passed, 0 failed, 0 skipped/todo across 59 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (18 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (43 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
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
- Totals: 81/81 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (28 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/verify.test.ts` (15 tests): verify command, verify --max-seal-age-seconds input validation. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T18:53:00.429Z

- Overall status: PASS
- Totals: 361/361 passed, 0 failed across 96 suites

### @patchwork/core
- Status: PASS
- Totals: 214/214 passed, 0 failed, 0 skipped/todo across 59 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (18 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (43 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
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
- Totals: 83/83 passed, 0 failed, 0 skipped/todo across 22 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (30 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/verify.test.ts` (15 tests): verify command, verify --max-seal-age-seconds input validation. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T18:54:33.263Z

- Overall status: PASS
- Totals: 361/361 passed, 0 failed across 96 suites

### @patchwork/core
- Status: PASS
- Totals: 214/214 passed, 0 failed, 0 skipped/todo across 59 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (18 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (43 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
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
- Totals: 83/83 passed, 0 failed, 0 skipped/todo across 22 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (30 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/verify.test.ts` (15 tests): verify command, verify --max-seal-age-seconds input validation. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T18:56:41.251Z

- Overall status: FAIL
- Totals: 360/361 passed, 1 failed across 96 suites

### @patchwork/core
- Status: PASS
- Totals: 214/214 passed, 0 failed, 0 skipped/todo across 59 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (18 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (43 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
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
- Status: FAIL
- Totals: 82/83 passed, 1 failed, 0 skipped/todo across 22 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (30 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/verify.test.ts` (15 tests): verify command, verify --max-seal-age-seconds input validation. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T18:57:03.079Z

- Overall status: PASS
- Totals: 361/361 passed, 0 failed across 96 suites

### @patchwork/core
- Status: PASS
- Totals: 214/214 passed, 0 failed, 0 skipped/todo across 59 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (18 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (43 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
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
- Totals: 83/83 passed, 0 failed, 0 skipped/todo across 22 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (30 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/verify.test.ts` (15 tests): verify command, verify --max-seal-age-seconds input validation. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T18:58:25.169Z

- Overall status: FAIL
- Totals: 360/361 passed, 1 failed across 96 suites

### @patchwork/core
- Status: PASS
- Totals: 214/214 passed, 0 failed, 0 skipped/todo across 59 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (18 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (43 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
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
- Status: FAIL
- Totals: 82/83 passed, 1 failed, 0 skipped/todo across 22 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (30 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/verify.test.ts` (15 tests): verify command, verify --max-seal-age-seconds input validation. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T18:59:07.926Z

- Overall status: PASS
- Totals: 361/361 passed, 0 failed across 96 suites

### @patchwork/core
- Status: PASS
- Totals: 214/214 passed, 0 failed, 0 skipped/todo across 59 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (18 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (43 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
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
- Totals: 83/83 passed, 0 failed, 0 skipped/todo across 22 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (30 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/verify.test.ts` (15 tests): verify command, verify --max-seal-age-seconds input validation. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T19:00:06.133Z

- Overall status: PASS
- Totals: 361/361 passed, 0 failed across 96 suites

### @patchwork/core
- Status: PASS
- Totals: 214/214 passed, 0 failed, 0 skipped/todo across 59 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (18 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (43 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
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
- Totals: 83/83 passed, 0 failed, 0 skipped/todo across 22 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (30 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/verify.test.ts` (15 tests): verify command, verify --max-seal-age-seconds input validation. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T19:02:43.675Z

- Overall status: PASS
- Totals: 361/361 passed, 0 failed across 96 suites

### @patchwork/core
- Status: PASS
- Totals: 214/214 passed, 0 failed, 0 skipped/todo across 59 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (18 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (43 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
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
- Totals: 83/83 passed, 0 failed, 0 skipped/todo across 22 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (30 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/verify.test.ts` (15 tests): verify command, verify --max-seal-age-seconds input validation. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T19:13:13.760Z

- Overall status: PASS
- Totals: 373/373 passed, 0 failed across 97 suites

### @patchwork/core
- Status: PASS
- Totals: 214/214 passed, 0 failed, 0 skipped/todo across 59 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (18 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (43 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 76/76 passed, 0 failed, 0 skipped/todo across 16 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (35 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (9 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 83/83 passed, 0 failed, 0 skipped/todo across 22 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (30 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/verify.test.ts` (15 tests): verify command, verify --max-seal-age-seconds input validation. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T19:15:15.909Z

- Overall status: PASS
- Totals: 373/373 passed, 0 failed across 97 suites

### @patchwork/core
- Status: PASS
- Totals: 214/214 passed, 0 failed, 0 skipped/todo across 59 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (18 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (24 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (43 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 76/76 passed, 0 failed, 0 skipped/todo across 16 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (35 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (9 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 83/83 passed, 0 failed, 0 skipped/todo across 22 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (30 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/verify.test.ts` (15 tests): verify command, verify --max-seal-age-seconds input validation. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T19:21:54.673Z

- Overall status: PASS
- Totals: 385/385 passed, 0 failed across 99 suites

### @patchwork/core
- Status: PASS
- Totals: 226/226 passed, 0 failed, 0 skipped/todo across 61 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (18 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (43 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 76/76 passed, 0 failed, 0 skipped/todo across 16 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (35 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (9 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 83/83 passed, 0 failed, 0 skipped/todo across 22 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (30 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/verify.test.ts` (15 tests): verify command, verify --max-seal-age-seconds input validation. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T19:33:33.249Z

- Overall status: PASS
- Totals: 385/385 passed, 0 failed across 99 suites

### @patchwork/core
- Status: PASS
- Totals: 226/226 passed, 0 failed, 0 skipped/todo across 61 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (18 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (43 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 76/76 passed, 0 failed, 0 skipped/todo across 16 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (35 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (9 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 83/83 passed, 0 failed, 0 skipped/todo across 22 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (30 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/verify.test.ts` (15 tests): verify command, verify --max-seal-age-seconds input validation. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T19:50:07.512Z

- Overall status: PASS
- Totals: 390/390 passed, 0 failed across 100 suites

### @patchwork/core
- Status: PASS
- Totals: 231/231 passed, 0 failed, 0 skipped/todo across 62 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (18 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 76/76 passed, 0 failed, 0 skipped/todo across 16 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (35 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (9 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 83/83 passed, 0 failed, 0 skipped/todo across 22 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (30 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/verify.test.ts` (15 tests): verify command, verify --max-seal-age-seconds input validation. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T20:15:34.626Z

- Overall status: PASS
- Totals: 390/390 passed, 0 failed across 100 suites

### @patchwork/core
- Status: PASS
- Totals: 231/231 passed, 0 failed, 0 skipped/todo across 62 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (18 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 76/76 passed, 0 failed, 0 skipped/todo across 16 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (35 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (9 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 83/83 passed, 0 failed, 0 skipped/todo across 22 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (30 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/verify.test.ts` (15 tests): verify command, verify --max-seal-age-seconds input validation. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T20:27:17.908Z

- Overall status: PASS
- Totals: 416/416 passed, 0 failed across 106 suites

### @patchwork/core
- Status: PASS
- Totals: 248/248 passed, 0 failed, 0 skipped/todo across 66 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 76/76 passed, 0 failed, 0 skipped/todo across 16 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (35 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (9 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 92/92 passed, 0 failed, 0 skipped/todo across 24 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/verify.test.ts` (15 tests): verify command, verify --max-seal-age-seconds input validation. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T22:26:27.546Z

- Overall status: PASS
- Totals: 429/429 passed, 0 failed across 110 suites

### @patchwork/core
- Status: PASS
- Totals: 248/248 passed, 0 failed, 0 skipped/todo across 66 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 81/81 passed, 0 failed, 0 skipped/todo across 17 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (9 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 100/100 passed, 0 failed, 0 skipped/todo across 27 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (8 tests): sync db-status, sync db clears marker. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (15 tests): verify command, verify --max-seal-age-seconds input validation. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T22:38:05.314Z

- Overall status: PASS
- Totals: 432/432 passed, 0 failed across 111 suites

### @patchwork/core
- Status: PASS
- Totals: 248/248 passed, 0 failed, 0 skipped/todo across 66 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 81/81 passed, 0 failed, 0 skipped/todo across 17 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (9 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 103/103 passed, 0 failed, 0 skipped/todo across 28 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (11 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (15 tests): verify command, verify --max-seal-age-seconds input validation. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T22:55:42.931Z

- Overall status: PASS
- Totals: 467/467 passed, 0 failed across 121 suites

### @patchwork/core
- Status: PASS
- Totals: 248/248 passed, 0 failed, 0 skipped/todo across 66 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 121/121 passed, 0 failed, 0 skipped/todo across 34 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/hook.test.ts` (10 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (8 tests): init --pretool flags. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (11 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (15 tests): verify command, verify --max-seal-age-seconds input validation. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T22:57:33.519Z

- Overall status: PASS
- Totals: 467/467 passed, 0 failed across 121 suites

### @patchwork/core
- Status: PASS
- Totals: 248/248 passed, 0 failed, 0 skipped/todo across 66 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 121/121 passed, 0 failed, 0 skipped/todo across 34 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/hook.test.ts` (10 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (8 tests): init --pretool flags. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (11 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (15 tests): verify command, verify --max-seal-age-seconds input validation. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-12T23:15:40.035Z

- Overall status: PASS
- Totals: 482/482 passed, 0 failed across 123 suites

### @patchwork/core
- Status: PASS
- Totals: 248/248 passed, 0 failed, 0 skipped/todo across 66 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 136/136 passed, 0 failed, 0 skipped/todo across 36 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/hook.test.ts` (14 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (15 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (15 tests): verify command, verify --max-seal-age-seconds input validation. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-13T00:32:02.407Z

- Overall status: PASS
- Totals: 544/544 passed, 0 failed across 138 suites

### @patchwork/core
- Status: PASS
- Totals: 270/270 passed, 0 failed, 0 skipped/todo across 71 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 176/176 passed, 0 failed, 0 skipped/todo across 46 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (29 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (10 tests): witness publish, witness lock concurrency. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-13T00:35:10.384Z

- Overall status: PASS
- Totals: 544/544 passed, 0 failed across 138 suites

### @patchwork/core
- Status: PASS
- Totals: 270/270 passed, 0 failed, 0 skipped/todo across 71 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 176/176 passed, 0 failed, 0 skipped/todo across 46 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (29 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (10 tests): witness publish, witness lock concurrency. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-13T00:35:44.786Z

- Overall status: PASS
- Totals: 544/544 passed, 0 failed across 138 suites

### @patchwork/core
- Status: PASS
- Totals: 270/270 passed, 0 failed, 0 skipped/todo across 71 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 176/176 passed, 0 failed, 0 skipped/todo across 46 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (29 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (10 tests): witness publish, witness lock concurrency. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-13T12:16:29.152Z

- Overall status: PASS
- Totals: 555/555 passed, 0 failed across 140 suites

### @patchwork/core
- Status: PASS
- Totals: 270/270 passed, 0 failed, 0 skipped/todo across 71 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 187/187 passed, 0 failed, 0 skipped/todo across 48 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (11 tests): patchwork attest. Example cases: A: writes attestation artifact on successful verification; B: non-zero exit when --require-seal and no seal file; C: non-zero exit when --require-witness and no witness file.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (29 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (10 tests): witness publish, witness lock concurrency. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-13T12:19:26.784Z

- Overall status: FAIL
- Totals: 548/555 passed, 7 failed across 140 suites

### @patchwork/core
- Status: PASS
- Totals: 270/270 passed, 0 failed, 0 skipped/todo across 71 suites
- Coverage by test file:
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: FAIL
- Totals: 180/187 passed, 7 failed, 0 skipped/todo across 48 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (11 tests): patchwork attest. Example cases: A: writes attestation artifact on successful verification; B: non-zero exit when --require-seal and no seal file; C: non-zero exit when --require-witness and no witness file.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (29 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (10 tests): witness publish, witness lock concurrency. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-13T12:28:05.715Z

- Overall status: PASS
- Totals: 573/573 passed, 0 failed across 146 suites

### @patchwork/core
- Status: PASS
- Totals: 281/281 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (11 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 194/194 passed, 0 failed, 0 skipped/todo across 50 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (18 tests): patchwork attest, attest tool_version, attest history mode. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (29 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (10 tests): witness publish, witness lock concurrency. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-13T12:32:52.527Z

- Overall status: PASS
- Totals: 573/573 passed, 0 failed across 146 suites

### @patchwork/core
- Status: PASS
- Totals: 281/281 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (11 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 194/194 passed, 0 failed, 0 skipped/todo across 50 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (18 tests): patchwork attest, attest tool_version, attest history mode. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (29 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (10 tests): witness publish, witness lock concurrency. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-13T12:38:48.554Z

- Overall status: PASS
- Totals: 592/592 passed, 0 failed across 148 suites

### @patchwork/core
- Status: PASS
- Totals: 284/284 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 210/210 passed, 0 failed, 0 skipped/todo across 52 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (23 tests): patchwork attest, attest tool_version, attest history mode, attest --max-history-files validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (40 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (10 tests): witness publish, witness lock concurrency. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-13T12:40:56.443Z

- Overall status: FAIL
- Totals: 585/592 passed, 7 failed across 148 suites

### @patchwork/core
- Status: PASS
- Totals: 284/284 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: FAIL
- Totals: 203/210 passed, 7 failed, 0 skipped/todo across 52 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (23 tests): patchwork attest, attest tool_version, attest history mode, attest --max-history-files validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (40 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (10 tests): witness publish, witness lock concurrency. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-13T12:48:39.481Z

- Overall status: PASS
- Totals: 597/597 passed, 0 failed across 148 suites

### @patchwork/core
- Status: PASS
- Totals: 284/284 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 215/215 passed, 0 failed, 0 skipped/todo across 52 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (23 tests): patchwork attest, attest tool_version, attest history mode, attest --max-history-files validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (45 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (10 tests): witness publish, witness lock concurrency. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-13T13:02:26.692Z

- Overall status: PASS
- Totals: 605/605 passed, 0 failed across 149 suites

### @patchwork/core
- Status: PASS
- Totals: 284/284 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 223/223 passed, 0 failed, 0 skipped/todo across 53 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (25 tests): patchwork attest, attest tool_version, attest history mode, attest --max-history-files validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (51 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (10 tests): witness publish, witness lock concurrency. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-13T13:03:56.372Z

- Overall status: PASS
- Totals: 605/605 passed, 0 failed across 149 suites

### @patchwork/core
- Status: PASS
- Totals: 284/284 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 223/223 passed, 0 failed, 0 skipped/todo across 53 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (25 tests): patchwork attest, attest tool_version, attest history mode, attest --max-history-files validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (51 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (10 tests): witness publish, witness lock concurrency. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.


---

## 2026-02-13T13:31:35.913Z

- Overall status: PASS
- Totals: 627/627 passed, 0 failed across 155 suites

### @patchwork/core
- Status: PASS
- Totals: 284/284 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 245/245 passed, 0 failed, 0 skipped/todo across 59 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (25 tests): patchwork attest, attest tool_version, attest history mode, attest --max-history-files validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (59 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-02-13T13:33:49.571Z

- Overall status: FAIL
- Totals: 620/627 passed, 7 failed across 155 suites

### @patchwork/core
- Status: PASS
- Totals: 284/284 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: FAIL
- Totals: 238/245 passed, 7 failed, 0 skipped/todo across 59 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (25 tests): patchwork attest, attest tool_version, attest history mode, attest --max-history-files validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (59 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-02-13T13:35:15.911Z

- Overall status: PASS
- Totals: 627/627 passed, 0 failed across 155 suites

### @patchwork/core
- Status: PASS
- Totals: 284/284 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 245/245 passed, 0 failed, 0 skipped/todo across 59 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (25 tests): patchwork attest, attest tool_version, attest history mode, attest --max-history-files validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (59 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-02-13T13:36:43.919Z

- Overall status: PASS
- Totals: 627/627 passed, 0 failed across 155 suites

### @patchwork/core
- Status: PASS
- Totals: 284/284 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 245/245 passed, 0 failed, 0 skipped/todo across 59 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (25 tests): patchwork attest, attest tool_version, attest history mode, attest --max-history-files validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (59 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-02-13T13:49:05.363Z

- Overall status: PASS
- Totals: 650/650 passed, 0 failed across 160 suites

### @patchwork/core
- Status: PASS
- Totals: 284/284 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 268/268 passed, 0 failed, 0 skipped/todo across 64 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (27 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (64 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (16 tests): loadConfig, resolveVerifyDefaults. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-02-13T13:50:46.978Z

- Overall status: PASS
- Totals: 650/650 passed, 0 failed across 160 suites

### @patchwork/core
- Status: PASS
- Totals: 284/284 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 268/268 passed, 0 failed, 0 skipped/todo across 64 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (27 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (64 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (16 tests): loadConfig, resolveVerifyDefaults. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-02-13T14:09:18.787Z

- Overall status: PASS
- Totals: 671/671 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 284/284 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-02-13T14:10:50.013Z

- Overall status: PASS
- Totals: 671/671 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 284/284 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-02-13T14:12:43.703Z

- Overall status: PASS
- Totals: 671/671 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 284/284 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-03-31T14:39:15.625Z

- Overall status: PASS
- Totals: 671/671 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 284/284 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-03-31T14:40:19.726Z

- Overall status: PASS
- Totals: 671/671 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 284/284 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-03-31T14:51:17.605Z

- Overall status: PASS
- Totals: 671/671 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 284/284 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (10 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-03-31T15:14:53.873Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-03-31T15:19:35.539Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-03-31T15:20:28.879Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-03-31T19:36:32.089Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-03-31T19:49:45.242Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-03-31T20:35:39.422Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-03-31T20:38:52.758Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-03-31T20:41:32.471Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-03-31T20:52:35.773Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-03-31T21:15:48.770Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-03-31T21:18:30.609Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-03-31T21:31:53.615Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-03-31T21:46:35.240Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-03-31T21:57:59.323Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-03-31T22:27:55.522Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-03-31T22:41:48.610Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-04-01T09:35:27.072Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-04-01T09:35:55.639Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-04-01T09:50:54.725Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-04-01T09:59:19.945Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-04-01T10:19:29.196Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-04-01T10:25:36.370Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-04-01T10:35:47.804Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-04-01T10:36:20.260Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-04-01T13:16:16.287Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-04-01T21:12:17.602Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---

## 2026-04-01T22:00:17.823Z

- Overall status: PASS
- Totals: 672/672 passed, 0 failed across 164 suites

### @patchwork/core
- Status: PASS
- Totals: 285/285 passed, 0 failed, 0 skipped/todo across 75 suites
- Coverage by test file:
- `packages/core/tests/hash/attestation.test.ts` (14 tests): buildAttestationPayload, hashAttestationPayload, signAttestation + verifyAttestation. Example cases: produces deterministic output for identical input; excludes signature and payload_hash from payload; uses sorted keys for determinism.
- `packages/core/tests/hash/chain.test.ts` (25 tests): canonicalize, computeEventHash, JsonlStore hash chain, verifyChain. Example cases: sorts object keys deterministically; handles nested objects with stable ordering; preserves array element order.
- `packages/core/tests/hash/seal.test.ts` (35 tests): computeSealPayload, signSeal / verifySeal, ensureSealKey, readSealKey, deriveSealKeyId, ensureKeyring. Example cases: returns a deterministic versioned string; is deterministic across calls; changes when any input changes.
- `packages/core/tests/hash/witness.test.ts` (22 tests): WitnessRecordSchema, buildWitnessPayload, validateWitnessResponse, hashWitnessPayload. Example cases: accepts a complete valid record; accepts a record with optional fields; rejects record with wrong schema_version.
- `packages/core/tests/policy/engine.test.ts` (36 tests): risk threshold, file rules, command rules, network rules, MCP rules, non-matching actions. Example cases: allows actions within risk threshold; denies actions exceeding risk threshold; allows actions at exact threshold.
- `packages/core/tests/policy/loader.test.ts` (11 tests): loadPolicyFromFile, loadActivePolicy, policyToYaml, built-in policies. Example cases: loads and parses a YAML policy file; applies defaults for missing fields; returns default policy when no files exist.
- `packages/core/tests/risk/classifier.test.ts` (27 tests): session events, file operations, sensitive files, config files, commands, network. Example cases: session_start is none risk; session_end is none risk; prompt_submit is none risk.
- `packages/core/tests/risk/sensitive.test.ts` (14 tests): matchesGlob, SENSITIVE_GLOBS. Example cases: matches .env at root; matches .env in subdirectory; matches .env.local.
- `packages/core/tests/schema/event.test.ts` (14 tests): AuditEventSchema, schema_version contract. Example cases: validates a complete event; validates a minimal event; rejects invalid agent type.
- `packages/core/tests/schema/hash.test.ts` (9 tests): hashContent, generateEventId, generateSessionId. Example cases: returns sha256: prefix; produces consistent hashes; produces different hashes for different content.
- `packages/core/tests/store/jsonl.test.ts` (48 tests): JsonlStore, query, file permissions, schema validation, idempotency dedup, file locking. Example cases: starts empty; appends and reads a single event; appends multiple events in order.
- `packages/core/tests/store/sqlite.test.ts` (30 tests): SqliteStore, query, search (FTS5), file permissions, schema validation, schema_version and idempotency_key. Example cases: creates DB file on disk; uses WAL mode; starts empty.


### @patchwork/agents
- Status: PASS
- Totals: 98/98 passed, 0 failed, 0 skipped/todo across 21 suites
- Coverage by test file:
- `packages/agents/tests/claude-code/adapter.test.ts` (40 tests): handleClaudeCodeHook, schema_version and idempotency_key, directory permissions, privacy-safe defaults, divergence marker. Example cases: handles SessionStart; handles SessionEnd; handles PostToolUse for file Write.
- `packages/agents/tests/claude-code/installer.test.ts` (26 tests): installClaudeCodeHooks, uninstallClaudeCodeHooks, installer PreToolUse options, upgrade-in-place hook reconfiguration, installer policyMode option, installer hook timeouts. Example cases: creates .claude directory and settings.json; installs hooks for expected events; hooks use patchwork hook commands.
- `packages/agents/tests/claude-code/mapper.test.ts` (12 tests): mapClaudeCodeTool. Example cases: maps Write to file_create; maps Edit to file_edit; maps Read to file_read.
- `packages/agents/tests/codex/history-parser.test.ts` (7 tests): syncCodexHistory. Example cases: returns zeros when no history exists; handles empty history file; ingests prompt_submit events with content hashes.
- `packages/agents/tests/common/detector.test.ts` (7 tests): detectInstalledAgents. Example cases: detects claude-code when which claude succeeds; detects codex when which codex succeeds; reports installed: false when which throws.
- `packages/agents/tests/integration/pipeline.test.ts` (6 tests): E2E: Claude Code session pipeline. Example cases: captures a complete session lifecycle; captures failed tool uses; captures subagent lifecycle.


### patchwork-audit
- Status: PASS
- Totals: 289/289 passed, 0 failed, 0 skipped/todo across 68 suites
- Coverage by test file:
- `packages/cli/tests/analysis/diff.test.ts` (9 tests): computeFileDiff. Example cases: detects CREATED files; detects MODIFIED files; detects DELETED files.
- `packages/cli/tests/analysis/stats.test.ts` (9 tests): computeStats. Example cases: counts events by action; counts events by agent; counts events by risk level.
- `packages/cli/tests/commands/attest.test.ts` (29 tests): patchwork attest, attest tool_version, attest history mode, attest --profile, attest --max-history-files validation, attest config validation. Example cases: A: writes signed attestation artifact on successful verification; A2: signature verifies with keyring key; A3: tampered artifact fails signature verification.
- `packages/cli/tests/commands/hook.test.ts` (25 tests): hook pre-tool fail-closed mode, hook PreToolUse latency warning, hook PreToolUse structured telemetry, hook PreToolUse telemetry file sink, hook PreToolUse telemetry file rotation, hook PreToolUse telemetry concurrency hardening. Example cases: A: PreToolUse + fail-closed + invalid JSON => deny JSON emitted; B: PreToolUse + fail-closed disabled + invalid JSON => no deny output; C: non-PreToolUse + fail-closed enabled + invalid JSON => no deny output.
- `packages/cli/tests/commands/init.test.ts` (20 tests): init --pretool flags, init --strict-profile. Example cases: E: passes --pretool-fail-closed through to installer; E: passes --pretool-warn-ms through to installer; E: validates bad --pretool-warn-ms with clear error.
- `packages/cli/tests/commands/seal.test.ts` (39 tests): seal command, seal append locking, verify with seal, verify --require-seal, verify --max-seal-age-seconds, seal file permission hardening. Example cases: creates seal key with secure permissions; generates a valid seal record; exits non-zero when no events exist.
- `packages/cli/tests/commands/sync.test.ts` (15 tests): sync db-status, sync db clears marker, sync db partial rebuild failure. Example cases: reports no divergence when marker is absent; reports divergence when marker is present; JSON output includes diverged flag and marker details when present.
- `packages/cli/tests/commands/verify.test.ts` (75 tests): verify command, verify --max-seal-age-seconds input validation, verify --require-witness, verify --max-witness-age-seconds, verify --strict-witness-file, verify witness JSON output. Example cases: passes for a valid chain; exits non-zero when JSON parse errors are present; exits non-zero when schema-invalid events are present.
- `packages/cli/tests/commands/witness.test.ts` (14 tests): witness publish, witness lock concurrency, witness verify. Example cases: A: writes one witness record for single successful endpoint; B: quorum behavior — partial failures, passes when successes >= quorum; B2: quorum NOT met — fails when successes < quorum.
- `packages/cli/tests/config.test.ts` (24 tests): loadConfig, resolveVerifyDefaults, config validation. Example cases: M1: returns empty config when no config files exist; M2: loads project-level .patchwork/config.yml; M3: project-level config takes precedence over user-level.
- `packages/cli/tests/output/colors.test.ts` (12 tests): riskIcon, riskColor. Example cases: returns CRITICAL badge for critical; returns HIGH badge for high; returns a string for medium.
- `packages/cli/tests/output/formatter.test.ts` (8 tests): formatEvent, formatEventCompact. Example cases: includes the action in output; includes the target path; includes the agent name.
- `packages/cli/tests/remote-witness.test.ts` (10 tests): checkRemoteWitnesses, emptyRemoteWitnessResult. Example cases: returns verified when endpoint returns 200 with matching anchor_id; strips trailing slashes from witness_url when building proof URL; fails when quorum not met.


---
