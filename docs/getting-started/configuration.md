# Configuration

Patchwork has three levels of configuration, each overriding the one above it.

## Policy Levels

| Level | Path | Who controls it |
|-------|------|-----------------|
| **System** | `/Library/Patchwork/policy.yml` (macOS) | System admin (root) |
| **User** | `~/.patchwork/policy.yml` | The developer |
| **Project** | `.patchwork/policy.yml` (in project root) | The team (via git) |

Lower levels **cannot weaken** higher levels. A project policy can add restrictions but can't remove system-level blocks.

## Creating a Policy

```bash
# Generate a default policy file
patchwork policy init

# Edit it
patchwork policy edit
```

Or create `~/.patchwork/policy.yml` manually:

```yaml
version: 1
mode: fail-closed

rules:
  files:
    deny:
      - "**/.env"
      - "**/.env.*"
      - "**/id_rsa"
      - "**/credentials.json"
    allow:
      - "src/**"
      - "tests/**"

  commands:
    deny:
      - "rm -rf *"
      - "git push --force*"
      - "sudo *"
      - "curl * | bash"
    allow:
      - "npm test"
      - "npm run *"
      - "git *"

  network:
    deny:
      - "*.internal.*"
      - "169.254.*"
    allow:
      - "*"

  mcp_tools:
    deny: []
    allow:
      - "*"

  max_risk: high  # Block critical actions automatically
```

See the [Policy Schema Reference](/reference/policy-schema) for the full specification.

## Relay Configuration

The relay daemon is configured at `/Library/Patchwork/relay-config.json` (root-owned):

```json
{
  "auto_seal": {
    "enabled": true,
    "interval_minutes": 15,
    "min_events_between_seals": 1
  },
  "witness": {
    "enabled": false,
    "endpoints": [],
    "quorum": 1
  }
}
```

See [Seals & Witnesses](/concepts/seals-and-witnesses) for how to configure witness endpoints.

## Hook Profiles

When running `patchwork init`, you can choose a security profile:

| Profile | What it enables |
|---------|----------------|
| `--strict-profile` | All layers: hash chain, relay, heartbeat, auto-seal, signing proxy |
| (default) | Hash chain and basic logging only |
| `--policy-mode fail-closed` | Unknown actions are blocked |
| `--policy-mode fail-open` | Unknown actions are allowed but logged |
| `--pretool-fail-closed` | Pre-tool hooks block on any error (safest) |

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `PATCHWORK_SYSTEM_POLICY_PATH` | Override system policy location |
| `PATCHWORK_HOME` | Override `~/.patchwork` data directory |
| `PATCHWORK_LOG_LEVEL` | Set logging verbosity (`debug`, `info`, `warn`, `error`) |

## Next Steps

- [Understand risk classification](/concepts/risk-classification) to know what gets flagged
- [Write policies](/guides/policy) tailored to your project
- [Set up the relay daemon](/concepts/tamper-proof-layers) for tamper-proof logging
