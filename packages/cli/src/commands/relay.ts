import { Command } from "commander";
import chalk from "chalk";
import { existsSync, readFileSync } from "node:fs";
import { connect } from "node:net";
import {
	RelayDaemon,
	pingRelay,
	readRelayDivergenceMarker,
	RELAY_SOCKET_PATH,
	RELAY_LOG_PATH,
	RELAY_PID_PATH,
	RELAY_PROTOCOL_VERSION,
	assessRelayHealth,
	relayHealthExitCode,
	DEFAULT_MAX_SILENCE_MS,
	type ChainStateResponse,
	type SealStatusResponse,
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
				if (existsSync(RELAY_PID_PATH)) {
					const pid = readFileSync(RELAY_PID_PATH, "utf-8").trim();
					console.log(`  PID:        ${chalk.dim(pid)}`);
				}

				if (!socketExists) {
					console.log(`  Status:     ${chalk.yellow("not installed")}`);
					return;
				}

				// Query daemon state via socket (avoids reading entire log)
				const chainState = await queryRelay<ChainStateResponse>("get_chain_state");
				const sealStatus = await queryRelay<SealStatusResponse>("seal_status");

				if (!chainState?.ok) {
					console.log(`  Status:     ${chalk.red("unreachable")}`);
					return;
				}

				console.log(`  Status:     ${chalk.green("running")}`);
				if (chainState.chain_tip) {
					console.log(`  Chain tip:  ${chalk.dim(chainState.chain_tip.slice(0, 30) + "...")}`);
				}

				console.log(`\n  Relay log:  ${chalk.dim(RELAY_LOG_PATH)}`);
				console.log(`  Events:     ${chalk.bold(String(chainState.event_count))}`);

				// Heartbeat freshness
				if (chainState.last_heartbeat) {
					const age = Date.now() - chainState.last_heartbeat;
					const ageStr = age < 60_000
						? `${Math.round(age / 1000)}s ago`
						: `${Math.round(age / 60_000)}m ago`;
					const ageColor = age < 60_000 ? chalk.green : age < 120_000 ? chalk.yellow : chalk.red;
					console.log(`  Last beat:  ${ageColor(ageStr)}`);
				}

				// Uptime
				const uptimeMs = chainState.uptime_ms;
				const uptimeH = Math.floor(uptimeMs / 3_600_000);
				const uptimeM = Math.floor((uptimeMs % 3_600_000) / 60_000);
				console.log(`  Uptime:     ${chalk.dim(`${uptimeH}h ${uptimeM}m`)}`);

				// Seal info
				if (sealStatus?.ok) {
					console.log(`\n  Seals:      ${chalk.bold(String(sealStatus.seals_total))}`);
					if (sealStatus.last_seal_at) {
						const sealAge = Date.now() - new Date(sealStatus.last_seal_at).getTime();
						const sealAgeStr = sealAge < 60_000
							? `${Math.round(sealAge / 1000)}s ago`
							: `${Math.round(sealAge / 60_000)}m ago`;
						console.log(`  Last seal:  ${chalk.dim(sealAgeStr)} (${sealStatus.last_seal_events} events)`);
					}
					console.log(`  Auto-seal:  ${sealStatus.auto_seal_enabled ? chalk.green("on") : chalk.yellow("off")} (every ${chainState.auto_seal_interval_minutes}m)`);
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
			.description(
				"Verify relay log integrity, daemon liveness and delivery health",
			)
			.option(
				"--max-silence <minutes>",
				"treat heartbeat silence longer than this as degraded",
				String(DEFAULT_MAX_SILENCE_MS / 60_000),
			)
			.option("--json", "emit the report as JSON")
			.action((opts) => {
				if (!existsSync(RELAY_LOG_PATH)) {
					// F4: no log is not health. The relay is either not installed
					// or has never received anything, and both deserve a non-zero
					// exit so a CI step or a cron check notices.
					if (opts.json) {
						console.log(
							JSON.stringify(
								{ status: "stale", reasons: ["no relay log found"] },
								null,
								2,
							),
						);
					} else {
						console.log(
							chalk.yellow(
								"No relay log found — relay not installed or no events received",
							),
						);
					}
					process.exitCode = 2;
					return;
				}

				const minutes = Number(opts.maxSilence);
				const maxSilenceMs =
					Number.isFinite(minutes) && minutes > 0
						? minutes * 60_000
						: DEFAULT_MAX_SILENCE_MS;

				const report = assessRelayHealth({
					logContent: readFileSync(RELAY_LOG_PATH, "utf-8"),
					divergence: readRelayDivergenceMarker(),
					maxSilenceMs,
				});

				if (opts.json) {
					console.log(JSON.stringify(report, null, 2));
					process.exitCode = relayHealthExitCode(report);
					return;
				}

				const verdict =
					report.status === "pass"
						? chalk.green("PASS")
						: report.status === "stale"
							? chalk.yellow("DEGRADED")
							: chalk.red("FAIL");

				console.log(chalk.bold("Relay Log Verification\n"));
				console.log(`  Events:     ${report.events}`);
				console.log(`  Heartbeats: ${report.heartbeats}`);
				console.log(
					`  Corrupt:    ${report.corrupt === 0 ? chalk.green("0") : chalk.red(String(report.corrupt))}`,
				);
				if (report.silenceMs !== null) {
					const mins = Math.round(report.silenceMs / 60_000);
					const silence =
						report.silenceMs < 60_000
							? `${Math.round(report.silenceMs / 1000)}s ago`
							: `${mins}m ago`;
					console.log(
						`  Last beat:  ${report.silenceMs > maxSilenceMs ? chalk.red(silence) : chalk.green(silence)}`,
					);
				}
				if (report.divergenceFailures > 0) {
					console.log(
						`  Delivery:   ${chalk.red(`${report.divergenceFailures} failed`)}`,
					);
				}
				console.log(`  Integrity:  ${verdict}`);

				if (report.reasons.length > 0) {
					console.log("");
					for (const reason of report.reasons) {
						console.log(chalk.yellow(`  ! ${reason}`));
					}
					console.log(
						chalk.dim(
							"\n  DEGRADED means the log may be incomplete, not that it was edited.",
						),
					);
					console.log(
						chalk.dim(
							"  Patchwork can prove the log was not altered. It cannot prove it is complete.",
						),
					);
				}

				process.exitCode = relayHealthExitCode(report);
			}),
	);

/** Query the relay daemon via socket. Returns null if unreachable. */
function queryRelay<T>(type: string): Promise<T | null> {
	return new Promise((resolve) => {
		if (!existsSync(RELAY_SOCKET_PATH)) {
			resolve(null);
			return;
		}

		const timer = setTimeout(() => {
			resolve(null);
		}, 2_000);

		const socket = connect(RELAY_SOCKET_PATH, () => {
			const msg = JSON.stringify({
				protocol_version: RELAY_PROTOCOL_VERSION,
				type,
				timestamp: new Date().toISOString(),
			}) + "\n";
			socket.write(msg);
		});

		socket.on("data", (chunk) => {
			clearTimeout(timer);
			try {
				resolve(JSON.parse(chunk.toString().trim()));
			} catch {
				resolve(null);
			}
			socket.destroy();
		});

		socket.on("error", () => {
			clearTimeout(timer);
			resolve(null);
		});
	});
}
