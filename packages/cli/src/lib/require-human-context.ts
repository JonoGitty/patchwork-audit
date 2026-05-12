/**
 * Gate administrative CLIs (`patchwork approve`, `patchwork clear-taint`,
 * `patchwork trust-repo-config`) behind a check that the caller is a
 * human at an interactive terminal, not a tool subprocess spawned by
 * the agent (v0.6.11 R2-001 / R2-002 fix).
 *
 * Without this gate, the agent can simply run `patchwork approve <id>`
 * via its own Bash tool — defeating the human gate entirely. The exact
 * exploit GPT-5.5 surfaced in R2.
 *
 * Heuristic: stdin must be a TTY, AND we require either a TTY stdout
 * OR an explicit override (`PATCHWORK_HUMAN_CONTEXT=1` for non-
 * interactive trusted contexts like a privileged CI runner where the
 * operator KNOWS the call site is human). The override exists because
 * CI pipelines that legitimately need to approve from a service account
 * shouldn't be locked out forever — but the variable must be set by the
 * human ahead of time, not by the agent at runtime.
 *
 * Agent Bash subprocesses typically do NOT have a TTY (Claude Code
 * spawns the hook command with piped stdio). Even if the agent
 * speculatively sets PATCHWORK_HUMAN_CONTEXT=1 in its env, that env is
 * the *same* env the agent itself runs in — so this is a partial
 * mitigation, not a complete one. The first line of defense is still
 * the system-policy `commands.deny` entries; this is the second line.
 */
export interface HumanContextResult {
	ok: boolean;
	reason?: string;
}

export function checkHumanContext(): HumanContextResult {
	if (process.env.PATCHWORK_HUMAN_CONTEXT === "1") {
		return { ok: true };
	}
	if (!process.stdin.isTTY) {
		return {
			ok: false,
			reason:
				"This command requires an interactive terminal. " +
				"It refuses to run from agent tool subprocesses (no stdin TTY). " +
				"Run it directly in your shell, or set PATCHWORK_HUMAN_CONTEXT=1 " +
				"if you are scripting from a privileged context.",
		};
	}
	if (!process.stdout.isTTY) {
		return {
			ok: false,
			reason:
				"This command requires an interactive terminal. " +
				"stdout is not a TTY (output is being captured). " +
				"Set PATCHWORK_HUMAN_CONTEXT=1 if scripting deliberately.",
		};
	}
	return { ok: true };
}

/**
 * Convenience: runs `checkHumanContext` and exits with a friendly
 * error message if it returns not-ok. Use this at the very top of any
 * administrative CLI command action.
 */
export function requireHumanContext(commandName: string): void {
	const r = checkHumanContext();
	if (!r.ok) {
		process.stderr.write(
			`[31m✗[0m patchwork ${commandName}: refused.\n` +
				`\n  ${r.reason}\n\n` +
				`This is a security boundary. v0.6.11 R2 audit (GPT-5.5) flagged that\n` +
				`administrative CLIs were agent-callable; this gate closes that.\n`,
		);
		process.exit(3);
	}
}
