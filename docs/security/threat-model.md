# Threat Model

This page describes what Patchwork is designed to protect against, what it cannot protect against, and the assumptions it makes.

## What Patchwork Protects Against

### 1. AI Agent Tampering

**Threat:** An AI agent attempts to disable its own monitoring, delete audit logs, or weaken security policies.

**Mitigation:** The hook scripts run in a separate process from the AI agent. The agent cannot access or modify the hook configuration, the audit log, or the policy files. With the relay daemon (Layer 2), even deleting the user-level log doesn't destroy the audit trail.

### 2. Log Tampering (Non-Root User)

**Threat:** A non-root user (or a compromised user account) modifies, deletes, or rewrites the audit log to hide malicious actions.

**Mitigation:**
- **Hash chain** (Layer 1): Any modification breaks the chain and is detected by `patchwork verify`
- **Root-owned relay** (Layer 2): An independent copy of the log exists in `/Library/Patchwork/` which requires root access
- **Heartbeat** (Layer 3): Gaps in the heartbeat protocol reveal periods when the relay was stopped
- **HMAC seals** (Layer 4): Periodic cryptographic snapshots make retroactive tampering detectable
- **External witnesses** (Layer 4+): Independent third parties hold copies of seals

### 3. Retroactive Log Modification

**Threat:** An attacker rewrites the entire log file with a consistent hash chain, replacing the original history.

**Mitigation:** HMAC seals capture the chain state at 15-minute intervals. Seals are signed with keys stored in a root-owned keyring (Layer 5). Witnesses hold independent copies. To forge history, an attacker would need root access AND the signing key AND access to all witness servers.

### 4. Prompt Injection Leading to Dangerous Actions

**Threat:** A prompt injection in a file, webpage, or MCP response causes the AI agent to execute dangerous commands.

**Mitigation:** Patchwork's policy engine evaluates every action before it executes. In `fail-closed` mode, any action not explicitly allowed is blocked — regardless of why the AI requested it.

### 5. Sensitive Data Exposure

**Threat:** The AI agent reads `.env` files, SSH keys, API tokens, or other credentials.

**Mitigation:** The risk classifier flags sensitive file access as high or critical risk. The policy engine can deny access to files matching sensitive patterns.

## What Patchwork Does NOT Protect Against

### Root-Level Compromise

If an attacker has root access to the machine, they can modify the relay log, the keyring, and any local files. Patchwork assumes the operating system's privilege model is intact.

**Partial mitigation:** External witness servers hold independent copies of seals, so even a root compromise cannot retroactively forge witnessed seals.

### AI Agent Bypassing Hooks

Patchwork relies on the AI agent's hook system (e.g., Claude Code's `PreToolUse` / `PostToolUse` hooks). If the agent has a bug that allows tool calls without firing hooks, those actions won't be logged.

**Partial mitigation:** The watchdog monitors hook configuration and alerts if hooks are removed.

### Data Exfiltration via Allowed Actions

If the policy allows the AI to read a file and make web requests, it could theoretically exfiltrate file contents via allowed network calls. Patchwork logs this activity, but it doesn't inspect the content of allowed actions.

**Mitigation:** Use restrictive network policies to limit which URLs the AI can access.

### Side-Channel Attacks

Patchwork monitors tool calls, not the AI's internal reasoning. If an AI agent encodes information in file names, commit messages, or other metadata, Patchwork won't flag it as data exfiltration.

## Assumptions

1. **The OS privilege model works.** Root-owned files are protected from non-root users.
2. **AI agent hooks fire reliably.** Tool calls trigger the configured hooks.
3. **The clock is roughly accurate.** Timestamps are used for seals and witness verification.
4. **Network is available for witnesses.** Witness publishing requires HTTP connectivity (but everything else works offline).

## Security Properties

| Property | Provided by |
|----------|-------------|
| **Tamper detection** | Hash chain (Layer 1) |
| **Tamper resistance** | Root relay (Layer 2) |
| **Liveness proof** | Heartbeat (Layer 3) |
| **Non-repudiation** | HMAC seals + witnesses (Layer 4) |
| **Key confidentiality** | Signing proxy (Layer 5) |
| **Policy enforcement** | Policy engine (real-time) |
| **Independent verification** | External witnesses |
