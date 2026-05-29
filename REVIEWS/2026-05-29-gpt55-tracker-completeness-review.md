# GPT-5.5 tracker completeness review — 2026-05-29

Cross-vendor completeness check of DESIGN/v0.6.12-mythos-readiness-tracker.md via the aiorch gateway. Question: does the 25-item plan, even all-green, equal Mythos-ready? Verdict: NO — it itemises bugs but misses a single non-bypassable reference-monitor property + ~13 whole categories of attack surface.

> Cost: \$0.22373 · 3793 in / 4645 out · 107319ms

---

Blunt answer: **no — this tracker is not complete enough to justify “Mythos-ready” even if every listed item goes green.** It covers several real findings, but it still treats Patchwork mostly as a hook/parser/taint system. A Mythos-class adversary will attack the gaps between hooks, execution, persistence, environment, provenance, and human approval.

## 1. GAPS — missing work items that still leave Mythos-class holes

- **Actual OS/process/network containment is missing.**
  - Current tracker says network/fs/process egress is “documented as not protected by hooks alone.”
  - That is not Mythos-readiness; that is an admission of non-containment.
  - Concrete attack: agent runs `python -c 'import socket; ...'`, `node -e 'fetch(...)'`, `openssl s_client`, `ssh`, DNS, `/dev/tcp`, or a downloaded static binary to exfiltrate repo/secrets or fetch a second stage without using a classified shell pattern.
  - Needed item: **mandatory Mythos containment profile**, not just O1 docs: default-deny network egress, filesystem allowlist, process-exec allowlist, no arbitrary interpreter/network tools unless explicitly brokered.

- **Secrets/file-read protection is missing.**
  - Tracker focuses on dangerous writes/approval/taint, not agent reads.
  - Concrete attack: agent reads `.env`, `~/.ssh/id_rsa`, cloud creds, npm tokens, GitHub tokens, browser/session files, then leaks them via “benign” output, test failure, commit message, package metadata, DNS, or paste into generated docs.
  - Needed item: **secret-path deny/read broker + redaction + canary tests**.

- **Patchwork code/install integrity is missing.**
  - Root-owned policy state is not enough if the user-writable CLI/hooks/package can be replaced.
  - Concrete attack: agent edits local `node_modules`, PATH shim, wrapper script, shell function, git hook, or local Patchwork checkout so `patchwork doctor` shows green while enforcement is bypassed.
  - Needed item: **signed/reproducible Patchwork binary or root-owned immutable install**, runtime self-hash, downgrade prevention, and “doctor verifies the actual enforcement binary.”

- **Secure human approval / secure attention is underspecified.**
  - “No self-approval from agent-controlled process” is not enough if approval still happens through a same-user CLI/TTY the agent can influence.
  - Concrete attack: agent launches approval UI with misleading context, scripts terminal input, aliases `patchwork approve`, opens a forged prompt, or asks user to paste a command that approves the real sink.
  - Needed item: **human-presence approval channel**: root daemon asks via trusted OS prompt / privileged helper / separate UI, displays canonical command+diff+taint source, requires non-scriptable confirmation, logs decision.

- **Approved-command binding is incomplete.**
  - Tracker mentions digest regeneration pain in X1, but not the full invariant.
  - Concrete attack: user approves `npm test`; between approval and exec, agent changes `package.json`, `.npmrc`, `PATH`, `NODE_OPTIONS`, `PYTHONPATH`, `LD_PRELOAD`, `DYLD_*`, `GIT_CONFIG_*`, `HOME`, `SHELL`, target script contents, or symlink target.
  - Needed item: **approval manifest binds argv, cwd, env, resolved executable realpath+hash, relevant input file hashes, package scripts, git config, and interpreter/module search paths; revalidate immediately before exec.**

- **Environment-variable laundering is under-covered.**
  - G1 lists some git env vars, but not the generic process environment attack surface.
  - Concrete attack: `NODE_OPTIONS=--require ./evil.js npm test`, `PYTHONPATH=. pytest`, `RUBYOPT`, `BUNDLE_GEMFILE`, `LD_PRELOAD`, `DYLD_INSERT_LIBRARIES`, `MAKEFLAGS`, `CFLAGS`, `PAGER`, `EDITOR`, `SSH_ASKPASS`, `GIT_ASKPASS`.
  - Needed item: **taint-aware environment sanitizer + allowlist per sink**.

