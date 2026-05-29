# GPT-5.5 release-ladder strategy — 2026-05-29

Cross-vendor review of the v0.6.12→v0.7.0 release sequencing via the aiorch gateway. Goal: regular, meaningful, incremental releases (not one lumped Mythos drop). v0.6.11 is already published WITH the R6-002 bypass, so F1 is a security patch to live code.

> Cost: \$0.12738 · 1026 in / 2928 out

---

## 1. v0.6.12 = F1-alone first patch?

**Yes. Ship F1 alone ASAP.**

Reason: **v0.6.11 is already published with a known self-approval bypass.** That makes F1 a real security patch to live code, not “part of the next hardening batch.”

Recommended early ladder:

- **v0.6.12 — emergency security patch**
  - **F1 only**, plus release-note disclosure.
  - If the U6/U1 wording is ready, include minimal honesty text too. Do **not** wait for F2/F3.

- **v0.6.13 — filesystem hardening patch**
  - F2 fsync anti-rollback.
  - F3 lstat/symlink refusal.
  - R1-007 follow-throughs if ready.
  - These are related enough to bundle: “local filesystem tamper-evidence hardening.”

- **v0.6.14 — snapshot authenticity**
  - HMAC + monotonic counter.
  - This is meaningfully distinct: “approval/snapshot integrity hardening.”

- **v0.6.15 — larger UX/honesty pass**
  - U1 first-run screen.
  - Full U6 README threat matrix.
  - Advisory-mode warnings.
  - X2 hygiene.

Granularity rule:

- **Do not hold live security fixes for tidy batching.**
- But also do not make every tracker bullet its own release.
- Good unit is: **one externally understandable security invariant per release.**

So:

- F1: “fixes live self-approval bypass” — standalone.
- F2/F3/R1: “filesystem tamper-evidence hardening” — together.
- Snapshot HMAC/counter: “snapshot authenticity” — standalone.
- U6/U1/advisory warnings: “honesty/UX contract” — together, unless minimal disclosure can ship sooner.

## 2. Is v0.6.15 too late for honesty/advisory warnings?

**Yes, if v0.6.11 currently oversells the protection model.**

The sentence **“hooks are bypassable; this is not a sandbox; same-UID attackers can tamper with it”** should ship immediately.

Do this in **v0.6.12**, even if the full U1/U6 work lands later.

Recommended split:

- **v0.6.12**
  - F1.
  - README/release-note/security-note clarification:
    - Patchwork v0.6.x is **Advisory / tamper-evident**, not tamper-resistant.
    - Hooks can be bypassed by same-UID code.
    - Protected Mode is future 0.7 work.
  - Optional CLI warning if trivial and non-disruptive.

- **v0.6.15**
  - Full U1 first-run threat screen.
  - Full U6 threat matrix.
  - Advisory-mode warnings.
  - Polished UX copy.

Bluntly: **do not let users go through v0.6.12–v0.6.14 believing same-UID hook hardening is a sandbox.** That is the bigger reputational risk than shipping an imperfect disclosure early.

## 3. Is v0.7.0-alpha the right vehicle for Protected Mode?

**Yes. 0.7.0-alpha is the correct vehicle.**

Protected Mode is a new architecture: root supervisor, OS containment, daemon policy, brokered secrets, fail-closed behavior, audit ledger, secure approval. That should not be smuggled into 0.6.x patches.

Your slicing is directionally right, but I would refine it:

### Better alpha ladder

- **v0.7.0-alpha.1 — Protected Mode skeleton**
  - New `patchwork protect` surface.
  - Root supervisor proof of life.
  - Policy file loading.
  - Audit event plumbing.
  - Can launch an agent through the new path, even if containment is minimal.
  - Useful for integration feedback, not security claims.

- **v0.7.0-alpha.2 — first actually useful Protected Mode**
  - macOS `sandbox-exec` or equivalent OS containment.
  - Supervisor launches the agent inside the sandbox.
  - Basic deny policy for known dangerous sinks.
  - Clear “Protected Mode active/inactive” state.
  - This is the first alpha that is **demoable as a security architecture**, not just plumbing.

- **v0.7.0-alpha.3 — daemon control-plane + fail-closed**
  - Daemon owns policy/audit/approval state.
  - Agent cannot silently proceed if daemon unavailable.
  - M9 fail-closed begins here.

- **v0.7.0-alpha.4 — secure approval path**
  - M3 secure TouchID approval or platform equivalent.
  - Approval bound to concrete operation/policy context.
  - No ambient “click yes once, approve anything” flow.

- **v0.7.0-alpha.5 — M-series hardening batch**
  - M1 secret-read broker.
  - M4 binding manifest.
  - M5 env sanitiser.
  - M6 persistence-sink policy.
  - M8 root audit ledger.
  - M10 concurrency.
  - M12 daemon hardening.

