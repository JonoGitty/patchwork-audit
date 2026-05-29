# GPT-5.5 D1 reference-monitor red-team — 2026-05-29

Cross-vendor red-team of the D1 DRAFT (reference-monitor authority) via the aiorch gateway. Verdict: the draft's core premise — same-UID hook as the enforcement gate — is wrong. The hook is 'an adversary-controlled courier'. Enforcement must be OS containment (O1) with the agent launched UNDER a supervisor; the daemon is the control plane, not the gate.

> Cost: \$0.28046 · 2170 in / 6469 out · 186184ms

---

## 1. THE SAME-UID CRUX

### Is there any robust same-UID primitive to distinguish the legitimate hook from the agent impersonating it?

**No. Not in the draft’s model.**

Blunt answer: **a same-UID hook is not an authority. It is an adversary-controlled courier.**

What exists:

- `SO_PEERCRED` / `LOCAL_PEERCRED` / audit token:
  - Can tell the daemon: UID, GID, PID, sometimes audit session.
  - Does **not** tell “this is the genuine hook acting in the intended causal path.”
  - The agent is the same UID.

- PID / parent PID / process path:
  - Race-prone, spoof-adjacent, and semantically useless.
  - The agent can launch the same hook binary itself.
  - Parent chain is not a security boundary.

- Code-signature verification of the peer:
  - Better than path checks.
  - Still insufficient.
  - The agent can execute the legitimate signed hook binary and feed it adversarial ToolEvents unless the hook has an unforgeable capability the agent cannot obtain.

- “Secret token in env/file/config”:
  - Not robust.
  - Same UID can usually read, inherit, scrape, or cause leakage.
  - If the agent can influence the hook process, assume secrets in that process are exposed or replayable.

The only robust-ish primitive is **an unforgeable kernel capability issued by a higher-privileged component**, e.g.:

- a Mach port right / connected socket / file descriptor handed to a specific process by a root-controlled launcher;
- not inherited by the agent;
- not exposed through env/argv/files;
- ideally protected by hardened runtime / no-debug / no-dylib-injection constraints.

But that changes the architecture. That is no longer “agent spawns hook, hook calls daemon.” It becomes:

> root daemon/supervisor launches or brokers the agent/tool execution and gives capabilities only to trusted children.

Even then, the capability proves possession of a kernel object, not semantic honesty. If the legitimate hook accepts arbitrary agent-provided ToolEvents, it can still be a confused deputy.

So the real answer:

> **No ambient same-UID identity primitive can distinguish legitimate hook from agent impersonation. The hook channel must be treated as attacker-controlled input.**

The daemon can use hook messages for telemetry and advisory policy evaluation, but not as the sole enforcement point for Mythos-tier adversaries.

### Is there a genuinely unspoofable approval channel on a single-user Mac?

**A plain menubar click: no.**

A same-user adversary may be able to:

- synthesize clicks via Accessibility if granted;
- use `CGEvent`/Automation paths depending on TCC state;
- invoke AX actions like `AXPress`;
- manipulate focus/windows;
- screenshot or overlay;
- prompt-bomb the user;
- phish with a fake approval dialog;
- race or confuse the human.

TCC helps, but it is not a security boundary you should rely on against a developer-workstation adversary. Many coding agents and automation tools already ask for Accessibility, Automation, Full Disk Access, etc. If the agent has those, a menubar approval button is soft.

**TouchID helps, but only for user-presence, not perfect informed consent.**

A better Mac approval design is:

- approval app is signed/hardened/notarized;
- daemon verifies the approval app’s code signature via XPC/audit token;
- approval app holds a Secure Enclave / Keychain private key requiring:
  - `biometryCurrentSet` or equivalent;
  - private-key use gated by LocalAuthentication;
  - ideally no silent passcode fallback for high-risk approvals;
- approval app signs:
  - nonce from daemon;
  - canonical manifest;
  - timestamp;
  - policy version;
  - approval reason.

Then the daemon accepts only that signature.

This gives you:

- software cannot trivially synthesize TouchID;
- agent cannot forge the approval signature;
- approval is cryptographically bound to a specific action.

But residual remains:

