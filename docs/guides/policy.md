# Policy Enforcement

Patchwork policies let you define exactly what your AI agent can and cannot do. When an action violates policy, it's blocked in real-time — before it executes.

## Creating Your First Policy

```bash
patchwork policy init
```

This creates `~/.patchwork/policy.yml` with sensible defaults. For a stricter starting point:

```bash
patchwork policy init --strict
```

## How Policy Evaluation Works

When an AI agent requests an action, the policy engine evaluates it in this order:

1. **Check deny rules** — if the action matches a deny pattern, it's blocked
2. **Check allow rules** — if the action matches an allow pattern, it's permitted
3. **Check risk level** — if the action exceeds `max_risk`, it's blocked
4. **Apply mode** — in `fail-closed` mode, anything not explicitly allowed is blocked; in `fail-open` mode, it's allowed but logged

```
Action: file_read .env
  1. Deny rules: matches "**/.env" → DENIED
  (evaluation stops)

Action: file_edit src/index.ts
  1. Deny rules: no match
  2. Allow rules: matches "src/**" → ALLOWED

Action: command_execute unknown-tool --flag
  1. Deny rules: no match
  2. Allow rules: no match
  3. Risk: medium (below max_risk: high) → passes
  4. Mode: fail-closed → DENIED (not explicitly allowed)
```

## Policy Examples

### Development Team Policy

Allow normal development work, block dangerous operations:

```yaml
version: 1
mode: fail-closed

rules:
  files:
    deny:
      - "**/.env*"
      - "**/*secret*"
      - "**/*credential*"
      - "**/id_rsa*"
    allow:
      - "src/**"
      - "tests/**"
      - "docs/**"
      - "*.json"
      - "*.yml"
      - "*.md"

  commands:
    deny:
      - "sudo *"
      - "rm -rf *"
      - "git push --force*"
      - "git reset --hard*"
      - "curl * | bash"
    allow:
      - "npm *"
      - "pnpm *"
      - "git *"
      - "node *"
      - "tsc *"

  network:
    allow:
      - "*.npmjs.org"
      - "*.github.com"
      - "*.googleapis.com"
    deny:
      - "*"

  max_risk: high
```

### Audit-Only Policy

Log everything, block nothing — useful for initial observation:

```yaml
version: 1
mode: fail-open

rules:
  files:
    deny: []
    allow:
      - "**"
  commands:
    deny: []
    allow:
      - "*"
  network:
    deny: []
    allow:
      - "*"
  max_risk: critical
```

### Lockdown Policy

Maximum restriction — only explicitly allowed actions:

```yaml
version: 1
mode: fail-closed

rules:
  files:
    deny:
      - "**/.env*"
      - "**/.git/**"
      - "**/node_modules/**"
    allow:
      - "src/**/*.ts"
      - "src/**/*.tsx"
      - "tests/**/*.test.ts"

  commands:
    deny:
      - "sudo *"
      - "rm *"
      - "curl *"
      - "wget *"
    allow:
      - "npm test"
      - "npm run lint"
      - "tsc --noEmit"

  network:
    deny:
      - "*"

  mcp_tools:
    deny:
      - "*"

  max_risk: medium
```

## Project-Level Policies

Create a policy that applies to everyone working on a project:

```bash
patchwork policy init --project
```

This creates `.patchwork/policy.yml` in the current directory. Commit it to git so the whole team shares the same rules.

::: tip Policy Precedence
Project policies **cannot weaken** user or system policies. They can only add restrictions. This ensures a system admin's security baseline is always enforced.
:::

## Validating Policies

Check a policy file for syntax errors:

```bash
patchwork policy validate path/to/policy.yml
```

See the active merged policy (system + user + project):

```bash
patchwork policy show
```

## Viewing Policy Decisions

Every denied action is logged with the reason:

```bash
# See all denied actions
patchwork log --risk high

# Filter for denials
patchwork search "denied"
```

The [web dashboard](/guides/dashboard) shows policy denials in real-time with full context.

## Next Steps

- [Policy Schema Reference](/reference/policy-schema) — full specification
- [Risk Classification](/concepts/risk-classification) — how risk levels are assigned
- [Configuration](/getting-started/configuration) — policy levels and relay config
