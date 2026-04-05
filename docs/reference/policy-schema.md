# Policy Schema

Patchwork policies define what an AI agent is allowed to do. Policies are YAML files that specify allow/deny rules for files, commands, network access, and MCP tools.

## Policy Levels

Policies are loaded from three locations, in priority order:

| Level | Path | Who controls it |
|-------|------|-----------------|
| **System** | `/Library/Patchwork/policy.yml` | Admin (root) |
| **User** | `~/.patchwork/policy.yml` | Developer |
| **Project** | `.patchwork/policy.yml` | Team (via git) |

Lower levels **cannot weaken** higher levels. A project policy can add restrictions but can't remove system-level blocks.

## Full Schema

```yaml
version: 1                       # Schema version (required)
mode: fail-closed                # "fail-closed" or "fail-open" (required)

rules:
  files:
    deny:                        # Glob patterns to block
      - "**/.env"
      - "**/.env.*"
      - "**/id_rsa"
      - "**/credentials.json"
      - "**/.aws/**"
      - "**/.ssh/**"
    allow:                       # Glob patterns to allow
      - "src/**"
      - "tests/**"
      - "docs/**"

  commands:
    deny:                        # Command patterns to block
      - "rm -rf *"
      - "git push --force*"
      - "sudo *"
      - "curl * | bash"
      - "wget * | sh"
      - "chmod 777 *"
    allow:                       # Command patterns to allow
      - "npm test"
      - "npm run *"
      - "git *"
      - "pnpm *"

  network:
    deny:                        # URL patterns to block
      - "*.internal.*"
      - "169.254.*"              # Cloud metadata endpoints
      - "localhost:*"
    allow:
      - "*"

  mcp_tools:
    deny: []                     # MCP tool patterns to block
    allow:
      - "*"

  max_risk: high                 # Block actions above this level
                                 # Options: none, low, medium, high, critical
```

## Pattern Matching

- File rules use **glob patterns** (e.g., `**/.env`, `src/**/*.ts`)
- Command rules use **prefix matching with wildcards** (e.g., `sudo *`, `git push --force*`)
- Network rules use **wildcard matching** on URLs
- MCP tool rules match on `server_name:tool_name`

## Mode

| Mode | Behaviour |
|------|-----------|
| `fail-closed` | Unknown actions (not matching any rule) are **blocked** |
| `fail-open` | Unknown actions are **allowed** but logged |

`fail-closed` is recommended for security-conscious environments.

## max_risk

The `max_risk` field provides a blanket risk ceiling:

| Setting | Effect |
|---------|--------|
| `none` | Only risk-free actions allowed |
| `low` | Block medium, high, and critical |
| `medium` | Block high and critical |
| `high` | Block critical only |
| `critical` | Block nothing (risk classification still logged) |

## Creating Policies

```bash
# Interactive creation
patchwork policy init

# Strict preset
patchwork policy init --strict

# Project-level policy (committed to git)
patchwork policy init --project
```

## Validating Policies

```bash
# Validate a policy file
patchwork policy validate path/to/policy.yml

# Show the active merged policy
patchwork policy show
```

## Examples

### Minimal (audit only)

```yaml
version: 1
mode: fail-open
rules:
  max_risk: critical
```

Logs everything, blocks nothing. Good for initial observation.

### Strict development

```yaml
version: 1
mode: fail-closed
rules:
  files:
    deny:
      - "**/.env*"
      - "**/*secret*"
      - "**/*credential*"
    allow:
      - "src/**"
      - "tests/**"
      - "package.json"
      - "tsconfig.json"
  commands:
    deny:
      - "sudo *"
      - "rm -rf *"
      - "git push --force*"
    allow:
      - "npm *"
      - "pnpm *"
      - "git *"
      - "node *"
  network:
    allow:
      - "*.npmjs.org"
      - "*.github.com"
    deny:
      - "*"
  max_risk: high
```

Tight controls: only allow known-safe operations.
