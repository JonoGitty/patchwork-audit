# Quickstart

Get from zero to a fully audited AI coding session in under 2 minutes.

## 1. Install Hooks

Tell Patchwork which AI agent you're using:

```bash
patchwork init claude-code --strict-profile --policy-mode fail-closed
```

This installs hooks into Claude Code's configuration so every tool call is intercepted and logged. The `--strict-profile` flag enables all security layers. `--policy-mode fail-closed` means unknown actions are blocked by default.

::: tip What does `fail-closed` mean?
In **fail-closed** mode, if Patchwork can't determine whether an action is safe, it blocks it. This is the recommended default for security-conscious environments. Use `--policy-mode fail-open` if you'd rather allow unknown actions and review them later.
:::

## 2. Open the Dashboard

```bash
patchwork dashboard
```

This starts the web dashboard at [localhost:3000](http://localhost:3000). It shows real-time events, risk breakdowns, session history, and compliance status — all served locally with no external connections.

## 3. Use Your AI Agent Normally

Open Claude Code and work as usual. Every action the AI takes is now being logged:

```bash
# See the live event stream
patchwork log

# Today's summary
patchwork summary

# View a specific session
patchwork sessions
patchwork replay <session-id>
```

## 4. Check Integrity

Verify the audit trail hasn't been tampered with:

```bash
patchwork verify
```

This walks the full hash chain and reports any breaks, missing links, or modified events.

## 5. Generate a Compliance Report

```bash
patchwork report --framework all
```

This generates an HTML report evaluating your audit data against SOC 2, ISO 27001, the EU AI Act, and other frameworks. Reports are saved to `~/.patchwork/reports/` by default.

## What's Happening Under the Hood

When you ran `patchwork init`, Patchwork installed hooks into Claude Code's settings. Now, every time Claude Code calls a tool (reads a file, runs a command, makes a web request), the hook fires and Patchwork:

1. **Captures** the action with full context (what, where, when, why)
2. **Classifies** the risk level (none, low, medium, high, critical)
3. **Checks** it against your security policy
4. **Blocks** the action if it violates policy (in fail-closed mode)
5. **Logs** it to a tamper-evident hash chain
6. **Forwards** it to the relay daemon (if installed) for root-level protection

All of this happens in milliseconds. The AI doesn't slow down — it just can't hide.

## Next Steps

- [Configure policies](/getting-started/configuration) to control what your AI can do
- [Understand how it works](/concepts/how-it-works) under the hood
- [Deploy the relay daemon](/concepts/tamper-proof-layers) for maximum tamper resistance
