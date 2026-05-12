import { Command } from "commander";
import chalk from "chalk";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import YAML from "yaml";
import {
	DEFAULT_POLICY,
	PolicySchema,
	loadPolicyFromFile,
	policyToYaml,
	type Policy,
} from "@patchwork/core";

/**
 * `patchwork trust-repo-config <pattern>` — mark an in-repo path glob
 * as trusted so Read of files under that glob does NOT raise `prompt`
 * taint (v0.6.11 commit 9).
 *
 * Writes (or appends to) `.patchwork/policy.yml` in cwd. The system
 * policy at /Library/Patchwork/policy.yml still wins for everything
 * else — trusted_paths is the one knob a repo's own .patchwork/policy
 * can express without weakening enforcement, because untrusted is the
 * default and the taint engine's `FORCE_UNTRUSTED_PATTERNS` always
 * overrides (README/CHANGELOG/docs/node_modules/etc cannot be made
 * trusted via this command).
 *
 * Usage:
 *   patchwork trust-repo-config "src/**\/*.ts"      # narrow glob
 *   patchwork trust-repo-config --list              # show current trusted_paths
 *   patchwork trust-repo-config --remove "src/**"   # remove a pattern
 */
export const trustRepoConfigCommand = new Command("trust-repo-config")
	.description(
		"Mark an in-repo glob as trusted so Read does not raise prompt taint",
	)
	.argument("[pattern]", "Picomatch glob to add to trusted_paths")
	.option("--list", "List current trusted_paths and exit")
	.option("--remove", "Remove the given pattern from trusted_paths")
	.action(
		(
			pattern: string | undefined,
			opts: { list?: boolean; remove?: boolean },
		) => {
			const projectRoot = process.cwd();
			const policyDir = join(projectRoot, ".patchwork");
			const policyPath = join(policyDir, "policy.yml");

			let policy: Policy;
			if (existsSync(policyPath)) {
				try {
					policy = loadPolicyFromFile(policyPath);
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					console.error(
						chalk.red(
							`Could not parse ${policyPath}: ${msg}\n` +
								"Refusing to overwrite — please fix the file by hand.",
						),
					);
					process.exit(2);
				}
			} else {
				// Start with a project-empty policy that only adds the trusted_paths.
				// Don't auto-import the system policy — we'd silently shadow it.
				policy = PolicySchema.parse({
					name: "project-trust",
					version: "1",
					description:
						"Project-level trusted_paths overlay. Created by patchwork trust-repo-config.",
					max_risk: "critical",
				});
			}

			if (opts.list) {
				if (policy.trusted_paths.length === 0) {
					console.log(chalk.dim("No trusted_paths set."));
				} else {
					console.log(chalk.bold("trusted_paths:"));
					for (const p of policy.trusted_paths) {
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

			const current = new Set(policy.trusted_paths);
			if (opts.remove) {
				if (!current.has(pattern)) {
					console.error(
						chalk.yellow(
							`Pattern '${pattern}' is not in trusted_paths. Nothing to remove.`,
						),
					);
					return;
				}
				current.delete(pattern);
			} else {
				if (current.has(pattern)) {
					console.log(
						chalk.dim(`Pattern '${pattern}' is already trusted. No change.`),
					);
					return;
				}
				current.add(pattern);
			}

			const next: Policy = {
				...policy,
				trusted_paths: [...current],
			};

			if (!existsSync(policyDir)) {
				mkdirSync(policyDir, { recursive: true, mode: 0o755 });
			}
			writeFileSync(policyPath, policyToYaml(next), "utf-8");

			console.log(
				chalk.green("✓") +
					(opts.remove
						? ` Removed '${pattern}' from trusted_paths`
						: ` Trusted '${pattern}'`),
			);
			console.log(chalk.dim(`Updated: ${policyPath}`));
			console.log();
			console.log(
				chalk.dim(
					"FORCE_UNTRUSTED patterns (README*, docs/**, node_modules/**, etc.) " +
						"always win — those paths remain untrusted regardless of this list.",
				),
			);

			// Touch references to avoid unused-import warnings for older lints
			void DEFAULT_POLICY;
			void resolve;
			void readFileSync;
			void YAML;
			void dirname;
		},
	);