- malware can spoof/overlay surrounding UI;
- user can be tricked into touching TouchID for the wrong reason;
- Accessibility can still manipulate non-biometric parts of the flow;
- the single-user GUI session is not a trusted display path;
- TouchID proves “a local enrolled user was present,” not “the user correctly understood this diff.”

**Push-to-phone or hardware token with independent display is stronger.**

Best approval channels:

- phone push displaying canonical command/diff/host/project;
- hardware security key with user presence, ideally with transaction display;
- remote policy service requiring approval outside the compromised Mac session.

But even push-to-phone has residual:

- prompt bombing;
- user habituation;
- phishing;
- compromised phone/account;
- vague diffs that humans cannot meaningfully validate.

Real answer:

> **On a single-user Mac, you can get cryptographic user-presence with TouchID/Secure Enclave, but not unspoofable informed consent. A menubar click alone is not acceptable for Mythos. Push-to-phone or hardware-backed approval is the high-assurance option. The irreducible residual is human-confusion plus compromised local display/session.**

---

## 2. SEQUENCING

### Root daemon first or OS sandbox/O1 first?

**O1 containment is primary. Build the root daemon only insofar as it is needed to install, configure, and supervise O1.**

The draft’s daemon-first framing is backwards for Mythos.

A root daemon mediating hook RPCs does not stop:

- direct `curl`, `python`, `node`, `bash`, `nc`, DNS, `/dev/tcp`;
- a child process spawned by an allowed command;
- malicious package scripts;
- static binaries;
- interpreter abuse;
- secrets read directly from disk;
- exfiltration through allowed tools;
- bypassing Patchwork-visible tool calls entirely.

A Mythos-class adversary will not politely walk through your hook. They will route around it.

The first real enforcement substrate must be:

- network egress control;
- filesystem allow/deny;
- process execution constraints;
- inheritance to children;
- no “just this tool call” gap;
- default-deny for unknown side effects.

So the correct sequencing is:

1. **Root-installed supervisor/daemon minimal slice.**
   - Needed for privileged setup.
   - Owns root-writable policy.
   - Starts protected sessions.
   - Configures OS sandboxing.
   - Maintains audit.

2. **O1 sandbox/containment immediately.**
   - This is the primary enforcement boundary.
   - Agent and descendants run inside it.
   - Hooks become telemetry and policy UX, not the reference monitor.

3. **Approval/binding layer.**
   - Approval modifies a daemon-controlled policy/sandbox grant.
   - It must not merely tell a same-UID hook “okay, proceed.”

Defensible slogan:

> **Daemon as control plane; O1 as enforcement plane. A daemon without containment is not a Mythos reference monitor.**

---

## 3. ARCHITECTURE HOLES

### Process model holes

- **The hook is spoofable.**
  - Treat every ToolEvent from the hook as attacker input.
  - Do not let hook RPC be the sole gate for real-world side effects.

- **The daemon is not complete mediation.**
  - It only sees Patchwork-visible tool calls.
  - Mythos will use child processes, interpreters, package scripts, DNS, local sockets, shell tricks, or direct syscalls.

- **Root daemon parsing attacker input is dangerous.**
  - ToolEvents, manifests, diffs, YAML policy, git metadata, package metadata are all hostile.
  - Do not run complex parsers as root.
  - Split:
    - small root supervisor;
    - unprivileged policy worker;
    - separate approval broker;
    - strict IPC schema.

- **“Runs as root or `_patchwork`” is underspecified.**
  - Root should be tiny.
  - State can be owned by `_patchwork`.
  - The parser/evaluator should not have ambient root.

- **No supervised execution model.**
  - If the agent is not launched under Patchwork’s supervisor, you do not control descendants.
  - Existing arbitrary shells/editors/agents cannot be retroactively made safe by a hook.

### Socket auth holes

- **UDS path permissions are not enough.**
  - Any same-UID process can connect unless explicitly excluded, which you generally cannot do by UID.
  - The daemon must assume same-UID clients are adversarial.

- **Peer path checks are weak.**
  - Path can race.
  - Symlinks/hardlinks/mount tricks matter.
  - Use audit token / pidversion / code-signature validation where available, but only as defense-in-depth.

- **Code signing proves binary identity, not authorization context.**
  - A signed helper can still be invoked by the agent.

