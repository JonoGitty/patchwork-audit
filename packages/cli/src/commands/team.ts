/**
 * Team Mode CLI commands.
 *
 * patchwork team enroll <server-url>   — connect this machine to a team
 * patchwork team status                — show sync status and team info
 * patchwork team server start          — start the team server
 * patchwork team unenroll              — disconnect from team
 */

import { Command } from "commander";
import chalk from "chalk";
import { existsSync, unlinkSync } from "node:fs";
import { createInterface } from "node:readline";

export const teamCommand = new Command("team")
	.description("Team Mode — sync events to a team server")
	.addCommand(
		new Command("enroll")
			.description("Enroll this machine in a team")
			.argument("<server-url>", "Team server URL (e.g. http://localhost:3001)")
			.option("--token <token>", "Enrollment token")
			.option("--name <name>", "Developer name")
			.action(async (serverUrl: string, opts: { token?: string; name?: string }) => {
				const { enrollMachine, loadTeamConfig, getMachineName } = await import("@patchwork/team");

				// Check if already enrolled
				const existing = loadTeamConfig();
				if (existing) {
					console.log(chalk.yellow(`Already enrolled in team "${existing.team_name}"`));
					console.log(chalk.dim(`Server: ${existing.server_url}`));
					console.log(chalk.dim(`Machine: ${existing.machine_id}`));
					console.log(chalk.dim("Run 'patchwork team unenroll' first to change teams."));
					return;
				}

				// Get token interactively if not provided
				let token = opts.token;
				if (!token) {
					const rl = createInterface({ input: process.stdin, output: process.stdout });
					token = await new Promise<string>((resolve) => {
						rl.question("Enrollment token: ", (answer) => {
							rl.close();
							resolve(answer.trim());
						});
					});
				}

				if (!token) {
					console.error(chalk.red("Enrollment token is required."));
					process.exitCode = 1;
					return;
				}

				const name = opts.name ?? getMachineName();

				try {
					console.log(chalk.dim(`Enrolling with ${serverUrl}...`));
					const config = await enrollMachine(serverUrl, token, name);

					console.log(chalk.green(`\n  Enrolled in team "${config.team_name}"\n`));
					console.log(`  Machine ID:  ${chalk.dim(config.machine_id)}`);
					console.log(`  Server:      ${chalk.dim(config.server_url)}`);
					console.log(`  Developer:   ${chalk.dim(config.developer_name)}`);
					console.log("");
					console.log(chalk.dim("  Events will sync automatically every 30 seconds."));
					console.log(chalk.dim("  Check status: patchwork team status"));
				} catch (err: unknown) {
					const msg = err instanceof Error ? err.message : String(err);
					console.error(chalk.red(`Enrollment failed: ${msg}`));
					process.exitCode = 1;
				}
			}),
	)
	.addCommand(
		new Command("status")
			.description("Show team sync status")
			.action(async () => {
				const { loadTeamConfig, readCursor, SYNC_CURSOR_PATH } = await import("@patchwork/team");
				const { pingRelay } = await import("@patchwork/core");

				const config = loadTeamConfig();
				if (!config) {
					console.log(chalk.yellow("Not enrolled in a team."));
					console.log(chalk.dim("Run: patchwork team enroll <server-url>"));
					return;
				}

				console.log(chalk.bold("Team Status\n"));
				console.log(`  Team:         ${chalk.bold(config.team_name)}`);
				console.log(`  Server:       ${chalk.dim(config.server_url)}`);
				console.log(`  Machine:      ${chalk.dim(config.machine_id)}`);
				console.log(`  Developer:    ${chalk.dim(config.developer_name)}`);
				console.log(`  Enrolled:     ${chalk.dim(config.enrolled_at)}`);

				// Sync cursor
				const cursor = readCursor();
				console.log("");
				console.log(`  Sync offset:  ${chalk.dim(String(cursor.last_synced_offset))} bytes`);
				if (cursor.last_synced_at) {
					const age = Date.now() - new Date(cursor.last_synced_at).getTime();
					const ageStr = age < 60_000
						? `${Math.round(age / 1000)}s ago`
						: `${Math.round(age / 60_000)}m ago`;
					const color = age < 60_000 ? chalk.green : age < 300_000 ? chalk.yellow : chalk.red;
					console.log(`  Last sync:    ${color(ageStr)}`);
				} else {
					console.log(`  Last sync:    ${chalk.dim("never")}`);
				}

				if (cursor.consecutive_failures > 0) {
					console.log(chalk.yellow(`  Failures:     ${cursor.consecutive_failures} consecutive`));
				}

				// Relay status
				const relay = await pingRelay();
				console.log("");
				console.log(`  Relay:        ${relay?.ok ? chalk.green("connected") : chalk.red("not reachable")}`);

				// Server health check
				try {
					const resp = await fetch(`${config.server_url}/api/v1/health`, {
						signal: AbortSignal.timeout(5_000),
					});
					const body = await resp.json() as any;
					console.log(`  Server:       ${body.ok ? chalk.green("online") : chalk.red("unhealthy")}`);
				} catch {
					console.log(`  Server:       ${chalk.red("offline")}`);
				}
			}),
	)
	.addCommand(
		new Command("server")
			.description("Team server management")
			.addCommand(
				new Command("start")
					.description("Start the team server")
					.option("--port <port>", "Server port", "3001")
					.option("--db <path>", "SQLite database path")
					.option("--host <host>", "Bind host", "0.0.0.0")
					.action(async (opts: { port: string; db?: string; host: string }) => {
						const { startTeamServer } = await import("@patchwork/team");

						const port = parseInt(opts.port, 10);
						if (Number.isNaN(port) || port < 0 || port > 65535) {
							console.error(chalk.red(`Invalid port: ${opts.port}`));
							process.exitCode = 1;
							return;
						}

						startTeamServer({
							port,
							dbPath: opts.db,
							host: opts.host,
						});

						// Keep running
						await new Promise(() => {});
					}),
			),
	)
	.addCommand(
		new Command("unenroll")
			.description("Remove this machine from the team")
			.action(async () => {
				const { loadTeamConfig, TEAM_CONFIG_PATH, SYNC_CURSOR_PATH } = await import("@patchwork/team");

				const config = loadTeamConfig();
				if (!config) {
					console.log(chalk.dim("Not enrolled in a team."));
					return;
				}

				const rl = createInterface({ input: process.stdin, output: process.stdout });
				const answer = await new Promise<string>((resolve) => {
					rl.question(
						`Remove this machine from team "${config.team_name}"? [y/N]: `,
						(a) => { rl.close(); resolve(a.trim()); },
					);
				});

				if (!answer.toLowerCase().startsWith("y")) {
					console.log(chalk.dim("Cancelled."));
					return;
				}

				// Remove config and cursor
				try {
					if (existsSync(TEAM_CONFIG_PATH)) unlinkSync(TEAM_CONFIG_PATH);
					if (existsSync(SYNC_CURSOR_PATH)) unlinkSync(SYNC_CURSOR_PATH);
					console.log(chalk.green(`Unenrolled from team "${config.team_name}".`));
				} catch (err: unknown) {
					const msg = err instanceof Error ? err.message : String(err);
					console.error(chalk.red(`Unenroll failed: ${msg}`));
					process.exitCode = 1;
				}
			}),
	);