- **Persistence outside Patchwork state is missing.**
  - Root-owned approval state does not stop user-level persistence.
  - Concrete attack: agent writes `~/.zshrc`, `~/.bashrc`, `~/.gitconfig`, `~/.ssh/config`, `~/.npmrc`, `~/.config/systemd/user/*`, macOS `~/Library/LaunchAgents/*`, VS Code tasks/settings, git templates/hooks, direnv files, or shell aliases to re-trigger later.
  - Needed item: **persistence-sink policy**: deny/broker writes to startup/config/hook locations under taint.

- **Prompt/memory/document laundering across sessions is missing or too narrow.**
  - P1 says repo-scoped taint ledger for files, but Mythos will launder through human/project memory.
  - Concrete attack: agent writes `CLAUDE.md`, `README`, `TODO`, issue text, commit message, or chat summary saying “user approved running installer X”; next session treats it as trusted project instruction.
  - Needed item: **taint provenance for agent-authored instructions/docs/memory**, and policy that future sessions do not treat tainted instructions as authority.

- **Audit log tamper resistance is missing.**
  - H1 protects taint snapshot, not necessarily audit/decision history.
  - Concrete attack: agent deletes or rewrites local audit logs to hide the chain that led to a dangerous approval, making `doctor` and postmortem misleading.
  - Needed item: **root-owned append-only audit ledger**, signed sequence numbers, crash-safe rotation, and doctor verifies continuity.

- **Daemon failure/downgrade/version-skew policy is missing.**
  - Concrete attack: run old Patchwork CLI, disable the daemon, use a stale policy schema, set env/config to compatibility mode, or operate when daemon is unreachable and enforcement silently degrades.
  - Needed item: **fail-closed enforcement**: no daemon/no current policy/no verified binary ⇒ no high-risk execution.

- **Concurrency/race model is missing.**
  - Mythos will run multiple shells/sessions/processes.
  - Concrete attack: two agent sessions race taint snapshot/ledger updates so one overwrites the other, loses taint, or approves based on stale state.
  - Needed item: **serialized provenance transactions** with locking, daemon-owned writes, monotonic sequence, multi-session race tests.

- **End-to-end adversarial chain testing is missing.**
  - The tracker mostly adds unit/corpus tests.
  - Concrete attack: staged chain: write benign config → later package lifecycle → env-var payload → approval laundering → network exfil.
  - Needed item: **red-team scenario suite** that runs full autonomous exploit chains, not only classifier fixtures.

- **Daemon attack-surface hardening is missing.**
  - D1 mentions protocol/auth, but not hardening the daemon itself.
  - Concrete attack: malicious same-user client fuzzes daemon RPC, path inputs, JSON/protobuf parser, symlink paths, oversized requests, counter rollback requests.
  - Needed item: **daemon minimization + fuzzing + privilege separation + strict schema + rate limits + no path traversal + own sandbox/seccomp where possible.**

## 2. WRONG PRIORITIES

- **O1 is not P2 docs.**
  - Containment is P0.
  - If Patchwork cannot actually block network/filesystem/process egress, it is not Mythos-ready. Documentation is not a defense.

- **D2/P1/containment should outrank F2/F3.**
  - F2/F3 are good hygiene, but they harden a same-user taint store that the plan already admits must move behind root-owned authority.
  - Do not spend disproportionate time perfecting a doomed trust boundary.

- **W1 is under-prioritised if “witness” is part of high-risk trust.**
  - Optional witness is weak against autonomous chaining.
  - But W1 is only valuable after the witness proof is rooted in D2/secure approval/audit. Otherwise it is decorative.

- **X2 lint cleanup is not P1 for Mythos.**
  - Useful engineering hygiene, not a security-hardening priority against Glasswing.
  - Should not compete with daemon/provenance/containment/code-integrity work.

- **U1-U6 are overrepresented before the actual controls exist.**
  - README, doctor, threat screens, and safe presets are useful only after they truthfully reflect enforced guarantees.
  - A green `doctor` without containment/code-integrity/fail-closed enforcement creates false confidence.

- **F1z parser fuzzing is useful but not enough.**
  - Parser differential fuzzing finds shell-classifier bugs.
  - Mythos will avoid the parser entirely via interpreters, package managers, env vars, config files, persistence, and direct network tools.

