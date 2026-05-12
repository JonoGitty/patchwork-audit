/**
 * User-level trusted-repos store (v0.6.11 R2-003 fix).
 *
 * Trust decisions for which repo paths do NOT raise `prompt` taint on
 * Read live at `~/.patchwork/trusted-repos.yml`, keyed by repo absolute
 * path. The file is owned by the user, not by any repo — so a hostile
 * project cannot commit a `.patchwork/policy.yml` with broad
 * `trusted_paths` and silence the taint engine.
 *
 *   schema_version: 1
 *   repos:
 *     /Users/jono/AI/codex-audit:
 *       trusted_paths:
 *         - "packages/**\/src/**"
 *     /Users/jono/AI/other-project:
 *       trusted_paths:
 *         - "lib/**"
 *
 * The `patchwork trust-repo-config` CLI is the only sanctioned writer;
 * it is gated behind a TTY check so the agent cannot invoke it.
 *
 * FORCE_UNTRUSTED_PATTERNS from the engine always win — `README*`,
 * `docs/**`, `node_modules/**`, etc. cannot be silenced.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import YAML from "yaml";

export interface TrustStore {
	schema_version: 1;
	repos: Record<string, { trusted_paths: string[] }>;
}

export function getTrustFilePath(): string {
	return join(homedir(), ".patchwork", "trusted-repos.yml");
}

export function loadTrustStore(path?: string): TrustStore {
	const p = path ?? getTrustFilePath();
	if (!existsSync(p)) {
		return { schema_version: 1, repos: {} };
	}
	try {
		const raw = readFileSync(p, "utf-8");
		const parsed = YAML.parse(raw) as unknown;
		if (isTrustStore(parsed)) {
			return parsed;
		}
	} catch {
		// fall through
	}
	return { schema_version: 1, repos: {} };
}

export function saveTrustStore(path: string, store: TrustStore): void {
	const dir = dirname(path);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true, mode: 0o700 });
	}
	writeFileSync(path, YAML.stringify(store, { lineWidth: 100 }), {
		mode: 0o600,
	});
}

export function getTrustedPathsForRepo(
	repoRoot: string,
	overridePath?: string,
): readonly string[] {
	const store = loadTrustStore(overridePath);
	const entry = store.repos[repoRoot];
	return entry?.trusted_paths ?? [];
}

function isTrustStore(value: unknown): value is TrustStore {
	if (typeof value !== "object" || value === null) return false;
	const v = value as { schema_version?: unknown; repos?: unknown };
	if (v.schema_version !== 1) return false;
	if (typeof v.repos !== "object" || v.repos === null) return false;
	for (const repo of Object.values(v.repos as Record<string, unknown>)) {
		if (typeof repo !== "object" || repo === null) return false;
		const tp = (repo as { trusted_paths?: unknown }).trusted_paths;
		if (!Array.isArray(tp)) return false;
		for (const p of tp) if (typeof p !== "string") return false;
	}
	return true;
}
