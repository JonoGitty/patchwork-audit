/**
 * Sensitive file detection.
 * Patterns extracted from Tool Factory's starky-approval-policy.yml
 * and expanded with common sensitive file patterns.
 */

export const SENSITIVE_GLOBS = [
	// Secrets and credentials
	"**/.env",
	"**/.env.*",
	"**/*secret*",
	"**/*credential*",
	"**/id_rsa",
	"**/id_ed25519",
	"**/*.pem",
	"**/*.key",
	"**/*.p12",
	"**/*.pfx",
	"**/*.keystore",

	// API keys and tokens
	"**/*apikey*",
	"**/*api_key*",
	"**/*token*",

	// Auth config
	"**/.npmrc",
	"**/.pypirc",
	"**/.netrc",
	"**/.htpasswd",
	"**/.ssh/*",

	// Cloud credentials
	"**/.aws/credentials",
	"**/.gcloud/*.json",
	"**/.azure/*.json",

	// Database
	"**/*.sqlite",
	"**/*.db",
];

import { realpathSync } from "node:fs";
import { isAbsolute, resolve as pathResolve } from "node:path";
import picomatch from "picomatch";

/**
 * Glob matching for sensitive file detection.
 * Uses picomatch for reliable cross-platform glob support.
 */
export function matchesGlob(filePath: string, pattern: string): boolean {
	const normalized = filePath.replace(/\\/g, "/");
	return picomatch.isMatch(normalized, pattern, { dot: true, nocase: true });
}

/**
 * Expand one tool-supplied path into the candidate set the policy / risk
 * classifier should evaluate against:
 *
 *   1. The raw input (backward compat — rules written against literal
 *      strings keep working).
 *   2. The lexically-resolved absolute path (collapses `..` and applies cwd).
 *   3. The realpath of #2 — only when the path exists on disk.
 *
 * Returning #3 closes the symlink-bypass: `ln -s ~/.ssh/id_rsa README.md`
 * then `Read README.md`. Without realpath the deny rule for an `.ssh/`
 * glob never sees `id_rsa`. With realpath we evaluate both `README.md`
 * AND the symlink target.
 *
 * Best-effort: realpath failures (file doesn't exist yet, e.g. file_create)
 * are silently skipped. Lexical resolution still catches `..` traversal.
 */
export function expandPathCandidates(raw: string, cwd?: string): string[] {
	if (!raw) return [];
	const out = new Set<string>([raw]);
	const absLike = isAbsolute(raw) ? raw : cwd ? pathResolve(cwd, raw) : raw;
	out.add(absLike);
	try {
		out.add(realpathSync.native(absLike));
	} catch {
		// path doesn't exist yet — lexical resolution is the strongest signal
	}
	return Array.from(out);
}
