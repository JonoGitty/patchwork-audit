import { Command } from "commander";
import chalk from "chalk";
import { writeFileSync } from "node:fs";
import { getReadStore } from "../store.js";
import { getSessionGitDiffs } from "../replay/git.js";
import { renderAllEvents, renderInteractive, buildSessionHeader } from "../replay/terminal.js";
import { renderHtmlReplay } from "../replay/html-renderer.js";

const RISK_ORDER = ["none", "low", "medium", "high", "critical"];

export const replayCommand = new Command("replay")
	.description("Replay an AI agent session step-by-step")
	.argument("<session-id>", "Session ID to replay")
	.option("--all", "Show all events at once (non-interactive)")
	.option("--html", "Output as HTML instead of terminal")
	.option("--speed <ms>", "Auto-play speed in milliseconds")
	.option("--risk <level>", "Only show events at or above this risk level")
	.option("--files-only", "Only show file change events")
	.option("--no-git", "Skip git diff integration")
	.option("-o, --output <file>", "Write HTML to file")
	.action(async (sessionId: string, opts) => {
		const store = getReadStore();
		let events = store.query({ sessionId });

		if (events.length === 0) {
			// Try partial match
			const all = store.readAll();
			events = all.filter(e => e.session_id.includes(sessionId));
		}

		if (events.length === 0) {
			console.error(chalk.red(`Session not found: ${sessionId}`));
			console.error(chalk.dim("Run 'patchwork sessions' to see available sessions."));
			process.exit(1);
		}

		// Sort chronologically
		events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

		// Apply filters
		if (opts.risk) {
			const minIdx = RISK_ORDER.indexOf(opts.risk);
			if (minIdx >= 0) {
				events = events.filter(e => RISK_ORDER.indexOf(e.risk.level) >= minIdx);
			}
		}

		if (opts.filesOnly) {
			events = events.filter(e => e.action.startsWith("file_"));
		}

		if (events.length === 0) {
			console.error(chalk.yellow("No events match the filters."));
			return;
		}

		// Git diff integration (best-effort)
		let gitDiffs = new Map();
		if (opts.git !== false) {
			try {
				gitDiffs = getSessionGitDiffs(events);
				if (gitDiffs.size > 0) {
					console.error(chalk.dim(`  Found git diffs for ${gitDiffs.size} file(s)`));
				}
			} catch {
				// Git not available or not a repo — continue without diffs
			}
		}

		// HTML output
		if (opts.html || (opts.output && opts.output.endsWith(".html"))) {
			const html = renderHtmlReplay(events, gitDiffs);
			if (opts.output) {
				writeFileSync(opts.output, html, "utf-8");
				console.error(chalk.green(`Replay written to ${opts.output}`));
				console.error(chalk.dim(`Session: ${events[0].session_id} | ${events.length} events`));
			} else {
				process.stdout.write(html);
			}
			return;
		}

		// Terminal output
		const header = buildSessionHeader(events);

		if (opts.all || opts.speed) {
			renderAllEvents(events, gitDiffs, header);
		} else {
			await renderInteractive(events, gitDiffs, header, {
				speed: opts.speed ? parseInt(opts.speed, 10) : undefined,
				riskFilter: opts.risk,
				filesOnly: opts.filesOnly,
			});
		}
	});
