import { Command } from "commander";
import chalk from "chalk";
import { existsSync, readFileSync } from "node:fs";
import {
	RelayDaemon,
	pingRelay,
	readRelayDivergenceMarker,
	RELAY_SOCKET_PATH,
	RELAY_LOG_PATH,
	RELAY_PID_PATH,
} from "@patchwork/core";

export const relayCommand = new Command("relay")
	.description("Manage the root-owned audit relay daemon (layer 2)")
	.addCommand(
		new Command("start")
			.description("Start the relay daemon (requires root)")
			.option("--socket <path>", "Socket path", RELAY_SOCKET_PATH)
			.option("--log <path>", "Relay log path", RELAY_LOG_PATH)
			.action(async (opts) => {
				if (process.getuid?.() !== 0) {
					console.error(chalk.red("Error: relay daemon must run as root (use sudo)"));
					process.exit(1);
				}

				console.log(chalk.bold("Starting Patchwork relay daemon..."));
				const daemon = new RelayDaemon({
					socketPath: opts.socket,
					logPath: opts.log,
				});
				await daemon.start();
				console.log(chalk.green(`Relay listening on ${opts.socket}`));
				console.log(chalk.dim(`Events → ${opts.log}`));
				console.log(chalk.dim(`PID: ${process.pid}`));

				// Keep process running
				await new Promise(() => {});
			}),
	)
	.addCommand(
		new Command("status")
			.description("Check relay daemon status and health")
			.action(async () => {
				console.log(chalk.bold("Relay Status\n"));

				// Check socket exists
				const socketExists = existsSync(RELAY_SOCKET_PATH);
				console.log(
					`  Socket:     ${socketExists ? chalk.green(RELAY_SOCKET_PATH) : chalk.red("not found")}`,
				);

				// Check PID file
				let pid: string | null = null;
				if (existsSync(RELAY_PID_PATH)) {
					pid = readFileSync(RELAY_PID_PATH, "utf-8").trim();
					console.log(`  PID:        ${chalk.dim(pid)}`);
				}

				// Ping the daemon
				if (socketExists) {
					const resp = await pingRelay();
					if (resp?.ok) {
						console.log(`  Status:     ${chalk.green("running")}`);
						if (resp.relay_hash) {
							console.log(`  Chain tip:  ${chalk.dim(resp.relay_hash.slice(0, 30) + "...")}`);
						}
					} else {
						console.log(`  Status:     ${chalk.red("unreachable")}`);
					}
				} else {
					console.log(`  Status:     ${chalk.yellow("not installed")}`);
				}

				// Check relay log
				if (existsSync(RELAY_LOG_PATH)) {
					const content = readFileSync(RELAY_LOG_PATH, "utf-8");
					const lines = content.split("\n").filter((l) => l.trim());
					let eventCount = 0;
					let heartbeatCount = 0;
					let lastHeartbeat: string | null = null;

					for (const line of lines) {
						try {
							const parsed = JSON.parse(line);
							if (parsed.type === "heartbeat") {
								heartbeatCount++;
								lastHeartbeat = parsed.timestamp;
							} else {
								eventCount++;
							}
						} catch {
							// Skip corrupt lines
						}
					}

					console.log(`\n  Relay log:  ${chalk.dim(RELAY_LOG_PATH)}`);
					console.log(`  Events:     ${chalk.bold(String(eventCount))}`);
					console.log(`  Heartbeats: ${chalk.dim(String(heartbeatCount))}`);
					if (lastHeartbeat) {
						const age = Date.now() - new Date(lastHeartbeat).getTime();
						const ageStr = age < 60_000
							? `${Math.round(age / 1000)}s ago`
							: `${Math.round(age / 60_000)}m ago`;
						const ageColor = age < 60_000 ? chalk.green : age < 120_000 ? chalk.yellow : chalk.red;
						console.log(`  Last beat:  ${ageColor(ageStr)}`);
					}
				}

				// Check divergence
				const divergence = readRelayDivergenceMarker();
				if (divergence) {
					console.log(chalk.yellow(`\n  Divergence: ${divergence.failure_count} failures`));
					console.log(chalk.dim(`  Last error: ${divergence.last_error}`));
					console.log(chalk.dim(`  Since:      ${divergence.first_failure_at}`));
				}
			}),
	)
	.addCommand(
		new Command("verify")
			.description("Verify relay log integrity against user-side events")
			.action(() => {
				if (!existsSync(RELAY_LOG_PATH)) {
					console.log(chalk.yellow("No relay log found — relay not installed or no events received"));
					return;
				}

				const content = readFileSync(RELAY_LOG_PATH, "utf-8");
				const lines = content.split("\n").filter((l) => l.trim());
				let events = 0;
				let heartbeats = 0;
				let corrupt = 0;

				for (const line of lines) {
					try {
						const parsed = JSON.parse(line);
						if (parsed.type === "heartbeat") {
							heartbeats++;
						} else {
							events++;
						}
					} catch {
						corrupt++;
					}
				}

				console.log(chalk.bold("Relay Log Verification\n"));
				console.log(`  Events:     ${events}`);
				console.log(`  Heartbeats: ${heartbeats}`);
				console.log(`  Corrupt:    ${corrupt === 0 ? chalk.green("0") : chalk.red(String(corrupt))}`);
				console.log(
					`  Integrity:  ${corrupt === 0 ? chalk.green("PASS") : chalk.red("FAIL")}`,
				);
			}),
	);
