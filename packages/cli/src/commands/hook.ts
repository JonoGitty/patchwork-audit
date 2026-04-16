import { Command } from "commander";
import { existsSync, mkdirSync, appendFileSync, chmodSync, statSync, renameSync, unlinkSync, openSync, closeSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, basename, join } from "node:path";
import { handleClaudeCodeHook } from "@patchwork/agents";
import type { ClaudeCodeHookInput } from "@patchwork/agents";
import { PRETOOL_TELEMETRY_PATH } from "../store.js";

/** Fail-closed deny response for PreToolUse internal errors. */
const FAIL_CLOSED_DENY = {
	hookSpecificOutput: {
		hookEventName: "PreToolUse",
		permissionDecision: "deny",
		permissionDecisionReason: "[Patchwork] Hook internal error (fail-closed mode)",
	},
} as const;

/**
 * Internal hook handlers. Called by AI agent hook systems.
 * Receives JSON on stdin, processes it, writes to audit trail.
 *
 * Not intended for direct user invocation.
 */
export const hookCommand = new Command("hook")
	.description("Internal: handle agent hook events")
	.argument("<event>", "Hook event type")
	.action(async (event: string) => {
		const mappedEvent = mapEventArg(event);
		const isPreTool = mappedEvent === "PreToolUse";
		const failClosed = isPreTool && process.env.PATCHWORK_PRETOOL_FAIL_CLOSED === "1";
		const telemetryJson = isPreTool && process.env.PATCHWORK_PRETOOL_TELEMETRY_JSON === "1";

		const startMs = Date.now();
		const input = await readStdin();

		// Track outcome for telemetry
		let outcome: "allow" | "deny" | "internal_error" = "allow";
		let reason: string | null = null;

		if (!input) {
			if (failClosed) {
				process.stdout.write(JSON.stringify(FAIL_CLOSED_DENY));
				outcome = "internal_error";
				reason = FAIL_CLOSED_DENY.hookSpecificOutput.permissionDecisionReason;
			}
			emitPreToolTelemetry(isPreTool, telemetryJson, startMs, failClosed, outcome, reason);
			return;
		}

		try {
			const parsed = JSON.parse(input) as ClaudeCodeHookInput;
			parsed.hook_event_name = mappedEvent;

			const output = await handleClaudeCodeHook(parsed);

			// Write output for hooks that expect a response (PreToolUse)
			if (output) {
				process.stdout.write(JSON.stringify(output));
				if (isPreTool && output.hookSpecificOutput?.permissionDecision === "deny") {
					outcome = "deny";
					reason = output.hookSpecificOutput.permissionDecisionReason || null;
				}
			}
		} catch {
			if (failClosed) {
				process.stdout.write(JSON.stringify(FAIL_CLOSED_DENY));
				outcome = "internal_error";
				reason = FAIL_CLOSED_DENY.hookSpecificOutput.permissionDecisionReason;
			}
			// Non-PreToolUse or fail-closed disabled: fail silently (existing behavior)
		}

		emitPreToolTelemetry(isPreTool, telemetryJson, startMs, failClosed, outcome, reason);
	});

const TELEMETRY_DIR_MODE = 0o700;
const TELEMETRY_FILE_MODE = 0o600;

/** Valid telemetry destination values. */
type TelemetryDest = "stderr" | "file" | "both";

/** Valid lock mode values for telemetry file writes. */
type TelemetryLockMode = "always" | "rotate-only";

/**
 * Emit latency warning and/or structured telemetry for PreToolUse.
 */
function emitPreToolTelemetry(
	isPreTool: boolean,
	telemetryJson: boolean,
	startMs: number,
	failClosedEnabled: boolean,
	outcome: "allow" | "deny" | "internal_error",
	reason: string | null,
): void {
	if (!isPreTool) return;

	const elapsedMs = Date.now() - startMs;
	const envWarnMs = process.env.PATCHWORK_PRETOOL_WARN_MS;
	const warnMs = envWarnMs !== undefined ? Number(envWarnMs) : 800;
	const warnTriggered = elapsedMs > warnMs;

	if (telemetryJson) {
		const record = {
			ts: new Date().toISOString(),
			event: "PreToolUse",
			elapsed_ms: elapsedMs,
			warn_threshold_ms: warnMs,
			warn_triggered: warnTriggered,
			fail_closed_enabled: failClosedEnabled,
			outcome,
			reason,
		};
		const line = JSON.stringify(record) + "\n";
		const dest = parseTelemetryDest(process.env.PATCHWORK_PRETOOL_TELEMETRY_DEST);
		const toStderr = dest === "stderr" || dest === "both";
		const toFile = dest === "file" || dest === "both";

		if (toStderr) {
			process.stderr.write(line);
		}
		if (toFile) {
			appendTelemetryFile(line);
		}
		// If dest is "file" only, we already wrote to file and skip stderr JSON.
		// But if neither branch ran (shouldn't happen), fall through silently.
	} else if (warnTriggered) {
		process.stderr.write(
			`[patchwork] PreToolUse hook took ${elapsedMs}ms (threshold: ${warnMs}ms)\n`,
		);
	}
}

