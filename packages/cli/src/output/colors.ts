import chalk from "chalk";

export function riskColor(level: string): typeof chalk {
	switch (level) {
		case "critical":
			return chalk.bgRed.white;
		case "high":
			return chalk.red;
		case "medium":
			return chalk.yellow;
		case "low":
			return chalk.dim;
		case "none":
		default:
			return chalk.dim;
	}
}

export function riskIcon(level: string): string {
	switch (level) {
		case "critical":
			return chalk.bgRed.white(" CRITICAL ");
		case "high":
			return chalk.red("\u25C9 HIGH");
		case "medium":
			return chalk.yellow("\u25D1");
		case "low":
			return chalk.dim("\u25D0");
		case "none":
		default:
			return chalk.dim("\u25CB");
	}
}
