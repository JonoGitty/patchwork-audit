import { Command } from "commander";
import chalk from "chalk";
import { resolve } from "node:path";
import {
	getTrustFilePath,
	loadTrustStore,
	saveTrustStore,
} from "@patchwork/agents";
import { requireHumanContext } from "../lib/require-human-context.js";

/**
 * `patchwork trust-repo-config <pattern>` — mark an in-repo glob as
 * trusted so Read of files under that glob does NOT raise `prompt`
 * taint (v0.6.11 commit 9, R2-003 fix).
 *
 * **Trust storage is OUT of the repo.** R2 audit (GPT-5.5) flagged
 * that reading `<cwd>/.patchwork/policy.yml` for trust decisions lets
 * a hostile repository commit its own trust config (e.g.
 * `trusted_paths: ['**']`) and silence taint entirely. This
 * implementation stores trust decisions at `~/.patchwork/trusted-repos.yml`
 * keyed by the repo's canonical absolute path. A repo cannot opt itself
 * into trust by anything it commits — only the user, at an interactive
 * terminal, can.
 *
 * `FORCE_UNTRUSTED_PATTERNS` from the taint engine ALWAYS wins —
 * README/CHANGELOG/docs/examples/node_modules/vendor/dist/build cannot
 * be marked trusted, because those are the canonical vectors for
 * hostile prose to arrive.
 *
 * Usage:
 *   patchwork trust-repo-config "src/**\/*.ts"
 *   patchwork trust-repo-config --list
 *   patchwork trust-repo-config --remove "src/**"
 *   patchwork trust-repo-config --repo /abs/path "src/**"
 */
export const trustRepoConfigCommand = new Command("trust-repo-config")
	.description(
		"Mark an in-repo glob as trusted so Read does not raise prompt taint",
	)
	.argument("[pattern]", "Picomatch glob to add to trusted_paths")
	.option("--list", "List current trusted_paths and exit")
	.option("--remove", "Remove the given pattern from trusted_paths")
	.option(
		"--repo <abs_path>",
		"Repo to update (default: current working directory)",
	)
	.action(
		(
			pattern: string | undefined,
			opts: { list?: boolean; remove?: boolean; repo?: string },
		) => {
			requireHumanContext("trust-repo-config");
			const repoRoot = resolve(opts.repo ?? process.cwd());
			const trustFilePath = getTrustFilePath();

			let store = loadTrustStore(trustFilePath);

			if (opts.list) {
				const entries = store.repos[repoRoot]?.trusted_paths ?? [];
				if (entries.length === 0) {
					console.log(chalk.dim(`No trusted_paths set for ${repoRoot}`));
				} else {
					console.log(chalk.bold(`trusted_paths for ${repoRoot}:`));
					for (const p of entries) {
						console.log(`  ${chalk.green("✓")} ${p}`);
					}
				}
				return;
			}

			if (!pattern) {
				console.error(
					chalk.red(
						"Missing pattern. Usage: patchwork trust-repo-config <glob> [--remove]\n" +
							"        patchwork trust-repo-config --list",
					),
				);
				process.exit(2);
			}

			const current = new Set(store.repos[repoRoot]?.trusted_paths ?? []);
			if (opts.remove) {
				if (!current.has(pattern)) {
					console.error(
						chalk.yellow(
							`Pattern '${pattern}' is not in trusted_paths for ${repoRoot}. Nothing to remove.`,
						),
					);
					return;
				}
				current.delete(pattern);
			} else {
				if (current.has(pattern)) {
					console.log(
						chalk.dim(
							`Pattern '${pattern}' is already trusted for ${repoRoot}. No change.`,
						),
					);
					return;
				}
				current.add(pattern);
			}

			store = {
				...store,
				repos: {
					...store.repos,
					[repoRoot]: { trusted_paths: [...current] },
				},
			};

			saveTrustStore(trustFilePath, store);

			console.log(
				chalk.green("✓") +
					(opts.remove
						? ` Removed '${pattern}' from trusted_paths for ${repoRoot}`
						: ` Trusted '${pattern}' for ${repoRoot}`),
			);
			console.log(chalk.dim(`Updated: ${trustFilePath}`));
			console.log();
			console.log(
				chalk.dim(
					"FORCE_UNTRUSTED patterns (README*, docs/**, node_modules/**, etc.) " +
						"always win — those paths remain untrusted regardless of this list.",
				),
			);
		},
	);

