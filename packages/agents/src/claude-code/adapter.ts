import {
	type Action,
	type AuditEvent,
	type Store,
	type Target,
	type TaintKind,
	type TaintSource,
	CURRENT_SCHEMA_VERSION,
	classifyRisk,
	evaluatePolicy,
	generateEventId,
	generateSessionId,
	hashContent,
	JsonlStore,
	SqliteStore,
	loadActivePolicy,
	getHomeDir,
	sendToRelayAsync,
	ALL_TAINT_KINDS,
	RAISES_FOR_TOOL,
	getActiveSources,
	registerGeneratedFile,
	registerTaint,
} from "@patchwork/core";
import {
	loadOrInitSnapshot,
	writeTaintSnapshot,
} from "./taint-store.js";
import { isAbsolute, relative, dirname, join } from "node:path";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
	renameSync,
	chmodSync,
	statSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { mapClaudeCodeTool } from "./mapper.js";
import { isGitCommitCommand, extractCommitInfo, usesNoVerify } from "./git-commit-detector.js";
import {
	generateCommitAttestation,
	writeCommitAttestation,
	addGitNote,
	writeAttestationFailure,
	buildIntotoEnvelope,
	writeIntotoEnvelope,
	addIntotoGitNote,
} from "./commit-attestor.js";
import type { ClaudeCodeHookInput, ClaudeCodeHookOutput } from "./types.js";

function getEventsPath(): string {
	return join(getHomeDir(), ".patchwork", "events.jsonl");
}

function getDbPath(): string {
	return join(getHomeDir(), ".patchwork", "db", "audit.db");
}

// ---------------------------------------------------------------------------
// SQLite divergence marker — durable record of dual-write failures
// ---------------------------------------------------------------------------

/** Secure directory mode: owner-only read/write/execute */
const STATE_DIR_MODE = 0o700;
/** Secure file mode: owner-only read/write */
const STATE_FILE_MODE = 0o600;

/** Schema for the divergence marker file. */
export interface DivergenceMarker {
	schema_version: 1;
	failure_count: number;
	first_failure_at: string;
	last_failure_at: string;
	last_error: string;
}

function getDivergenceMarkerPath(): string {
	return join(getHomeDir(), ".patchwork", "state", "sqlite-divergence.json");
}

/** Reconcile permissions to target if they don't match. */
function reconcileMode(path: string, targetMode: number): void {
	try {
		const stat = statSync(path);
		if ((stat.mode & 0o777) !== targetMode) {
			chmodSync(path, targetMode);
		}
	} catch {
		// Path disappeared — safe to ignore
	}
}

/**
 * Read the current divergence marker, or null if absent/corrupt.
 * @internal Exported for testing only.
 */
export function readDivergenceMarker(markerPath?: string): DivergenceMarker | null {
	const p = markerPath || getDivergenceMarkerPath();
	try {
		const content = readFileSync(p, "utf-8");
		const parsed = JSON.parse(content);
		if (
			parsed &&
			parsed.schema_version === 1 &&
			typeof parsed.failure_count === "number" &&
			typeof parsed.first_failure_at === "string" &&
			typeof parsed.last_failure_at === "string" &&
			typeof parsed.last_error === "string"
		) {
			return parsed as DivergenceMarker;
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Write a divergence marker atomically (tmp + rename).
 * Ensures state dir (0700) and file (0600) permissions.
 */
function writeDivergenceMarker(marker: DivergenceMarker, markerPath?: string): void {
	const p = markerPath || getDivergenceMarkerPath();
	const dir = dirname(p);

	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true, mode: STATE_DIR_MODE });
	} else {
		reconcileMode(dir, STATE_DIR_MODE);
	}

	// Atomic write: tmp file + rename
	const tmpPath = p + "." + randomBytes(4).toString("hex") + ".tmp";
	writeFileSync(tmpPath, JSON.stringify(marker, null, 2) + "\n", { mode: STATE_FILE_MODE });
	renameSync(tmpPath, p);
}

/**
 * Record a SQLite dual-write failure in the divergence marker.
 * Increments failure_count, preserves first_failure_at, updates last_*.
 */
