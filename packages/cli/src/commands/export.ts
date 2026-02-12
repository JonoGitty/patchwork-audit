import { Command } from "commander";
import chalk from "chalk";
import { writeFileSync } from "node:fs";
import type { AuditEvent } from "@patchwork/core";
import { getReadStore } from "../store.js";

export const exportCommand = new Command("export")
	.description("Export audit events in various formats")
	.option("--format <format>", "Output format: json, csv, sarif", "json")
	.option("--session <id>", "Filter by session ID")
	.option("--since <time>", "Export events since")
	.option("--risk <level>", "Minimum risk level")
	.option("-o, --output <file>", "Write to file instead of stdout")
	.action((opts) => {
		const store = getReadStore();
		let events = store.query({
			sessionId: opts.session,
			minRisk: opts.risk,
			since: opts.since ? new Date(opts.since) : undefined,
		});

		if (events.length === 0) {
			console.error(chalk.dim("No events found."));
			return;
		}

		let output: string;
		switch (opts.format) {
			case "csv":
				output = toCSV(events);
				break;
			case "sarif":
				output = toSARIF(events);
				break;
			case "json":
			default:
				output = JSON.stringify(events, null, 2);
				break;
		}

		if (opts.output) {
			writeFileSync(opts.output, output, "utf-8");
			console.error(chalk.green(`Exported ${events.length} events to ${opts.output}`));
		} else {
			console.log(output);
		}
	});

function toCSV(events: AuditEvent[]): string {
	const headers = [
		"id",
		"timestamp",
		"session_id",
		"agent",
		"action",
		"status",
		"risk_level",
		"risk_flags",
		"target_type",
		"target_path",
		"target_command",
		"project_name",
	];

	const rows = events.map((e) => [
		e.id,
		e.timestamp,
		e.session_id,
		e.agent,
		e.action,
		e.status,
		e.risk.level,
		e.risk.flags.join(";"),
		e.target?.type || "",
		e.target?.path || e.target?.abs_path || "",
		e.target?.command || "",
		e.project?.name || "",
	]);

	const escape = (v: string) => {
		if (v.includes(",") || v.includes('"') || v.includes("\n")) {
			return `"${v.replace(/"/g, '""')}"`;
		}
		return v;
	};

	return [
		headers.join(","),
		...rows.map((row) => row.map(escape).join(",")),
	].join("\n");
}

function toSARIF(events: AuditEvent[]): string {
	// SARIF v2.1.0 — Static Analysis Results Interchange Format
	// Useful for importing into GitHub Code Scanning, Snyk, etc.
	const riskEvents = events.filter((e) =>
		["medium", "high", "critical"].includes(e.risk.level),
	);

	const results = riskEvents.map((e) => ({
		ruleId: `patchwork/${e.action}`,
		level: sarifLevel(e.risk.level),
		message: {
			text: `${e.action} on ${e.target?.path || e.target?.command || "unknown"} (risk: ${e.risk.level})`,
		},
		locations: e.target?.path
			? [
					{
						physicalLocation: {
							artifactLocation: {
								uri: e.target.path,
							},
						},
					},
				]
			: [],
		properties: {
			patchwork_event_id: e.id,
			session_id: e.session_id,
			agent: e.agent,
			risk_flags: e.risk.flags,
			timestamp: e.timestamp,
		},
	}));

	const sarif = {
		$schema: "https://json.schemastore.org/sarif-2.1.0.json",
		version: "2.1.0",
		runs: [
			{
				tool: {
					driver: {
						name: "Patchwork",
						version: "0.1.0",
						informationUri: "https://patchwork.dev",
						rules: getUniqueRules(riskEvents),
					},
				},
				results,
			},
		],
	};

	return JSON.stringify(sarif, null, 2);
}

function sarifLevel(riskLevel: string): string {
	switch (riskLevel) {
		case "critical":
			return "error";
		case "high":
			return "error";
		case "medium":
			return "warning";
		default:
			return "note";
	}
}

function getUniqueRules(events: AuditEvent[]) {
	const seen = new Set<string>();
	const rules: Array<{
		id: string;
		shortDescription: { text: string };
		defaultConfiguration: { level: string };
	}> = [];

	for (const e of events) {
		const ruleId = `patchwork/${e.action}`;
		if (seen.has(ruleId)) continue;
		seen.add(ruleId);
		rules.push({
			id: ruleId,
			shortDescription: { text: `AI agent action: ${e.action}` },
			defaultConfiguration: { level: sarifLevel(e.risk.level) },
		});
	}

	return rules;
}
