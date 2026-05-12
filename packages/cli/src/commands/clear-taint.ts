import { Command } from "commander";
import chalk from "chalk";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
	clearTaint,
	getActiveSources,
	ALL_TAINT_KINDS,
	type TaintKind,
	type TaintSnapshot,
} from "@patchwork/core";
import {
	getTaintDir,
	getTaintSnapshotPath,
	loadOrInitSnapshot,
	readTaintSnapshot,
	writeTaintSnapshot,
} from "@patchwork/agents";
import { requireHumanContext } from "../lib/require-human-context.js";

/**
 * `patchwork clear-taint` — out-of-band declassification (v0.6.11 commit 9).
 *
 * The taint engine retains cleared sources (audit trail), it just flips
 * their `cleared` field so `hasAnyTaint` no longer counts them. After
 * `clear-taint`, the next PreToolUse decision on the same session treats
 * the kind as inactive — the keystone and sink layers stop blocking on
 * the cleared kinds.
 *
 * Usage:
 *   patchwork clear-taint                        # clear all non-secret kinds
 *   patchwork clear-taint prompt                 # clear just `prompt`
 *   patchwork clear-taint secret --allow-secret  # clear `secret` (explicit opt-in)
 *   patchwork clear-taint --session ses_abc      # operate on a specific session
 *
 * Default session selection is "most recently modified snapshot file" so
 * the user can declassify after a denial without having to copy a long
 * session id around.
 */
export const clearTaintCommand = new Command("clear-taint")
	.description("Declassify active taint sources for a session")
	.argument(
		"[kind]",
		"Single taint kind to clear (prompt|secret|network_content|mcp|generated_file). Omit for all-non-secret.",
	)
	.option(
		"-s, --session <id>",
		"Session id (default: most recently modified snapshot)",
	)
	.option(
		"--allow-secret",
		"Required when clearing the 'secret' kind",
		false,
	)
	.action(
		(
			kindArg: string | undefined,
			opts: { session?: string; allowSecret: boolean },
		) => {
			requireHumanContext("clear-taint");
			const sessionId = opts.session ?? mostRecentSessionId();
			if (!sessionId) {
				console.error(
					chalk.red(
						"No session snapshot found. Pass --session <id> or run an agent action first.",
					),
				);
				process.exit(2);
			}

			const before = readTaintSnapshot(sessionId);
			if (!before) {
				console.error(
					chalk.yellow(
						`No snapshot for session '${sessionId}' (or unreadable/corrupt). Nothing to clear.`,
					),
				);
				return;
			}

			let kindsToClear: TaintKind[];
			if (kindArg) {
				if (!isTaintKind(kindArg)) {
					console.error(
						chalk.red(
							`Unknown taint kind '${kindArg}'. Expected one of: ${ALL_TAINT_KINDS.join(", ")}.`,
						),
					);
					process.exit(2);
				}
				kindsToClear = [kindArg];
			} else {
				// Default: clear all non-secret. secret needs explicit opt-in
				// per the engine's clearTaint contract.
				kindsToClear = ALL_TAINT_KINDS.filter((k) => k !== "secret");
			}

			let snapshot: TaintSnapshot = loadOrInitSnapshot(sessionId);
			const before_active = ALL_TAINT_KINDS.map((k) => ({
				kind: k,
				count: getActiveSources(snapshot, k).length,
			}));

			let cleared = 0;
			for (const k of kindsToClear) {
				try {
					snapshot = clearTaint(snapshot, k, {
						method: "out_of_band",
						ts: Date.now(),
						allowSecretClear: opts.allowSecret,
					});
				} catch (err) {
					if (k === "secret" && !opts.allowSecret) {
						console.error(
							chalk.red(
								"Clearing 'secret' requires --allow-secret. Skipping.",
							),
						);
						continue;
					}
					const msg = err instanceof Error ? err.message : String(err);
					console.error(chalk.red(`Failed to clear ${k}: ${msg}`));
					continue;
				}
				cleared++;
			}

			if (cleared === 0) {
				console.log(chalk.dim("Nothing cleared."));
				return;
			}

			writeTaintSnapshot(snapshot);

			console.log(
				chalk.green("✓") +
					` Cleared ${kindsToClear.join(", ")} for ${sessionId}`,
			);
			console.log();
			console.log(chalk.bold("Active sources before:"));
			for (const r of before_active) {
				if (r.count > 0) {
					console.log(`  ${chalk.cyan(r.kind)}: ${r.count}`);
				}
			}
			console.log(chalk.bold("Active sources after:"));
			for (const k of ALL_TAINT_KINDS) {
				const n = getActiveSources(snapshot, k).length;
				if (n > 0) console.log(`  ${chalk.cyan(k)}: ${n}`);
			}
			void before; // before reference kept for diff-debug purposes
		},
	);

function isTaintKind(s: string): s is TaintKind {
	return (ALL_TAINT_KINDS as readonly string[]).includes(s);
}

/**
 * Pick the most-recently-modified `.json` snapshot file in the taint
 * directory and return its session id (derived by reading the file —
 * the filename is sha256 hash and not reversible).
 */
function mostRecentSessionId(): string | undefined {
	const dir = getTaintDir();
	if (!existsSync(dir)) return undefined;
	let mostRecent: { name: string; mtimeMs: number } | null = null;
	let files: string[];
	try {
		files = readdirSync(dir);
	} catch {
		return undefined;
	}
	for (const f of files) {
		if (!f.endsWith(".json")) continue;
		try {
			const st = statSync(join(dir, f));
			if (!mostRecent || st.mtimeMs > mostRecent.mtimeMs) {
				mostRecent = { name: f, mtimeMs: st.mtimeMs };
			}
		} catch {
			// skip
		}
	}
	if (!mostRecent) return undefined;
	// Filename is sha256(session_id).json — not reversible. We instead
	// open the file and read session_id from inside.
	try {
		const path = join(dir, mostRecent.name);
		const raw = require("node:fs").readFileSync(path, "utf-8");
		const parsed = JSON.parse(raw) as { session_id?: string };
		return parsed.session_id;
	} catch {
		return undefined;
	}
}

// Silence unused-import for getTaintSnapshotPath in some lints (kept
// available so callers can do extended diagnostics).
void getTaintSnapshotPath;