function recordDivergence(errorMessage: string, markerPath?: string): void {
	const now = new Date().toISOString();
	const existing = readDivergenceMarker(markerPath);

	const marker: DivergenceMarker = {
		schema_version: 1,
		failure_count: existing ? existing.failure_count + 1 : 1,
		first_failure_at: existing ? existing.first_failure_at : now,
		last_failure_at: now,
		last_error: errorMessage,
	};

	try {
		writeDivergenceMarker(marker, markerPath);
	} catch {
		// Best effort — don't let marker I/O break the hot path
	}
}

/** Store extended with a flush method for awaiting pending relay sends. */
interface FlushableStore extends Store {
	/** Await any pending relay send. Call before process exit in hooks. */
	flushRelay(): Promise<void>;
}

/** Wraps a primary and optional secondary store for triple-write (JSONL + SQLite + relay). */
function createDualWriter(primary: Store, secondary: Store | null): FlushableStore {
	let sqliteErrorCount = 0;
	let pendingRelay: Promise<void> = Promise.resolve();

	return {
		append(event: AuditEvent) {
			primary.append(event);
			if (secondary) {
				try {
					secondary.append(event);
				} catch (err: unknown) {
					sqliteErrorCount++;
					const msg = err instanceof Error ? err.message : String(err);
					process.stderr.write(
						`[patchwork] SQLite write failed (count=${sqliteErrorCount}): ${msg}\n`,
					);
					recordDivergence(msg);
				}
			}

			// Layer 2: relay to root-owned audit log.
			// Uses sendToRelayAsync so hook processes stay alive long
			// enough for the socket write to complete. Flush via
			// flushRelay() before process exit.
			try {
				pendingRelay = sendToRelayAsync(event as unknown as Record<string, unknown>);
			} catch {
				// Relay must never block or break the hook pipeline
			}
		},
		async flushRelay() {
			try {
				await pendingRelay;
			} catch {
				// Best effort — relay flush failure must not break hooks
			}
		},
		readAll: () => primary.readAll(),
		readRecent: (limit: number) => primary.readRecent(limit),
		query: (filter) => primary.query(filter),
		get path() { return primary.path; },
	};
}

/**
 * Handles a Claude Code hook event.
 * Reads JSON from stdin, normalizes to AuditEvent, stores it.
 *
 * Returns an optional hook output (for PreToolUse allow/deny).
 */
export async function handleClaudeCodeHook(input: ClaudeCodeHookInput): Promise<ClaudeCodeHookOutput | null> {
	const jsonlStore = new JsonlStore(getEventsPath());
	let sqliteStore: SqliteStore | null = null;
	try {
		sqliteStore = new SqliteStore(getDbPath());
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		process.stderr.write(`[patchwork] SQLite store unavailable, using JSONL only: ${msg}\n`);
	}
	const store = createDualWriter(jsonlStore, sqliteStore);
	const hookEvent = input.hook_event_name;

	let result: ClaudeCodeHookOutput | null;
	switch (hookEvent) {
		case "SessionStart":
			result = handleSessionStart(store, input);
			break;

		case "SessionEnd":
			result = handleSessionEnd(store, input);
			break;

		case "UserPromptSubmit":
			result = handlePromptSubmit(store, input);
			break;

		case "PreToolUse":
			result = handlePreToolUse(store, input);
			break;

		case "PostToolUse":
			result = await handlePostToolUse(store, input);
			break;

		case "PostToolUseFailure":
			result = await handlePostToolUse(store, input, "failed");
			break;

		case "SubagentStart":
			result = handleSubagentStart(store, input);
			break;

		case "SubagentStop":
			result = handleSubagentStop(store, input);
			break;

		default:
			// Log but don't process unknown events
			return null;
	}

	// Ensure relay send completes before the hook process exits.
	await store.flushRelay();
	return result;
}

function handleSessionStart(store: Store, input: ClaudeCodeHookInput): null {
	const event = buildEvent(input, {
		action: "session_start",
	});
	store.append(event);
	return null;
}

function handleSessionEnd(store: Store, input: ClaudeCodeHookInput): null {
	const event = buildEvent(input, {
		action: "session_end",
	});
	store.append(event);
	return null;
}