## 3. WRONG DEPENDENCIES / RISKY SEQUENCING

- **D1, H1, P1, audit, and concurrency need one shared design.**
  - The daemon, HMAC/counter, provenance ledger, audit log, and approval manifest are one security boundary.
  - Designing them separately risks incompatible trust roots and gaps between “taint state,” “approval state,” and “audit state.”

- **P1 should not wait until after H1 as a late add-on.**
  - The monotonic counter/HMAC format should cover durable provenance from day one.
  - Otherwise H1 may protect the wrong object.

- **W1 depends on D2 + secure approval + audit.**
  - Mandatory witness without daemon-owned state and tamper-evident logging can be spoofed or replayed.

- **U2/U3 must depend on real enforcement and code-integrity.**
  - `doctor --mythos-readiness` is dangerous if it can be run through a compromised CLI or only checks config files.

- **G1 should depend on a general env/execution mediation design.**
  - Otherwise it becomes a growing blacklist of git/npm tricks.
  - Need the invariant first: sanitized env, resolved executable, hashed scripts/config, fail-closed broker.

- **F2/F3 acceptance should require fail-closed semantics, not “finds new state.”**
  - Crash recovery cannot reliably promise the new state after kill/power loss.
  - Correct bar: no silent rollback to trusted/untainted state; ambiguous state becomes tainted/blocked.

## 4. DEFINITION-OF-DONE HOLES

The six “all green” bullets **do not equal Mythos-ready**.

Missing from the bar:

- **Complete mediation:** every agent-caused side effect — process, file write, file read, network, config change, package lifecycle, git operation — passes through policy.
- **Non-bypassability:** enforcement binary/hook/daemon cannot be replaced, downgraded, shadowed on PATH, or disabled by same-user agent.
- **Fail-closed operation:** no daemon, stale policy, corrupted ledger, version mismatch, unreadable taint state, or ambiguous crash recovery blocks high-risk actions.
- **Secure human approval:** approval must be non-scriptable, canonical, provenance-aware, and bound to the exact execution manifest.
- **Execution immutability:** approved action cannot change via env, PATH, script contents, symlink, config, package manager, interpreter preload, or cwd race.
- **Actual egress containment:** docs saying “hooks alone do not protect network/fs/process” are not sufficient.
- **Secret protection:** Mythos-readiness must include preventing or brokering reads of credentials and high-value local files.
- **Persistence control:** writes to startup/config/hook locations must be denied or brokered under taint.
- **Tamper-evident audit:** not just taint snapshots.
- **End-to-end adversarial validation:** full exploit-chain tests, not only corpus classifications.

So the current DoD proves “several known audit findings closed.” It does **not** prove “safe against Mythos.”

## 5. ITEMS TO CUT / DEFER AS RELEASE BLOCKERS

Not delete forever — but cut/defer from the critical Mythos path:

- **X2 lint formatter cleanup**
  - Good hygiene, low direct value against Mythos.

- **U1 first-run threat screen**
  - Helpful honesty, not a defense.

- **U5 `patchwork init --safe` preset**
  - Only valuable after “safe” means enforced containment/provenance/code-integrity.

- **U6 README matrix**
  - Keep as docs, but do not let it consume security-design time.

- **O1 as docs-only**
  - Either promote to P0 implementation of containment or stop pretending it contributes to readiness.

- **F1z parser fuzzing as a near-term blocker**
  - Useful, but lower than code-integrity, containment, secure approval, durable provenance, and env mediation.

- **`doctor` / `test-guards` before enforcement hardening**
  - Build them after the underlying guarantees exist, or they become green theatre.

## 6. THE ONE STRUCTURAL THING JONO MAY MISS

The tracker is itemising bugs, but Mythos-readiness needs a **single non-bypassable reference-monitor property**:

> Every agent-influenced path to a real-world side effect must be mediated by the same fail-closed, tamper-resistant policy authority, with durable provenance and secure human approval where required.

That has to hold across:

- shell commands,
- package managers,
- interpreters,
- git,
- env vars,
- config files,
- file reads/writes,
- network egress,
- persistence locations,
- approval flows,
- audit logs,
- cross-session memory,
- and Patchwork’s own binary/config/state.

If even one path remains “just documented,” “same-user writable,” “parser-based,” or “best effort,” a Mythos-class agent will route through that path.
