/**
 * Detects git commit commands in Bash tool invocations and extracts
 * commit metadata from git's stdout output.
 */

/** Matches `git commit` but not `git log`, `echo "git commit"`, or comments. */
const GIT_COMMIT_RE = /(?:^|&&|\|\||;)\s*(?:(?:[\w]+=\S+\s+)*)git\s+commit\b/;

/**
 * Git's commit-line output, covering all observed forms:
 *   - normal:        `[main abc1234] msg`
 *   - root commit:   `[main (root-commit) abc1234] msg`
 *   - detached HEAD: `[detached HEAD abc1234] msg`
 *
 * The branch capture is non-greedy and may include spaces (for "detached
 * HEAD"); the optional `(root-commit)` flag is consumed but not captured;
 * the SHA is the trailing hex token before the closing bracket.
 */
const COMMIT_OUTPUT_RE = /\[(.+?)(?:\s+\(root-commit\))?\s+([a-f0-9]{7,40})\]/;

/** Detects `--no-verify` flag usage. */
const NO_VERIFY_RE = /\bgit\s+commit\b[^;|&]*--no-verify/;

/**
 * Returns true if the command string contains a `git commit` invocation.
 * Ignores echo'd strings and comments.
 */
export function isGitCommitCommand(command: string): boolean {
	if (!command) return false;
	// Strip quoted strings so `echo "git commit"` doesn't match
	const stripped = command.replace(/"[^"]*"|'[^']*'/g, '""');
	// Strip comments
	const noComments = stripped.replace(/#.*/g, "");
	return GIT_COMMIT_RE.test(noComments);
}

/**
 * Extract the commit SHA and branch from git's stdout output.
 * Returns null if the output doesn't contain a successful commit marker.
 */
export function extractCommitInfo(
	stdout: string,
): { sha: string; branch: string } | null {
	if (!stdout) return null;
	const match = stdout.match(COMMIT_OUTPUT_RE);
	if (!match) return null;
	return { branch: match[1], sha: match[2] };
}

/**
 * Returns true if the command uses `--no-verify`, which is a risk signal.
 */
export function usesNoVerify(command: string): boolean {
	return NO_VERIFY_RE.test(command);
}