function handlePromptSubmit(store: Store, input: ClaudeCodeHookInput): null {
	const capturePromptSize = process.env.PATCHWORK_CAPTURE_PROMPT_SIZE === "1";
	const event = buildEvent(input, {
		action: "prompt_submit",
		target: {
			type: "prompt",
		},
		content: input.prompt
			? {
					hash: hashContent(input.prompt),
					...(capturePromptSize
						? { size_bytes: Buffer.byteLength(input.prompt, "utf-8") }
						: {}),
					redacted: true,
				}
			: undefined,
	});
	store.append(event);
	return null;
}

function handlePreToolUse(store: Store, input: ClaudeCodeHookInput): ClaudeCodeHookOutput {
	const toolName = input.tool_name || "unknown";
	const toolInput = input.tool_input || {};
	const mapped = mapClaudeCodeTool(toolName, toolInput);

	const target: Target = {
		type: mapped.target?.type || "file",
		...mapped.target,
	};

	// Fail closed on malformed tool input. Policy rules can't reliably reject
	// undefined targets (a path-glob can't match an undefined path), so a hook
	// payload like `{file_path: {x: 1}}` would otherwise slip through any
	// path-based deny list. Deny up front and log the malformed event so the
	// audit trail captures the attempted bypass.
	if (mapped.malformed) {
		const event = buildEvent(input, {
			action: mapped.action,
			status: "denied",
			target,
			provenance: { hook_event: "PreToolUse", tool_name: toolName },
		});
		store.append(event);
		fireWebhookAlert(event);
		return {
			hookSpecificOutput: {
				hookEventName: "PreToolUse",
				permissionDecision: "deny",
				permissionDecisionReason: `[Patchwork] malformed tool input: ${mapped.malformed.reason}`,
			},
		};
	}

	const risk = classifyRisk(mapped.action, target);

	// Evaluate policy
	const { policy } = loadActivePolicy(input.cwd);
	const decision = evaluatePolicy(policy, {
		action: mapped.action,
		risk_level: risk.level,
		target,
	});

	if (!decision.allowed) {
		// Log the denial
		const event = buildEvent(input, {
			action: mapped.action,
			status: "denied",
			target,
			provenance: {
				hook_event: "PreToolUse",
				tool_name: toolName,
			},
		});
		store.append(event);
		fireWebhookAlert(event);

		return {
			hookSpecificOutput: {
				hookEventName: "PreToolUse",
				permissionDecision: "deny",
				permissionDecisionReason: `[Patchwork] ${decision.reason}`,
			},
		};
	}

	return {};
}

