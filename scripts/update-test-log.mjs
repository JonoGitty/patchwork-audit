#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const LOG_PATH = join(ROOT, "docs", "TEST_LOG.md");

const PACKAGES = [
	{ label: "@patchwork/core", filter: "@patchwork/core" },
	{ label: "@patchwork/agents", filter: "@patchwork/agents" },
	{ label: "patchwork-audit", filter: "patchwork-audit" },
];

function runVitestJson(packageFilter) {
	const outputFile = join(
		tmpdir(),
		`patchwork-test-log-${packageFilter.replace(/[^a-z0-9_-]/gi, "_")}-${Date.now()}.json`,
	);

	const args = [
		"--filter",
		packageFilter,
		"test",
		"--",
		"--reporter=json",
		`--outputFile=${outputFile}`,
	];

	const result = spawnSync("pnpm", args, {
		cwd: ROOT,
		stdio: "inherit",
		env: process.env,
	});

	let parsed = null;
	try {
		parsed = JSON.parse(readFileSync(outputFile, "utf-8"));
	} catch {
		parsed = null;
	}

	return {
		exitCode: result.status ?? 1,
		report: parsed,
	};
}

function summarizeFile(result) {
	const assertions = result.assertionResults || [];
	const areaSet = new Set();
	const examples = [];

	for (const assertion of assertions) {
		const chain = assertion.ancestorTitles || [];
		if (chain.length >= 2) {
			areaSet.add(chain[1]);
		} else if (chain.length === 1) {
			areaSet.add(chain[0]);
		}
		if (examples.length < 3) {
			examples.push(assertion.title);
		}
	}

	const relName = relative(ROOT, result.name).replaceAll("\\", "/");
	const areas = [...areaSet].slice(0, 6);

	let scope = "General coverage";
	if (areas.length > 0) {
		scope = areas.join(", ");
	}

	let sampleText = "";
	if (examples.length > 0) {
		sampleText = ` Example cases: ${examples.join("; ")}.`;
	}

	return `- \`${relName}\` (${assertions.length} tests): ${scope}.${sampleText}`;
}

function summarizePackage(label, report, exitCode) {
	if (!report) {
		return {
			header: `### ${label}\n- Status: FAIL (could not parse JSON report)\n`,
			total: 0,
			passed: 0,
			failed: 0,
			suites: 0,
		};
	}

	const status = exitCode === 0 && report.success ? "PASS" : "FAIL";
	const lines = [];
	lines.push(`### ${label}`);
	lines.push(
		`- Status: ${status}`,
	);
	lines.push(
		`- Totals: ${report.numPassedTests}/${report.numTotalTests} passed, ${report.numFailedTests} failed, ${report.numPendingTests + report.numTodoTests} skipped/todo across ${report.numTotalTestSuites} suites`,
	);
	lines.push("- Coverage by test file:");

	const sortedResults = [...(report.testResults || [])].sort((a, b) =>
		(a.name || "").localeCompare(b.name || ""),
	);

	for (const testResult of sortedResults) {
		lines.push(summarizeFile(testResult));
	}

	lines.push("");

	return {
		header: `${lines.join("\n")}\n`,
		total: report.numTotalTests || 0,
		passed: report.numPassedTests || 0,
		failed: report.numFailedTests || 0,
		suites: report.numTotalTestSuites || 0,
	};
}

function ensureLogHeader() {
	try {
		readFileSync(LOG_PATH, "utf-8");
		return;
	} catch {
		mkdirSync(join(ROOT, "docs"), { recursive: true });
		const initial = [
			"# Test Log",
			"",
			"Rolling record of test runs during development.",
			"",
			"## How To Update",
			"",
			"- Run `pnpm test:log` from repo root.",
			"- The command runs tests for each package and appends a timestamped entry here.",
			"",
		].join("\n");
		writeFileSync(LOG_PATH, initial, "utf-8");
	}
}

function main() {
	ensureLogHeader();

	const runAt = new Date().toISOString();
	const packageSummaries = [];
	let total = 0;
	let passed = 0;
	let failed = 0;
	let suites = 0;
	let hasFailure = false;

	for (const pkg of PACKAGES) {
		const { exitCode, report } = runVitestJson(pkg.filter);
		const summary = summarizePackage(pkg.label, report, exitCode);
		packageSummaries.push(summary.header);
		total += summary.total;
		passed += summary.passed;
		failed += summary.failed;
		suites += summary.suites;
		if (exitCode !== 0 || summary.failed > 0) {
			hasFailure = true;
		}
	}

	const status = hasFailure ? "FAIL" : "PASS";
	const entry = [
		`## ${runAt}`,
		"",
		`- Overall status: ${status}`,
		`- Totals: ${passed}/${total} passed, ${failed} failed across ${suites} suites`,
		"",
		...packageSummaries,
		"---",
		"",
	].join("\n");

	const existing = readFileSync(LOG_PATH, "utf-8");
	writeFileSync(LOG_PATH, `${existing.trimEnd()}\n\n${entry}`, "utf-8");

	if (hasFailure) {
		process.exitCode = 1;
	}
}

main();