- **No capability story.**
  - If you want trusted IPC, use root-issued non-forgeable capabilities:
    - Mach service/XPC with code-signing requirement on macOS;
    - inherited FD from supervisor;
    - short-lived daemon-issued handles bound to sandbox session.
  - Do not store them in files/env where the agent can grab them.

### Approval holes

- **Menubar app is same-user attack surface.**
  - Accessibility/Automation can drive or confuse it.
  - It must not be just “click Approve.”

- **LaunchDaemon cannot directly own normal GUI securely.**
  - macOS GUI belongs to user session.
  - You need a LaunchAgent/XPC approval component.
  - The daemon must authenticate the approval component by code signature and verify cryptographic approval signatures.

- **Approval needs transaction binding.**
  - Human approval must sign a canonical manifest nonce.
  - “User clicked approve” is not enough.

### Binding manifest holes

The proposed manifest is ambitious but dangerously close to fantasy if positioned as complete.

Problems:

- **TOCTOU everywhere.**
  - Files can change after hashing.
  - Symlinks can swap.
  - Interpreters can load dynamic modules after approval.
  - Package managers run lifecycle scripts.
  - Git config/hooks can alter behavior.
  - Shell expansion happens late.
  - Dynamic libraries, plugins, rc files, credential helpers, npm/pip config, `.curlrc`, `.ssh/config`, etc.

- **“Relevant input-file hashes” is underspecified.**
  - You often do not know relevant inputs until execution.
  - Interpreters discover imports dynamically.
  - Build tools scan the filesystem.

- **Env allowlist is not enough.**
  - `DYLD_*`, `NODE_OPTIONS`, `PYTHONPATH`, `GIT_*`, `SSH_AUTH_SOCK`, `AWS_*`, proxy vars, locale, shell rc behavior all matter.
  - The safe env is usually a minimal constructed env, not a filtered existing env.

- **Executable hash is not enough.**
  - Need interpreter, dynamic libraries, scripts, plugins, config, cwd, fds, TTY, network, mounts.

- **Manifest matching at hook time does not bind actual syscalls.**
  - The only strong binding is to execute inside a constrained sandbox or through a controlled launcher.

Cut the claim down:

> Manifesting is useful for approval UX and audit. It is not a complete enforcement mechanism.

### Fail-closed holes

- **Fail-closed in the hook is bypassable.**
  - If the daemon is unreachable and the hook denies, the agent can bypass the hook unless O1 prevents alternate execution paths.

- **Version skew handling must be root-policy-driven.**
  - Same-UID package downgrade of the hook must not downgrade enforcement.
  - Daemon should reject old clients, but more importantly the sandbox should not depend on client honesty.

- **No daemon should mean no protected session, not “hook denies.”**
  - If protection requires the daemon, the protected launcher should refuse to start.

### Integrity-check holes

- **Self-check at startup is weak.**
  - Need check:
    - binary;
    - launchd/systemd unit;
    - parent directories;
    - entitlements;
    - code signature/notarization;
    - update channel;
    - rollback/downgrade protections.

- **Root can alter root-owned state.**
  - If attacker gets root, local integrity is gone.
  - For high-assurance audit, use remote append-only transparency log or external signing.

- **Policy mutability needs governance.**
  - Who can edit policy?
  - Is `sudo vim /Library/Patchwork/policy.yml` enough?
  - Are policy changes approved/audited?
  - Are emergency disables logged remotely?

---

## 4. THE MINIMUM VIABLE v0.6.12

The smallest real improvement is **not** “root daemon receives hook RPCs.”

That is mostly tamper-resistant logging plus advisory gating. Useful, but not Mythos-grade.

### Minimum viable protected v0.6.12

Ship a clearly scoped **Protected Mode** with:

- root-installed supervisor/daemon;
- root-owned policy and audit state;
- signed/notarized daemon and helper binaries;
- protected session launcher:
  - `patchwork protect run <agent>`;
  - agent and descendants run inside OS containment;
- default-deny network with explicit allowlist;
- filesystem restrictions:
  - workspace scoped access;
  - deny common secret locations by default;
  - deny SSH keys, cloud creds, browser profiles, password stores unless explicitly granted;
- process execution constraints where platform supports it;
- daemon-controlled policy decisions;
- root-owned audit log;
- approval path using either:
  - push-to-phone; or
  - TouchID/Secure-Enclave-backed signing of approval manifests;
