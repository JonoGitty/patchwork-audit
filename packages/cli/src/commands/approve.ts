import { Command } from "commander";
import chalk from "chalk";
import {
	listPendingRequests,
	readPendingRequest,
	writeApprovedToken,
	DEFAULT_APPROVAL_TTL_MS,
} from "@patchwork/agents";
import { requireHumanContext } from "../lib/require-human-context.js";

/**
 * `patchwork approve` — out-of-band approval for actions the PreToolUse
 * enforcement layer flagged as `approval_required` (v0.6.11 commit 9).
 *
 * The PreToolUse adapter writes a pending request to
 * `~/.patchwork/approvals/<id>.pending.json` when a sink/keystone match
 * lands at approval_required. The denial message names the request_id.
 * The user runs `patchwork approve <id>` here; we write the matching
 * approved-token sibling, which the adapter consumes on the next
 * matching retry.
 *
 * No flags: `patchwork approve` with no argument lists pending
 * requests for review.
 */
export const approveCommand = new Command("approve")
	.description("Authorize a pending PreToolUse approval_required action")
	.argument("[request_id]", "ID of the pending approval (omit to list)")
	.option(
		"--ttl <minutes>",
		"How long the approval remains valid (default 5)",
		"5",
	)
	.action((requestId: string | undefined, opts: { ttl: string }) => {
		requireHumanContext("approve");
		if (!requestId) {
			const pending = listPendingRequests();
			if (pending.length === 0) {
				console.log(chalk.dim("No pending approvals."));
				return;
			}
			console.log(chalk.bold(`${pending.length} pending approval(s):`));
			for (const p of pending) {
				console.log();
				console.log(
					`  ${chalk.cyan(p.request_id)}  ${chalk.dim(p.created_at)}`,
				);
				console.log(`    Tool: ${chalk.bold(p.tool_name)}`);
				console.log(`    Target: ${p.target_summary}`);
				console.log(`    Reason: ${chalk.yellow(p.reason)}`);
				console.log(`    Rule:   ${chalk.dim(p.rule)}`);
			}
			console.log();
			console.log(
				chalk.dim(`Run: patchwork approve <request_id> to authorize.`),
			);
			return;
		}

		const pending = readPendingRequest(requestId);
		if (!pending) {
			console.error(
				chalk.red(
					`No pending request '${requestId}'. List pending requests with 'patchwork approve' (no args).`,
				),
			);
			process.exit(2);
		}

		const ttlMinutes = Number.parseInt(opts.ttl, 10);
		if (!Number.isFinite(ttlMinutes) || ttlMinutes < 1) {
			console.error(chalk.red(`Invalid --ttl ${opts.ttl}: must be >= 1`));
			process.exit(2);
		}
		const ttlMs = ttlMinutes * 60 * 1000;

		const tok = writeApprovedToken(pending, ttlMs);
		console.log(chalk.green("✓") + chalk.bold(" Approved"));
		console.log(`  Tool:       ${pending.tool_name}`);
		console.log(`  Target:     ${pending.target_summary}`);
		console.log(`  Expires in: ${ttlMinutes} min`);
		console.log(
			chalk.dim(
				`  Token will be consumed (single-use) on the agent's next matching retry.`,
			),
		);
		// Silence ttl-noop reference for older Node lint configs
		void DEFAULT_APPROVAL_TTL_MS;
		void tok;
	});
