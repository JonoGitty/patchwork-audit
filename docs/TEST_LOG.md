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