async function handlePostToolUse(
	store: Store,
	input: ClaudeCodeHookInput,
	overrideStatus?: "failed",
): Promise<ClaudeCodeHookOutput | null> {
	const toolName = input.tool_name || "unknown";
	const toolInput = input.tool_input || {};

	const mapped = mapClaudeCodeTool(toolName, toolInput);

	// Build content hash from response if available
	let content: AuditEvent["content"] | undefined;
	if (input.tool_response) {
		const responseText =
			input.tool_response.output ||
			input.tool_response.content ||
			input.tool_response.stdout ||
			"";
		if (typeof responseText === "string" && responseText.length > 0) {
			content = {
				hash: hashContent(responseText),
				size_bytes: Buffer.byteLength(responseText, "utf-8"),
				redacted: true,
			};
		}
	}

	const target: Target = {
		type: mapped.target?.type || "file",
		...mapped.target,
	};

	const event = buildEvent(input, {
		action: mapped.action,
		status: overrideStatus || "completed",
		target,
		content,
		provenance: {
			hook_event: input.hook_event_name,
			tool_name: toolName,
			// Raw input/output redacted by default — opt-in capture
		},
	});

	store.append(event);
	fireWebhookAlert(event);

	// --- Taint snapshot update (v0.6.11 commit 7) ----------------------------
	// Fold any taint sources this PostToolUse introduces into the session
	// snapshot at ~/.patchwork/taint/<session_id>.json. Wrapped in try/catch
	// per the source-fail-open contract: a storage bug here can only fail to
	// *record* taint. The PreToolUse enforcer (commit 8) treats missing or
	// corrupt snapshots as all-kinds-active and forces approval, so dropping
	// a write only ever pushes the next decision to a stricter path.
	try {
		updateTaintSnapshotForPostTool(input, toolName, target);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		process.stderr.write(`[patchwork] taint snapshot update failed: ${msg}\n`);
	}

	// --- Commit attestation: detect git commit and generate inline compliance proof ---
	if (
		toolName === "Bash" &&
		overrideStatus !== "failed" &&
		typeof toolInput.command === "string" &&
		isGitCommitCommand(toolInput.command)
	) {
		const stdout =
			input.tool_response?.stdout ||
			input.tool_response?.output ||
			input.tool_response?.content ||
			"";
		if (typeof stdout === "string") {
			const commitInfo = extractCommitInfo(stdout);
			if (commitInfo) {
				try {
					const attestation = await generateCommitAttestation({
						commitSha: commitInfo.sha,
						branch: commitInfo.branch,
						sessionId: input.session_id,
						projectRoot: input.cwd,
						store,
						toolVersion: getAgentVersion(),
					});
					writeCommitAttestation(attestation);
					try {
						addGitNote(attestation, input.cwd);
					} catch (err) {
						writeAttestationFailure({
							commitSha: commitInfo.sha,
							branch: commitInfo.branch,
							sessionId: input.session_id,
							stage: "note",
							error: err,
						});
					}

					// Optional: emit in-toto/DSSE-formatted parallel attestation when
					// PATCHWORK_INTOTO=1. Default off in v0.6.9; the bespoke path above
					// is unaffected so existing tooling, dashboards, and CLI keep working.
					if (process.env.PATCHWORK_INTOTO === "1") {
						try {
							const envelope = await buildIntotoEnvelope(attestation);
							writeIntotoEnvelope(commitInfo.sha, envelope);
							try {
								addIntotoGitNote(commitInfo.sha, envelope, input.cwd);
							} catch (err) {
								writeAttestationFailure({
									commitSha: commitInfo.sha,
									branch: commitInfo.branch,
									sessionId: input.session_id,
									stage: "note",
									error: err,
								});
							}
						} catch (err) {
							writeAttestationFailure({
								commitSha: commitInfo.sha,
								branch: commitInfo.branch,
								sessionId: input.session_id,
								stage: "generate",
								error: err,
							});
						}
					}

					const noVerify = usesNoVerify(toolInput.command);
					const status = attestation.pass ? "PASS" : "FAIL";
					const warn = noVerify ? " (--no-verify detected)" : "";
					return {
						feedback: `[Patchwork] Commit ${commitInfo.sha} attested: ${status}${warn} (${attestation.payload_hash})`,
					};
				} catch (err) {
					// Attestation generation must never block the hook pipeline,
					// but record what went wrong so missed attestations are visible.
					writeAttestationFailure({
						commitSha: commitInfo.sha,
						branch: commitInfo.branch,
						sessionId: input.session_id,
						stage: "generate",
						error: err,
					});
					try {
						const msg = err instanceof Error ? err.message : String(err);
						console.error(`[Patchwork] Commit attestation failed for ${commitInfo.sha}: ${msg}`);
					} catch { /* never throw from the catch */ }
				}
			} else if (stdout.length > 0) {
				// We saw a successful git commit but couldn't parse [branch sha]
				// out of stdout — record it so the stdout-pattern gap is visible.
				writeAttestationFailure({
					sessionId: input.session_id,
					stage: "extract",
					error: new Error(`extractCommitInfo returned null; stdout head: ${stdout.slice(0, 200)}`),
				});
			}
		}
	}

	return null;
}

/**
 * Resolve agent/tool version for attestation artifacts.
 *
 * Agents and the CLI are released together on the same fixed-version track,
 * so either package.json is an authoritative source. This matters because
 * the CLI bundles agents into its dist via tsup `noExternal`, which moves
 * import.meta.url away from agents/dist/ and breaks relative-path resolution
 * from inside this file. Accepting either package name handles both layouts.
 */
