# Installation

## npm (recommended)

Install Patchwork globally from npm:

```bash
npm install -g patchwork-audit
```

Verify the installation:

```bash
patchwork --version
```

## From Source

Clone the repository and build:

```bash
git clone https://github.com/JonoGitty/patchwork-audit.git
cd patchwork-audit
pnpm install && pnpm build

# Link the CLI globally
cd packages/cli && npm link && cd ../..
```

## System Requirements

- **Node.js** 20 or later
- **Operating system:** macOS, Linux, or Windows
- **AI agent:** Claude Code (more agents coming soon)

## System-Level Install (Tamper-Proof)

For managed machines where non-admin users should not be able to disable auditing:

::: code-group

```bash [Single user (macOS/Linux)]
sudo bash scripts/system-install.sh
```

```bash [All users (macOS)]
sudo bash scripts/system-install.sh --all-users
```

```bash [Specific users (macOS)]
sudo bash scripts/system-install.sh --users alice,bob,charlie
```

```powershell [Windows]
powershell -ExecutionPolicy Bypass -File scripts/system-install.ps1
```

:::

The system install deploys:
- A **root-owned relay daemon** that receives audit events via Unix socket
- A **watchdog** that ensures hooks can't be silently removed
- **Immutable policy files** that non-admin users cannot modify

See [Tamper-Proof Layers](/concepts/tamper-proof-layers) for details on what each layer protects.

## Next Steps

Once installed, follow the [Quickstart](/getting-started/quickstart) to set up your first audited session.