- hooks only as telemetry/UX inside the sandbox, not as primary enforcement.

### Cut line: include

- One platform first.
- One protected execution path.
- Root daemon as supervisor/control plane.
- O1 containment for network/filesystem at minimum.
- Basic approvals for temporary policy exceptions.
- Root-owned durable audit.
- Explicit “protected” vs “advisory” product modes.

### Cut line: exclude for v0.6.12

Do **not** try to ship:

- complete manifest binding for arbitrary commands;
- perfect package-script modeling;
- cross-platform parity;
- secure approval via plain menubar click;
- retroactive protection of arbitrary already-running agents;
- same-UID hook authenticity;
- full interpreter/plugin/dynamic dependency closure;
- local-only immutable audit against root compromise.

### Practical statement

A real v0.6.12 could honestly say:

> “When launched via Patchwork Protected Mode, the agent and descendants are contained by OS policy. Patchworkd owns policy/audit/approval state. Hooks provide telemetry and preflight UX, but enforcement comes from the daemon-managed sandbox.”

That is a real improvement.

This would be dishonest:

> “Install a root daemon, keep the existing hook path, and now all high-risk actions are non-bypassable.”

---

## 5. ADOPTION vs SECURITY

Do not silently break every v0.6.10/v0.6.11 user. Also do not create a permanent “advisory mode” escape hatch that gets marketed as secure.

Use explicit modes.

### Recommended staging

#### v0.6.12

- Introduce two labels:
  - **Advisory Mode**: existing behavior, no enforcement claim.
  - **Protected Mode**: daemon + containment required.

- If daemon missing:
  - Advisory Mode continues, with prominent warnings.
  - Protected Mode refuses to start.

- Product/UI must say:
  - “Not protected.”
  - “Hook-only mode is bypassable by same-UID agents.”
  - “Does not satisfy Mythos policy.”

- New high-risk/security templates default to Protected Mode.

#### v0.6.13 / v0.6.14

- Project config can declare:

  ```text
  patchwork.required_mode = protected
  ```

- If required mode is protected and daemon is missing:
  - fail closed;
  - no local project override by same UID;
  - only root/admin policy can change it.

- CI/compliance badges only pass in Protected Mode.

- Advisory Mode remains available for experimentation, but cannot emit “enforced,” “compliant,” or “protected” claims.

#### Later

- For new installs, default to Protected Mode setup flow.
- Advisory Mode becomes explicitly unsafe/legacy.
- Any bypass flag:
  - must be interactive;
  - must be noisy;
  - must expire;
  - must be logged;
  - must not satisfy protected policy.

### Avoid the permanent escape hatch

Bad:

- `--no-daemon-allow-anyway`
- project-local config that disables daemon requirement;
- env var that makes high-risk actions advisory forever;
- npm package downgrade that reverts semantics.

Acceptable temporary escape:

- `patchwork run --advisory-unsafe`
- requires local human confirmation;
- prints warning;
- logs locally;
- expires;
- cannot satisfy protected-mode project policy;
- unavailable when root policy says protected is mandatory.

Key rule:

> **Advisory can exist for adoption, but it must be semantically unable to masquerade as enforcement.**

---

## 6. THE ONE THING THE DRAFT GETS MOST WRONG

The draft most dangerously underestimates this:

> **A root daemon receiving hook RPCs is not a reference monitor.**

It is a better policy server. It is a better audit store. It is a better approval broker.

But it is not complete mediation.

For Mythos-class adversaries, the decisive property is not “can the hook ask a tamper-resistant daemon?” The decisive property is:

> **Can the agent or any descendant cause side effects except through an enforcement boundary the agent cannot bypass?**

In the draft, the answer is still mostly no.

The same-UID hook cannot be authenticated in the way the design wants. The approval UI cannot make hook-mediated execution non-bypassable. The manifest cannot completely bind arbitrary real execution. Fail-closed in a hook does not matter if the agent can route around the hook.

The architecture should be reframed:

- **O1 containment is the enforcement substrate.**
- **`patchworkd` is the privileged supervisor/control plane.**
- **Hooks are untrusted sensors and UX helpers.**
- **Approvals grant daemon-enforced sandbox/policy exceptions, not hook permissions.**

That reframing is the difference between a hardened advisory system and an actual reference-monitor design.
