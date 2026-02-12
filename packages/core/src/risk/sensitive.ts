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

import picomatch from "picomatch";

/**
 * Glob matching for sensitive file detection.
 * Uses picomatch for reliable cross-platform glob support.
 */
export function matchesGlob(filePath: string, pattern: string): boolean {
	const normalized = filePath.replace(/\\/g, "/");
	return picomatch.isMatch(normalized, pattern, { dot: true, nocase: true });
}