function getAgentVersion(): string {
	const ACCEPTED_NAMES = new Set(["@patchwork/agents", "patchwork-audit"]);
	try {
		// Static ESM import — `require("node:module")` gets compiled to the
		// tsup __require shim which throws in ESM context, sending us into
		// the outer catch and yielding "unknown".
		const req = createRequire(import.meta.url);
		for (const candidate of [
			"../package.json",
			"../../package.json",
			"../../../package.json",
			"../../../../package.json",
		]) {
			try {
				const pkg = req(candidate) as { name?: string; version?: string };
				if (pkg.name && ACCEPTED_NAMES.has(pkg.name) && typeof pkg.version === "string") {
					return pkg.version;
				}
			} catch {
				// Try next candidate
			}
		}
		return "unknown";
	} catch {
		return "unknown";
	}
}

// ---------------------------------------------------------------------------
// Taint snapshot wiring (v0.6.11 commit 7)
// ---------------------------------------------------------------------------

/**
 * Resolve which `TaintKind`s a given Claude Code tool name raises. The
 * `mcp__<server>__<tool>` family collapses to the `"mcp:"` key in
 * `RAISES_FOR_TOOL`; everything else is a direct lookup.
 */
function taintKindsForTool(toolName: string): readonly TaintKind[] {
	if (toolName.startsWith("mcp__")) {
		return RAISES_FOR_TOOL["mcp:"] ?? [];
	}
	return RAISES_FOR_TOOL[toolName] ?? [];
}

/**
 * Pick the most-meaningful identifier for a tool's taint source `ref`:
 * a file path, then URL, then command, then tool_name, falling back to
 * the tool name itself. The ref appears in the audit trail and in
 * `getActiveSources()` output — readers don't need it to be unique, just
 * descriptive enough for forensic review.
 */
function pickSourceRef(toolName: string, target: Target | undefined): string {
	return (
		target?.path ||
		target?.abs_path ||
		target?.url ||
		target?.command ||
		target?.tool_name ||
		toolName
	);
}

/**
 * Update the per-session taint snapshot for a PostToolUse event.
 *
 * Per design §3.3 / `RAISES_FOR_TOOL`:
 *   - `WebFetch` / `WebSearch` raise `prompt` + `network_content`.
 *   - `mcp__*` tools raise `mcp` + `prompt`.
 *   - `Read` raises `prompt` (over-raise until commit 9 wires
 *     trusted_paths config — the default trust posture is "untrusted"
 *     so every Read currently warrants the raise anyway). Read's
 *     `secret` kind is deferred to commit 8, which will gate it on a
 *     `secret_read` match from `classifyToolEvent` rather than firing
 *     on every Read.
 *   - `Write` / `Edit` / `MultiEdit` / `NotebookEdit` register the
 *     output path as `generated_file` with the currently-active taint
 *     sources captured as upstream provenance.
 *   - `Bash` is deliberately empty in `RAISES_FOR_TOOL` — its taint
 *     contribution requires shell-parser composition (`curl`/`wget`
 *     in a pipeline → `network_content`) and is wired in commit 8.
 *
 * This helper throws on storage I/O failure; the caller wraps it in a
 * try/catch per the source-fail-open contract (see header on
 * `taint-store.ts`).
 */
