---
"@patchwork/agents": patch
"patchwork-audit": patch
---

Security fix (v0.6.12): close the R6-002 alternate-name self-approval bypass + correct the security-model claim.

`isAdminCliInvocation` relied on a basename-only check, so an agent could self-approve a denied action through a symlinked alternate name:

```sh
ln -s "$(command -v patchwork)" ./pw && ./pw approve <pending-id>
```

It now also resolves realpath identity against the running Patchwork CLI, closing the symlink-rename case (the concrete bypass flagged in the v0.6.11 R6 audit). Literal binary copies and wrapper scripts remain a documented residual until the root-owned approval daemon lands in Protected Mode (v0.7).

This also corrects the README security model. Patchwork v0.6.x is **Advisory / tamper-evident**, not tamper-resistant: hook-level enforcement runs at the same privilege as the agent, so a determined same-UID process can route around it. The previous "tamper-resistant / impossible for non-admin users to remove" wording overstated the guarantee. True tamper-resistance (OS-level containment via a root-owned supervisor) is the upcoming Protected Mode (v0.7).
