import { Command } from "commander";
import chalk from "chalk";
import { writeFileSync, existsSync } from "node:fs";
import type { AuditEvent } from "@patchwork/core";
import { loadActivePolicy, verifyChain, JsonlStore } from "@patchwork/core";
import { getReadStore, EVENTS_PATH, SEALS_PATH, ATTESTATION_PATH } from "../store.js";
import { computeStats, type StatsResult } from "./stats.js";
import { FRAMEWORKS, FRAMEWORK_IDS, evaluateFramework } from "../compliance/frameworks.js";
import { renderHtmlReport } from "../compliance/html-renderer.js";
import type { ReportData, ComplianceReport, FrameworkReport, ControlStatus } from "../compliance/types.js";

const SENSITIVE_PATTERNS = [".env", ".key", ".pem", "id_rsa", ".aws/", ".ssh/", "secret", "password", "token", "credential"];

export const reportCommand = new Command("report")
	.description("Generate a compliance report mapping audit data to framework controls")
	.option("--framework <framework>", "Framework: soc2, iso27001, eu-ai-act, all", "all")
	.option("--since <time>", "Report period start (ISO date or relative)")
	.option("--session <id>", "Report on a specific session")
	.option("--format <format>", "Output format: html, json", "html")
	.option("-o, --output <file>", "Write to file instead of stdout")
	.action((opts) => {
		const store = getReadStore();

		// Query events
		// Validate framework early (before heavy computation)
		const frameworkIds = opts.framework === "all"
			? FRAMEWORK_IDS
			: [opts.framework];

		for (const fwId of frameworkIds) {
			if (!FRAMEWORKS[fwId]) {
				console.error(chalk.red(`Unknown framework: ${fwId}`));
				console.error(chalk.dim(`Available: ${FRAMEWORK_IDS.join(", ")}, all`));
				return;
			}
		}

		let events: AuditEvent[];
		if (opts.session) {
			events = store.query({ sessionId: opts.session });
		} else if (opts.since) {
			const sinceDate = new Date(opts.since);
			if (isNaN(sinceDate.getTime())) {
				console.error(chalk.red(`Invalid date: ${opts.since}`));
				return;
			}
			events = store.query({ since: sinceDate });
		} else {
			events = store.readAll();
		}

		if (events.length === 0) {
			console.error(chalk.yellow("No events found for the reporting period."));
			console.error(chalk.dim("Run some Claude Code sessions first, then try again."));
			return;
		}

		// Determine period (safe for >65K events — no spread operator)
		let minTs = Infinity;
		let maxTs = -Infinity;
		for (const e of events) {
			const t = new Date(e.timestamp).getTime();
			if (t < minTs) minTs = t;
			if (t > maxTs) maxTs = t;
		}
		const periodStart = new Date(minTs);
		const periodEnd = new Date(maxTs);

		// Compute stats
		const stats = computeStats(events);

		// Group sessions
		const sessionMap = new Map<string, AuditEvent[]>();
		for (const e of events) {
			const list = sessionMap.get(e.session_id) || [];
			list.push(e);
			sessionMap.set(e.session_id, list);
		}

		const sessions = Array.from(sessionMap.entries()).map(([id, evts]) => ({
			id,
			agent: evts[0]?.agent || "unknown",
			project: evts[0]?.project?.name || "unknown",
			started: evts[0]?.timestamp || "",
			ended: evts[evts.length - 1]?.timestamp || "",
			durationMs: evts[0] && evts[evts.length - 1]
				? new Date(evts[evts.length - 1].timestamp).getTime() - new Date(evts[0].timestamp).getTime()
				: 0,
			count: evts.length,
			writes: evts.filter(e => ["file_write", "file_edit", "file_create"].includes(e.action)).length,
			commands: evts.filter(e => e.action === "command_execute").length,
			highRisk: evts.filter(e => e.risk.level === "high" || e.risk.level === "critical").length,
			denials: evts.filter(e => e.status === "denied").length,
		})).sort((a, b) => (b.started || "").localeCompare(a.started || ""));

		// Integrity verification
		let chainValid = false;
		let chainedEvents = 0;
		let legacyEvents = 0;
		let invalidEvents = 0;
		try {
			const chainResult = verifyChain(events);
			chainValid = chainResult.is_valid;
			chainedEvents = chainResult.chained_events;
			legacyEvents = chainResult.legacy_events;
			invalidEvents = chainResult.invalid_schema_events;
		} catch { /* verification failed */ }

		const sealed = existsSync(SEALS_PATH);
		const attested = existsSync(ATTESTATION_PATH);

		// Load policy
		let policy = null;
		let policySource = "none";
		try {
			const result = loadActivePolicy();
			policy = result.policy;
			policySource = result.source;
		} catch { /* no policy */ }

		// Categorize events
		const denials = events.filter(e => e.status === "denied");
		const highRiskEvents = events.filter(e => e.risk.level === "critical" || e.risk.level === "high");
		const sensitiveFileEvents = events.filter(e =>
			e.target?.path && SENSITIVE_PATTERNS.some(p => (e.target?.path || "").toLowerCase().includes(p))
		);
		const commandEvents = events.filter(e => e.action === "command_execute");
		const fileEvents = events.filter(e => e.action.startsWith("file_"));
		const networkEvents = events.filter(e => ["web_fetch", "web_search"].includes(e.action));
		const mcpEvents = events.filter(e => e.action === "mcp_tool_call");

		const reportData: ReportData = {
			events,
			periodStart,
			periodEnd,
			stats: { ...stats, totalSessions: sessions.length },
			sessions,
			integrity: { chainValid, chainedEvents, legacyEvents, invalidEvents, sealed, attested },
			policy,
			policySource,
			denials,
			highRiskEvents,
			sensitiveFileEvents,
			commandEvents,
			fileEvents,
			networkEvents,
			mcpEvents,
		};

		// Evaluate frameworks (already validated above)
		const frameworkReports: FrameworkReport[] = [];
		for (const fwId of frameworkIds) {
			frameworkReports.push(evaluateFramework(FRAMEWORKS[fwId], reportData));
		}

		// Overall grade
		const allResults = frameworkReports.flatMap(fw => fw.results);
		const hasFails = allResults.some(r => r.result.status === "fail");
		const hasPartials = allResults.some(r => r.result.status === "partial");
		const hasPasses = allResults.some(r => r.result.status === "pass");
		const overallGrade: ControlStatus = hasFails ? "fail" : hasPartials ? "partial" : hasPasses ? "pass" : "na";

		const report: ComplianceReport = {
			generatedAt: new Date().toISOString(),
			toolVersion: "0.2.0",
			periodStart: periodStart.toISOString(),
			periodEnd: periodEnd.toISOString(),
			data: reportData,
			frameworks: frameworkReports,
			overallGrade,
		};

		// Render
		let output: string;
		if (opts.format === "json") {
			// Strip the evaluate functions from JSON output
			const jsonSafe = {
				...report,
				frameworks: report.frameworks.map(fw => ({
					framework: { id: fw.framework.id, name: fw.framework.name, version: fw.framework.version },
					results: fw.results.map(r => ({
						control: { id: r.control.id, name: r.control.name },
						result: r.result,
					})),
					summary: fw.summary,
				})),
				data: {
					stats: report.data.stats,
					integrity: report.data.integrity,
					policySource: report.data.policySource,
					sessionCount: report.data.sessions.length,
					denialCount: report.data.denials.length,
					highRiskCount: report.data.highRiskEvents.length,
				},
			};
			output = JSON.stringify(jsonSafe, null, 2);
		} else {
			output = renderHtmlReport(report);
		}

		// Output
		if (opts.output) {
			try {
				writeFileSync(opts.output, output, "utf-8");
			} catch (err: unknown) {
				console.error(chalk.red(`Failed to write report: ${err instanceof Error ? err.message : String(err)}`));
				process.exitCode = 1;
				return;
			}
			console.error(chalk.green(`Compliance report written to ${opts.output}`));
			console.error(chalk.dim(`Framework(s): ${frameworkIds.join(", ")}`));
			console.error(chalk.dim(`Events: ${events.length}, Sessions: ${sessions.length}`));
			console.error(chalk.dim(`Overall grade: ${gradeText(overallGrade)}`));
		} else {
			process.stdout.write(output);
		}
	});

function gradeText(grade: ControlStatus): string {
	switch (grade) {
		case "pass": return chalk.green("COMPLIANT");
		case "fail": return chalk.red("NON-COMPLIANT");
		case "partial": return chalk.yellow("PARTIALLY COMPLIANT");
		case "na": return chalk.dim("INSUFFICIENT DATA");
	}
}
