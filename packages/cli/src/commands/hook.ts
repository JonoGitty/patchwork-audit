import { Command } from "commander";
import { existsSync, mkdirSync, appendFileSync, chmodSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { handleClaudeCodeHook } from "@patchwork/agents";
import type { ClaudeCodeHookInput } from "@patchwork/agents";
import { PRETOOL_TELEMETRY_PATH } from "../store.js";

/** Fail-closed deny response for PreToolUse internal errors. */
const FAIL_CLOSED_DENY = {
	allow: false,
	reason: "[Patchwork] Hook internal error (fail-closed mode)",
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
				reason = FAIL_CLOSED_DENY.reason;
			}
			emitPreToolTelemetry(isPreTool, telemetryJson, startMs, failClosed, outcome, reason);
			return;
		}

		try {
			const parsed = JSON.parse(input) as ClaudeCodeHookInput;
			parsed.hook_event_name = mappedEvent;

			const output = handleClaudeCodeHook(parsed);

			// Write output for hooks that expect a response (PreToolUse)
			if (output) {
				process.stdout.write(JSON.stringify(output));
				if (isPreTool && !output.allow) {
					outcome = "deny";
					reason = output.reason || null;
				}
			}
		} catch {
			if (failClosed) {
				process.stdout.write(JSON.stringify(FAIL_CLOSED_DENY));
				outcome = "internal_error";
				reason = FAIL_CLOSED_DENY.reason;
			}
			// Non-PreToolUse or fail-closed disabled: fail silently (existing behavior)
		}

		emitPreToolTelemetry(isPreTool, telemetryJson, startMs, failClosed, outcome, reason);
	});

const TELEMETRY_DIR_MODE = 0o700;
const TELEMETRY_FILE_MODE = 0o600;

/** Valid telemetry destination values. */
type TelemetryDest = "stderr" | "file" | "both";

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

/** Append one JSON line to the telemetry file with secure permissions. */
function appendTelemetryFile(line: string): void {
	const filePath = process.env.PATCHWORK_PRETOOL_TELEMETRY_FILE || PRETOOL_TELEMETRY_PATH;
	try {
		const dir = dirname(filePath);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true, mode: TELEMETRY_DIR_MODE });
		} else {
			reconcileTelemetryMode(dir, TELEMETRY_DIR_MODE);
		}
		appendFileSync(filePath, line, { mode: TELEMETRY_FILE_MODE });
		reconcileTelemetryMode(filePath, TELEMETRY_FILE_MODE);
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