function updateTaintSnapshotForPostTool(
	input: ClaudeCodeHookInput,
	toolName: string,
	target: Target,
): void {
	const allKinds = taintKindsForTool(toolName);
	if (allKinds.length === 0) return;

	// commit 7 narrowing: `Read` raises `prompt` only here. The `secret`
	// kind on Read requires a `secret_read` match from `classifyToolEvent`
	// in `@patchwork/core/sinks`, which is composed in commit 8 alongside
	// the rest of the PreToolUse sink classifier wiring. Recording every
	// Read as a secret source would make `clearTaint("secret")` reject
	// without `--allow-secret-clear` after any read, which is wrong.
	const kinds =
		toolName === "Read"
			? allKinds.filter((k) => k !== "secret")
			: allKinds;
	if (kinds.length === 0) return;

	const sessionId = input.session_id || generateSessionId();
	let snapshot = loadOrInitSnapshot(sessionId);
	let changed = false;

	const ts = Date.now();
	const ref = pickSourceRef(toolName, target);

	// Hash the tool's response body when present, so the source record
	// pins the *content* that flowed in — not just the call. When there
	// is no response body (e.g. a Write returning a status string),
	// fall back to a tool-name-derived hash so the schema's required
	// content_hash field is always populated.
	const responseText =
		input.tool_response?.output ||
		input.tool_response?.content ||
		input.tool_response?.stdout ||
		"";
	const content_hash =
		typeof responseText === "string" && responseText.length > 0
			? hashContent(responseText)
			: hashContent(`tool:${toolName}:${ts}`);

	for (const kind of kinds) {
		if (kind === "generated_file") {
			// generated_file taint is path-anchored. The upstream set is
			// every currently-active source across all kinds — that's
			// what `registerGeneratedFile` records as the provenance
			// list for this write. A write with no upstream taint is a
			// no-op: clean output stays clean.
			const path = target.abs_path || target.path;
			if (!path) continue;
			const upstream: TaintSource[] = ALL_TAINT_KINDS.flatMap((k) =>
				getActiveSources(snapshot, k),
			);
			if (upstream.length === 0) continue;
			snapshot = registerGeneratedFile(snapshot, path, upstream);
			changed = true;
		} else {
			snapshot = registerTaint(snapshot, kind, {
				ts,
				ref,
				content_hash,
			});
			changed = true;
		}
	}

	// Skip the write when nothing actually changed — avoids churn for
	// tools whose only kind is `generated_file` and that run before any
	// upstream taint has been recorded.
	if (!changed) return;
	writeTaintSnapshot(snapshot);
}

function handleSubagentStart(store: Store, input: ClaudeCodeHookInput): null {
	const event = buildEvent(input, {
		action: "subagent_start",
		target: {
			type: "prompt",
			tool_name: input.subagent_type,
		},
	});
	store.append(event);
	return null;
}

function handleSubagentStop(store: Store, input: ClaudeCodeHookInput): null {
	const event = buildEvent(input, {
		action: "subagent_stop",
		target: {
			type: "prompt",
			tool_name: input.subagent_type,
		},
	});
	store.append(event);
	return null;
}

// ---------------------------------------------------------------------------
// Webhook alerts for high-risk events
// ---------------------------------------------------------------------------

/**
 * Fire a webhook notification for high-risk or denied events.
 * Configured via PATCHWORK_WEBHOOK_URL env var.
 * Supports Slack, Discord, and generic JSON webhooks.
 * Best-effort — never blocks or throws.
 */
function fireWebhookAlert(event: AuditEvent): void {
	const url = process.env.PATCHWORK_WEBHOOK_URL;
	if (!url) return;

	const isHighRisk = event.risk.level === "critical" || event.risk.level === "high";
	const isDenied = event.status === "denied";
	if (!isHighRisk && !isDenied) return;

	const target = event.target?.path
		|| event.target?.command?.slice(0, 80)
		|| event.target?.url?.slice(0, 80)
		|| event.target?.tool_name
		|| "unknown";

	const emoji = event.risk.level === "critical" ? "\u{1F6A8}" : isDenied ? "\u{1F6AB}" : "\u26A0\uFE0F";
	const text = `${emoji} **Patchwork Alert** — ${event.status === "denied" ? "DENIED" : event.risk.level.toUpperCase()}\nAction: \`${event.action}\`\nTarget: \`${target}\`\nAgent: ${event.agent}\nFlags: ${(event.risk.flags || []).join(", ") || "none"}`;

	// Detect webhook format
	const isSlack = url.includes("hooks.slack.com");
	const isDiscord = url.includes("discord.com/api/webhooks");

	const body = isSlack
		? JSON.stringify({ text: text.replace(/\*\*/g, "*") })
		: isDiscord
			? JSON.stringify({ content: text })
			: JSON.stringify({
				event: event.action,
				risk: event.risk.level,
				status: event.status,
				target,
				agent: event.agent,
				flags: event.risk.flags,
				timestamp: event.timestamp,
				text,
			});

	// Fire-and-forget — no await, no error propagation
	fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body,
		signal: AbortSignal.timeout(5000),
	}).catch(() => {
		// Best effort — webhook failure must never block the hook pipeline
	});
}

