/**
 * Gate administrative CLIs (`patchwork approve`, `patchwork clear-taint`,
 * `patchwork trust-repo-config`) behind a check that the caller is at an
 * interactive terminal (v0.6.11 R2/R3 hardening).
 *
 * This is a *defense-in-depth* check, NOT a security boundary.
 *
 * The fundamental constraint: the agent runs as the same UID as the user.
 * Anything the user can do from their shell, the agent can also do from
 * its Bash tool. A TTY check is a heuristic — the agent can allocate a
 * pseudo-terminal via `script -q -c '...'`, `expect`, `socat`, or
 * `python -c 'import pty; pty.spawn(...)'` and pass it. The previous
 * `PATCHWORK_HUMAN_CONTEXT=1` env override was even weaker because it
 * was settable by the agent's own Bash. R3-001 removed it.
 *
 * The real defense is the *system-policy* `commands.deny` entries for
 * `patchwork approve`, `patchwork clear-taint`, and
 * `patchwork trust-repo-config` in `/Library/Patchwork/policy.yml`.
 * Those are evaluated by the PreToolUse hook *before* the agent's Bash
 * subprocess is allowed to spawn at all, and the system policy file is
 * root-owned so the agent cannot rewrite it. This TTY check is the
 * second line — useful if a future agent framework loses the hook, or
 * if the user runs an older Claude Code without the PreToolUse pipeline.
 *
 * The honest threat-model statement is documented in
 * `docs/v0.6.11/threat-model.md` under "Same-UID approval boundary".
 * v0.6.12 plans an out-of-band approval mechanism (root-owned daemon)
 * that the agent process literally cannot speak to.
 */
export interface HumanContextResult {
	ok: boolean;
	reason?: string;
}

export function checkHumanContext(): HumanContextResult {
	if (!process.stdin.isTTY) {
		return {
			ok: false,
			reason:
				"This command requires an interactive terminal. " +
				"It refuses to run when stdin is not a TTY (typical agent subprocess). " +
				"Run it directly in your own shell.",
		};
	}
	if (!process.stdout.isTTY) {
		return {
			ok: false,
			reason:
				"This command requires an interactive terminal. " +
				"stdout is not a TTY (output is being captured). " +
				"Run it directly in your own shell.",
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
			`\x1b[31m✗\x1b[0m patchwork ${commandName}: refused.\n` +
				`\n  ${r.reason}\n\n` +
				`This is a defense-in-depth check. The primary boundary is the\n` +
				`system-policy command-prefix deny for administrative CLIs in\n` +
				`/Library/Patchwork/policy.yml — see docs/v0.6.11/threat-model.md.\n`,
		);
		process.exit(3);
	}
}