/** Parse and validate the telemetry dest env var. */
function parseTelemetryDest(raw: string | undefined): TelemetryDest {
	if (raw === "file" || raw === "both") return raw;
	return "stderr"; // default
}

/** Parse and validate the telemetry lock mode env var. */
function parseLockMode(raw: string | undefined): TelemetryLockMode {
	if (raw === "rotate-only") return raw;
	return "always"; // default — safe
}

/** Reconcile file/dir permissions if they don't match target. */
function reconcileTelemetryMode(path: string, targetMode: number): void {
	try {
		const stat = statSync(path);
		if ((stat.mode & 0o777) !== targetMode) {
			chmodSync(path, targetMode);
		}
	} catch {
		// Path disappeared — safe to ignore
	}
}

/** Lock tuning for telemetry file critical section. */
const TELEM_LOCK_MAX_RETRIES = 10;
const TELEM_LOCK_RETRY_MS = 5;
const TELEM_LOCK_STALE_MS = 2_000;

/** Synchronous sleep using Atomics.wait. */
function sleepSync(ms: number): void {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Execute fn while holding an advisory lock on `<filePath>.lock`.
 * Uses O_EXCL for atomic creation, bounded retry with short backoff,
 * and stale reclamation for crashed holders.
 * Returns true if the lock was acquired and fn executed; false otherwise.
 */
function withTelemetryLock(filePath: string, fn: () => void): boolean {
	const lockPath = filePath + ".lock";
	let fd: number | null = null;

	for (let attempt = 0; attempt < TELEM_LOCK_MAX_RETRIES; attempt++) {
		try {
			fd = openSync(lockPath, "wx", TELEMETRY_FILE_MODE);
			break;
		} catch (err: unknown) {
			if ((err as NodeJS.ErrnoException).code === "EEXIST") {
				// Check if lock is stale (holder crashed)
				try {
					const st = statSync(lockPath);
					if (Date.now() - st.mtimeMs > TELEM_LOCK_STALE_MS) {
						try { unlinkSync(lockPath); } catch { /* race ok */ }
						continue;
					}
				} catch {
					// Lock disappeared between check — retry
					continue;
				}
				sleepSync(TELEM_LOCK_RETRY_MS);
				continue;
			}
			return false; // non-EEXIST error (permissions, etc.)
		}
	}

	if (fd === null) return false;

	// Write pid for debuggability
	try { writeFileSync(fd, String(process.pid)); } catch { /* best-effort */ }

	try {
		fn();
		return true;
	} finally {
		closeSync(fd);
		try { unlinkSync(lockPath); } catch { /* best-effort */ }
	}
}

/** Build the rotated file path for a given index (1-based). */
function rotatedPath(filePath: string, index: number): string {
	const dir = dirname(filePath);
	const base = basename(filePath);
	// pretool.jsonl -> pretool.1.jsonl
	const dotIdx = base.indexOf(".");
	if (dotIdx === -1) return join(dir, `${base}.${index}`);
	return join(dir, `${base.slice(0, dotIdx)}.${index}${base.slice(dotIdx)}`);
}

/** Escape special regex characters in a string. */
function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Scan directory for rotated files with index >= maxFiles and delete them.
 * Handles gaps (e.g. .1 and .3 existing while .2 missing).
 */
function cleanupRotatedFiles(filePath: string, maxFiles: number): void {
	const dir = dirname(filePath);
	const base = basename(filePath);
	const dotIdx = base.indexOf(".");
	const stem = dotIdx === -1 ? base : base.slice(0, dotIdx);
	const ext = dotIdx === -1 ? "" : base.slice(dotIdx);
	const pattern = new RegExp(`^${escapeRegex(stem)}\\.(\\d+)${escapeRegex(ext)}$`);

	try {
		for (const entry of readdirSync(dir)) {
			const match = entry.match(pattern);
			if (match) {
				const idx = Number(match[1]);
				if (idx >= maxFiles) {
					try { unlinkSync(join(dir, entry)); } catch { /* best effort */ }
				}
			}
		}
	} catch {
		// Dir read failure — best effort
	}
}

/** Rotate telemetry files: active → .1, .1 → .2, etc. Delete beyond maxFiles. */
function rotateTelemetryFiles(filePath: string, maxFiles: number): void {
	// Clean up all rotated files with index >= maxFiles (gap-robust)
	cleanupRotatedFiles(filePath, maxFiles);
	// Shift N-1 → N, N-2 → N-1, ..., 1 → 2
	for (let i = maxFiles - 1; i >= 1; i--) {
		const src = rotatedPath(filePath, i);
		if (existsSync(src)) {
			renameSync(src, rotatedPath(filePath, i + 1));
		}
	}
	// Active → .1
	renameSync(filePath, rotatedPath(filePath, 1));
	// Reconcile perms on rotated file
	reconcileTelemetryMode(rotatedPath(filePath, 1), TELEMETRY_FILE_MODE);
}

/** Append one JSON line to the telemetry file with secure permissions and optional rotation. */
function appendTelemetryFile(line: string): void {
	const filePath = process.env.PATCHWORK_PRETOOL_TELEMETRY_FILE || PRETOOL_TELEMETRY_PATH;
	try {
		const dir = dirname(filePath);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true, mode: TELEMETRY_DIR_MODE });
		} else {
			reconcileTelemetryMode(dir, TELEMETRY_DIR_MODE);
		}

		// Rotation check
		const envMaxBytes = process.env.PATCHWORK_PRETOOL_TELEMETRY_MAX_BYTES;
		const maxBytes = envMaxBytes !== undefined ? Number(envMaxBytes) : 0;
		const needsRotation = maxBytes > 0 && existsSync(filePath) && (() => {
			try {
				return statSync(filePath).size + Buffer.byteLength(line) > maxBytes;
			} catch { return false; }
		})();

		const lockMode = parseLockMode(process.env.PATCHWORK_PRETOOL_TELEMETRY_LOCK_MODE);

		if (needsRotation) {
			// Lock-protected rotation + append
			const ok = withTelemetryLock(filePath, () => {
				// Re-check inside lock (another holder may have already rotated)
				try {
					if (existsSync(filePath) && statSync(filePath).size + Buffer.byteLength(line) > maxBytes) {
						const envMaxFiles = process.env.PATCHWORK_PRETOOL_TELEMETRY_MAX_FILES;
						const maxFiles = envMaxFiles !== undefined ? Number(envMaxFiles) : 5;
						rotateTelemetryFiles(filePath, maxFiles);
					}
				} catch {
					// Rotation failure — continue with append
				}
				appendFileSync(filePath, line, { mode: TELEMETRY_FILE_MODE });
				reconcileTelemetryMode(filePath, TELEMETRY_FILE_MODE);
			});
			if (!ok) {
				process.stderr.write("[patchwork] telemetry lock contention, skipping file write\n");
			}
		} else if (lockMode === "always") {
			// Lock-protected append (default safe mode)
			const ok = withTelemetryLock(filePath, () => {
				appendFileSync(filePath, line, { mode: TELEMETRY_FILE_MODE });
				reconcileTelemetryMode(filePath, TELEMETRY_FILE_MODE);
			});
			if (!ok) {
				process.stderr.write("[patchwork] telemetry lock contention, skipping file write\n");
			}
		} else {
			// rotate-only: append without lock (lock-free for non-rotation path)
			appendFileSync(filePath, line, { mode: TELEMETRY_FILE_MODE });
			reconcileTelemetryMode(filePath, TELEMETRY_FILE_MODE);
		}
	} catch {
		process.stderr.write("[patchwork] telemetry file write failed\n");
	}
}

function readStdin(): Promise<string> {
	return new Promise((resolve) => {
		let data = "";
		process.stdin.setEncoding("utf-8");
		process.stdin.on("data", (chunk) => {
			data += chunk;
		});
		process.stdin.on("end", () => {
			resolve(data);
		});
		// Timeout: don't hang if no stdin
		setTimeout(() => resolve(data), 500);
	});
}

function mapEventArg(arg: string): string {
	const map: Record<string, string> = {
		"pre-tool": "PreToolUse",
		"post-tool": "PostToolUse",
		"post-tool-failure": "PostToolUseFailure",
		"session-start": "SessionStart",
		"session-end": "SessionEnd",
		"prompt-submit": "UserPromptSubmit",
		"subagent-start": "SubagentStart",
		"subagent-stop": "SubagentStop",
		"codex-turn": "CodexTurnComplete",
	};
	return map[arg] || arg;
}
