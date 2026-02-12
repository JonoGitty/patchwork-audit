import {
	type AuditEvent,
	type Store,
	type Target,
	CURRENT_SCHEMA_VERSION,
	classifyRisk,
	evaluatePolicy,
	generateEventId,
	generateSessionId,
	hashContent,
	JsonlStore,
	SqliteStore,
	loadActivePolicy,
} from "@patchwork/core";
import { isAbsolute, relative } from "node:path";
import { mapClaudeCodeTool } from "./mapper.js";
import type { ClaudeCodeHookInput, ClaudeCodeHookOutput } from "./types.js";

function getEventsPath(): string {
	return `${process.env.HOME}/.patchwork/events.jsonl`;
}

function getDbPath(): string {
	return `${process.env.HOME}/.patchwork/db/audit.db`;
}

/** Wraps a primary and optional secondary store for dual-write. */
function createDualWriter(primary: Store, secondary: Store | null): Store {
	let sqliteErrorCount = 0;

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
				}
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
export function handleClaudeCodeHook(input: ClaudeCodeHookInput): ClaudeCodeHookOutput | null {
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

	switch (hookEvent) {
		case "SessionStart":
			return handleSessionStart(store, input);

		case "SessionEnd":
			return handleSessionEnd(store, input);

		case "UserPromptSubmit":
			return handlePromptSubmit(store, input);

		case "PreToolUse":
			return handlePreToolUse(store, input);

		case "PostToolUse":
			return handlePostToolUse(store, input);

		case "PostToolUseFailure":
			return handlePostToolUse(store, input, "failed");

		case "SubagentStart":
			return handleSubagentStart(store, input);

		case "SubagentStop":
			return handleSubagentStop(store, input);

		default:
			// Log but don't process unknown events
			return null;
	}
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

		return {
			allow: false,
			reason: `[Patchwork] ${decision.reason}`,
		};
	}

	return { allow: true };
}

function handlePostToolUse(
	store: Store,
	input: ClaudeCodeHookInput,
	overrideStatus?: "failed",
): null {
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
	return null;
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
	action: string;
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
