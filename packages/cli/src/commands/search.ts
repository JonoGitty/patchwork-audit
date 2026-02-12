import { Command } from "commander";
import chalk from "chalk";
import { formatEvent } from "../output/formatter.js";
import { getSearchStore } from "../store.js";

export const searchCommand = new Command("search")
	.description("Full-text search across audit events (requires SQLite)")
	.argument("<query>", "Search query (matches paths, commands, tool names, actions)")
	.option("-n, --limit <n>", "Maximum results", "25")
	.option("--session <id>", "Filter by session ID")
	.option("--json", "Output as JSON")
	.action((query: string, opts) => {
		const store = getSearchStore();

		if (!store) {
			console.log(chalk.yellow("Search requires the SQLite database."));
			console.log(chalk.dim("Run 'patchwork sync db' to build it from your events."));
			return;
		}

		let results = store.search(query, parseInt(opts.limit, 10));

		if (opts.session) {
			results = results.filter((e) => e.session_id === opts.session);
		}

		if (results.length === 0) {
			console.log(chalk.dim(`No results for "${query}"`));
			return;
		}

		if (opts.json) {
			console.log(JSON.stringify(results, null, 2));
			return;
		}

		console.log(chalk.bold(`Search: "${query}"\n`));

		for (const event of results) {
			console.log(formatEvent(event));
		}

		console.log(chalk.dim(`\n${results.length} result(s)`));
	});
