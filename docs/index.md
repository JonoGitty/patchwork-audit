---
layout: home

hero:
  name: Patchwork
  text: The audit trail for AI coding agents
  tagline: See exactly what your AI does. Prove it to anyone.
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/installation
    - theme: alt
      text: View on GitHub
      link: https://github.com/JonoGitty/patchwork-audit

features:
  - title: See Everything
    details: Every file edit, command, and web request logged with tamper-proof SHA-256 hash chains. Nothing gets past unrecorded.
    icon:
      src: /icons/search.svg
  - title: Enforce Rules
    details: Define what your AI can and cannot do. Patchwork blocks dangerous actions in real-time — before they execute.
    icon:
      src: /icons/shield.svg
  - title: Prove Compliance
    details: Generate reports mapped to SOC 2, ISO 27001, the EU AI Act, NIST AI RMF, and more. 7 frameworks, 31 controls.
    icon:
      src: /icons/clipboard.svg
  - title: Tamper-Proof
    details: A 5-layer architecture — from hash chains to a root-owned relay daemon — makes it impossible for the AI to disable its own monitoring.
    icon:
      src: /icons/lock.svg
  - title: Local-First
    details: Your data never leaves your machine. No cloud. No telemetry. Everything works offline.
    icon:
      src: /icons/laptop.svg
  - title: Cross-Platform
    details: Works on macOS, Linux, and Windows. Supports Claude Code today, with more agents coming.
    icon:
      src: /icons/globe.svg
---

## The Problem

AI agents write code, run commands, and modify your files — but there's no record of what they did, why, or whether it was safe. As organisations adopt AI coding assistants, this becomes a compliance and security gap that regulators are already asking about.

## What Patchwork Catches

```
15:31:04  claude-code   command_execute   rm -rf /                    CRITICAL  DENIED
15:31:05  claude-code   file_read         .env                        HIGH      DENIED
15:31:07  claude-code   command_execute   git push --force origin     HIGH      DENIED
15:31:08  claude-code   command_execute   sudo rm /etc/hosts          CRITICAL  DENIED
15:31:10  claude-code   file_edit         src/auth/middleware.ts       MEDIUM    completed
15:31:12  claude-code   command_execute   npm test                    MEDIUM    completed
```

Every action is classified, logged, and — if it violates policy — blocked before it executes.

## Quick Install

```bash
npm install -g patchwork-audit
patchwork init claude-code --strict-profile --policy-mode fail-closed
patchwork dashboard
```

That's it. Your AI is now audited.
