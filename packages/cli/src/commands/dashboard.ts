import { Command } from "commander";

export const dashboardCommand = new Command("dashboard")
	.alias("web")
	.description("Launch the Patchwork web dashboard")
	.option("-p, --port <port>", "Port number", "3000")
	.option("--no-open", "Don't open browser automatically")
	.action(async (opts) => {
		const { startDashboard } = await import("@patchwork/web");
		startDashboard({
			port: parseInt(opts.port, 10),
			open: opts.open,
		});
	});