// ---------------------------------------------------------------------------
// Privacy-safe target processing
// ---------------------------------------------------------------------------

/** Patterns for secret-bearing CLI flags (--password, --token, --api-key, etc.). */
const SECRET_FLAG_RE = /(--(password|token|api[-_]?key|secret|auth[-_]?token|access[-_]?token|private[-_]?key)[= ])(\S+)/gi;

/** Authorization header pattern. */
const BEARER_RE = /(Authorization:\s*Bearer\s+)\S+/gi;

/** Common API key shapes (e.g. sk-...). */
const INLINE_SECRET_RE = /\b(sk-[a-zA-Z0-9_-]{20,})\b/g;

/**
 * Redact obvious secret-bearing tokens from a command string.
 * Preserves command structure; replaces sensitive values with [REDACTED].
 */
export function redactCommand(command: string): string {
	let result = command;
	result = result.replace(SECRET_FLAG_RE, "$1[REDACTED]");
	result = result.replace(BEARER_RE, "$1[REDACTED]");
	result = result.replace(INLINE_SECRET_RE, "[REDACTED]");
	return result;
}

/**
 * Process a target for privacy-safe storage:
 * - Convert absolute paths to relative (when under cwd)
 * - Strip abs_path unless PATCHWORK_CAPTURE_ABS_PATH=1
 * - Redact secrets in commands
 */
function processTarget(target: Target | undefined, cwd: string): Target | undefined {
	if (!target) return undefined;

	const result = { ...target };

	// Relative-path-first: convert to relative when path is under cwd
	if (result.path && isAbsolute(result.path)) {
		const rel = relative(cwd, result.path);
		if (rel && !rel.startsWith("..")) {
			result.path = rel;
		}
	}

	// Strip abs_path by default
	if (process.env.PATCHWORK_CAPTURE_ABS_PATH !== "1") {
		delete result.abs_path;
	}

	// Redact secrets in commands
	if (result.command) {
		result.command = redactCommand(result.command);
	}

	return result;
}

interface PartialEvent {
	action: Action;
	status?: AuditEvent["status"];
	target?: Partial<Target>;
	content?: AuditEvent["content"];
	provenance?: AuditEvent["provenance"];
}

function buildIdempotencyKey(input: ClaudeCodeHookInput, action: string): string | undefined {
	if (!input.session_id) return undefined;

	const hookEvent = input.hook_event_name;

	// Tool events: require tool_use_id for uniqueness — same session can have
	// many PostToolUse events with the same action type.
	if (hookEvent === "PostToolUse" || hookEvent === "PostToolUseFailure" || hookEvent === "PreToolUse") {
		if (!input.tool_use_id) return undefined;
		return [input.session_id, hookEvent, action, input.tool_use_id].join(":");
	}

	// SessionStart / SessionEnd: exactly one of each per session — safe to key.
	if (hookEvent === "SessionStart" || hookEvent === "SessionEnd") {
		return [input.session_id, hookEvent, action].join(":");
	}

	// Everything else (UserPromptSubmit, SubagentStart, SubagentStop, etc.)
	// can occur multiple times per session with no stable unique signal.
	// Omit key rather than create a colliding one.
	return undefined;
}

function buildEvent(input: ClaudeCodeHookInput, partial: PartialEvent): AuditEvent {
	// Build raw target for risk classification (needs original absolute paths)
	const rawTarget: Target | undefined = partial.target
		? { type: partial.target.type || "file", ...partial.target }
		: undefined;

	const risk = classifyRisk(partial.action, rawTarget);

	// Process target for privacy-safe storage (relativize, redact, strip abs_path)
	const target = processTarget(rawTarget, input.cwd);

	return {
		schema_version: CURRENT_SCHEMA_VERSION,
		id: generateEventId(),
		session_id: input.session_id || generateSessionId(),
		timestamp: new Date().toISOString(),
		idempotency_key: buildIdempotencyKey(input, partial.action),
		agent: "claude-code",
		action: partial.action,
		status: partial.status || "completed",
		target,
		project: {
			root: input.cwd,
			name: input.cwd.split("/").pop() || "unknown",
		},
		risk,
		content: partial.content,
		provenance: partial.provenance,
	};
}