- **v0.7.0 GA**
  - Protected/Advisory split is crisp.
  - M11 adversarial e2e chains pass.
  - M13 complete-mediation audit done.
  - Docs say exactly what is and is not protected.
  - Upgrade path from 0.6 Advisory mode is clear.

First independently useful/demoable alpha:

- **alpha.2**, not alpha.1.
- alpha.1 is useful for collaborators.
- alpha.2 is the first one you can show and say: “the agent is actually launched inside OS containment.”

## 4. Anything that must not ship as a 0.6.x patch?

Yes. Do **not** ship these as 0.6.x patches:

- Any default behavior change that makes existing installs require:
  - root privileges,
  - a daemon,
  - OS sandbox support,
  - new approval hardware,
  - new persistent system services.

- Any change where “Patchwork runs the agent” becomes “supervisor/daemon runs the agent.”

- Any public CLI/API contract change such as:
  - changing default `patchwork-audit` behavior from Advisory to Protected,
  - renaming commands,
  - changing output formats consumed by users/CI,
  - changing config schema incompatibly,
  - making old policy files invalid without migration.

- Any approval/snapshot format change that invalidates existing user state without graceful migration.

- Anything that claims tamper-resistance against same-UID attackers.

Possible 0.6.x patch candidates:

- F1, F2, F3.
- Snapshot authenticity **if backward-compatible or auto-migrated**.
- Warnings/docs.
- Tests.
- Lint hygiene.
- Additional advisory-mode detection.

Caution: **F3 symlink refusal may break some users** if they intentionally symlink Patchwork config/state. It can still be a patch because it is security hardening, but call it out loudly in release notes.

## 5. Changeset discipline / fixed group traps

Main traps:

- **Fixed-version group means one package’s minor bumps the group.**
  - If `@patchwork/core` gets a minor because of a new public API, then `/agents`, `/web`, and `/cli` also move.
  - Do not accidentally mark a 0.6.x hardening patch as `minor` unless you intend to move the whole fixed group.

- **Keep 0.6 stable and 0.7 alpha work separated.**
  - Use a `release/0.6` or `main` stable lane for v0.6.12–v0.6.15.
  - Use a dedicated `next`/`protect` branch with Changesets prerelease mode for `0.7.0-alpha.N`.
  - Do not leave the repo accidentally in prerelease mode when cutting stable 0.6 patches.

- **Security patch changesets should be boring.**
  - v0.6.12: patch changeset for fixed group packages actually touched.
  - Release title should explicitly say security fix for v0.6.11.
  - Avoid unrelated refactors in the same changeset.

- **Docs-only changes can still need package releases if npm package contents include README/CLI warnings.**
  - If the published package README changes, cut the patch.
  - If only website docs change, do not force npm package bumps unless desired.

- **Be careful with `patchwork-audit` naming.**
  - The package is `/cli` but published as `patchwork-audit`.
  - Release notes should refer to the published package name.

- **Do not let `@patchwork/team` alpha precedent confuse the fixed group.**
  - Existing `@patchwork/team@0.7.0-alpha.1` proves alpha tracks are acceptable.
  - It does not mean core/agents/web/cli should be dragged into alpha unless Protected Mode needs them.

- **Dependency ranges matter.**
  - If `@patchwork/agents` depends on `@patchwork/core`, make sure ranges are compatible across 0.6 patches and 0.7 alphas.
  - Avoid publishing a stable 0.6 package that depends on a 0.7 alpha by accident.

## 6. The one sequencing risk that will bite later

**The biggest risk is overbuilding 0.6 same-UID hardening without locking the Advisory-vs-Protected contract immediately.**

If users see F1/F2/F3/HMAC/counter land before the warning lands, they may infer:

> “Patchwork fixed the bypasses; now same-UID compromise is handled.”

That is false. Same-UID hardening gives **tamper-evidence**, not **tamper-resistance**.

So the sequencing fix is:

- **v0.6.12 must include F1 + blunt Advisory disclosure.**
- Then continue hardening in 0.6.x.
- Then build actual resistance in 0.7 alpha/GA.

Final refined ladder:

- **v0.6.12**
  - F1.
  - Immediate “Advisory, not sandbox” disclosure.

- **v0.6.13**
  - F2 + F3 + R1-007.

- **v0.6.14**
  - Snapshot authenticity: HMAC + monotonic counter.

- **v0.6.15**
  - Full U6/U1/advisory warnings/X2.

- **v0.7.0-alpha.1**
  - Protected Mode skeleton/supervisor/policy/audit plumbing.

- **v0.7.0-alpha.2**
  - First useful Protected Mode: supervisor launches agent inside macOS sandbox.

- **v0.7.0-alpha.3**
  - Daemon control-plane + fail-closed.

- **v0.7.0-alpha.4**
  - Secure approval.

- **v0.7.0-alpha.5+**
  - M-series hardening.

- **v0.7.0**
  - Protected Mode GA, Advisory/Protected split, M11, M13.

That gives Jono exactly what he asked for: **regular, meaningful releases instead of one giant Mythos-hardening dump.**
