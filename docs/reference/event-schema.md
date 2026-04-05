# Event Schema

Every action an AI agent takes produces an **audit event** — a structured, immutable record stored in the hash chain.

## AuditEvent

```typescript
interface AuditEvent {
  id: string;                    // Unique event ID (evt_...)
  timestamp: string;             // ISO 8601 timestamp
  session_id: string;            // Session this event belongs to
  agent: string;                 // "claude-code" | "codex" | "cursor"
  action: string;                // What happened (see Action Types below)
  status: string;                // "completed" | "denied" | "error"

  risk: {
    level: string;               // "none" | "low" | "medium" | "high" | "critical"
    flags: string[];             // Why this risk level was assigned
  };

  target?: {
    type?: string;               // "file" | "command" | "url" | "mcp_tool"
    path?: string;               // Relative file path
    abs_path?: string;           // Absolute file path
    command?: string;            // Shell command (for command_execute)
    url?: string;                // URL (for web_fetch/web_search)
    tool_name?: string;          // MCP tool name
    server_name?: string;        // MCP server name
  };

  project?: {
    name?: string;               // Project directory name
    path?: string;               // Absolute project path
  };

  // Hash chain fields
  hash: string;                  // SHA-256 hash of this event
  prev_hash: string;             // Hash of the previous event (chain link)
}
```

## Action Types

| Action | Description | Target fields |
|--------|-------------|---------------|
| `file_read` | AI read a file | `path`, `abs_path` |
| `file_write` | AI wrote/created a file | `path`, `abs_path` |
| `file_edit` | AI edited an existing file | `path`, `abs_path` |
| `file_create` | AI created a new file | `path`, `abs_path` |
| `command_execute` | AI ran a shell command | `command` |
| `web_fetch` | AI made an HTTP request | `url` |
| `web_search` | AI performed a web search | `url` |
| `mcp_tool_call` | AI called an MCP tool | `tool_name`, `server_name` |

## Status Values

| Status | Meaning |
|--------|---------|
| `completed` | Action was allowed and executed |
| `denied` | Action was blocked by policy |
| `error` | Action failed (not due to policy) |

## Risk Flags

| Flag | Description |
|------|-------------|
| `destructive_command` | Command that deletes or overwrites data |
| `system_modification` | Modifies system files or configuration |
| `privilege_escalation` | Uses sudo or equivalent |
| `sensitive_file_access` | Reads or writes credential/secret files |
| `config_file_modification` | Modifies project configuration |
| `network_request` | Makes an external network call |
| `pipe_to_shell` | Pipes content to a shell interpreter |
| `force_push` | Git force push (rewrites history) |
| `broad_file_deletion` | Recursive delete with broad scope |

## Hash Chain

Each event's `hash` is computed as:

```
SHA-256(canonical_json(event_without_hash_fields))
```

The `prev_hash` field links to the previous event's `hash`, creating an append-only chain. Canonical JSON ensures deterministic serialization (sorted keys, no whitespace).

To verify the chain:

```bash
patchwork verify
```

## Storage Format

Events are stored as newline-delimited JSON (JSONL) in `~/.patchwork/events.jsonl`:

```jsonl
{"id":"evt_a1","timestamp":"2026-04-05T14:31:04.123Z","session_id":"ses_x7","agent":"claude-code","action":"file_read","status":"completed","risk":{"level":"none","flags":[]},"target":{"type":"file","path":"src/index.ts"},"hash":"sha256:8f14...","prev_hash":"sha256:7c21..."}
{"id":"evt_a2","timestamp":"2026-04-05T14:31:05.456Z","session_id":"ses_x7","agent":"claude-code","action":"command_execute","status":"denied","risk":{"level":"critical","flags":["destructive_command"]},"target":{"type":"command","command":"rm -rf /"},"hash":"sha256:3b2c...","prev_hash":"sha256:8f14..."}
```

One event per line. The SQLite store (`~/.patchwork/db/audit.db`) mirrors this data with indexes and full-text search.
