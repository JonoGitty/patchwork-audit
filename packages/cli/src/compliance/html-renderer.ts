import type { ComplianceReport, FrameworkReport, ControlStatus, ReportData } from "./types.js";

const STATUS_COLORS: Record<ControlStatus, string> = {
	pass: "#2da44e",
	fail: "#cf222e",
	partial: "#bf8700",
	na: "#656d76",
};

const STATUS_LABELS: Record<ControlStatus, string> = {
	pass: "PASS",
	fail: "FAIL",
	partial: "PARTIAL",
	na: "N/A",
};

const RISK_COLORS: Record<string, string> = {
	critical: "#cf222e",
	high: "#bf8700",
	medium: "#d4a72c",
	low: "#656d76",
	none: "#444d56",
};

function esc(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function statusBadge(status: ControlStatus): string {
	return `<span class="badge" style="background:${STATUS_COLORS[status] || "#444"}">${esc(STATUS_LABELS[status] || status)}</span>`;
}

function riskBadge(level: string): string {
	return `<span class="badge" style="background:${RISK_COLORS[level] || "#444"}">${esc(level.toUpperCase())}</span>`;
}

function gradeLabel(status: ControlStatus): string {
	const labels: Record<ControlStatus, string> = {
		pass: "Compliant",
		fail: "Non-Compliant",
		partial: "Partially Compliant",
		na: "Insufficient Data",
	};
	return labels[status];
}

export function renderHtmlReport(report: ComplianceReport): string {
	const { data } = report;
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Patchwork Compliance Report — ${report.periodStart.slice(0, 10)} to ${report.periodEnd.slice(0, 10)}</title>
<style>${CSS}</style>
</head>
<body>

<header>
	<div class="header-inner">
		<div>
			<h1>Patchwork Compliance Report</h1>
			<p class="header-sub">${report.periodStart.slice(0, 10)} to ${report.periodEnd.slice(0, 10)} &middot; Generated ${new Date(report.generatedAt).toLocaleString()}</p>
		</div>
		<div class="header-grade">
			<div class="grade-badge" style="background:${STATUS_COLORS[report.overallGrade]}">${gradeLabel(report.overallGrade)}</div>
		</div>
	</div>
</header>

<main>

<!-- 1. Executive Summary -->
<section>
	<h2>1. Executive Summary</h2>
	<div class="card-grid">
		<div class="stat-card">
			<div class="stat-value">${data.stats.totalEvents}</div>
			<div class="stat-label">Total Events</div>
		</div>
		<div class="stat-card">
			<div class="stat-value">${data.stats.totalSessions}</div>
			<div class="stat-label">Sessions</div>
		</div>
		<div class="stat-card">
			<div class="stat-value">${Object.keys(data.stats.byAgent).length}</div>
			<div class="stat-label">Agents</div>
		</div>
		<div class="stat-card">
			<div class="stat-value" style="color:${data.integrity.chainValid ? STATUS_COLORS.pass : STATUS_COLORS.fail}">${data.integrity.chainValid ? "VALID" : "BROKEN"}</div>
			<div class="stat-label">Chain Integrity</div>
		</div>
		<div class="stat-card">
			<div class="stat-value" style="color:${STATUS_COLORS[report.overallGrade]}">${gradeLabel(report.overallGrade)}</div>
			<div class="stat-label">Overall Grade</div>
		</div>
	</div>

	<h3>Risk Distribution</h3>
	<table>
		<thead><tr><th>Risk Level</th><th>Count</th><th>Percentage</th></tr></thead>
		<tbody>
		${["critical", "high", "medium", "low", "none"].map(level => {
			const count = data.stats.byRisk[level] || 0;
			const pct = data.stats.totalEvents > 0 ? ((count / data.stats.totalEvents) * 100).toFixed(1) : "0.0";
			return `<tr><td>${riskBadge(level)}</td><td>${count}</td><td>${pct}%</td></tr>`;
		}).join("")}
		</tbody>
	</table>

	<h3>Frameworks Assessed</h3>
	<table>
		<thead><tr><th>Framework</th><th>Controls</th><th>Pass</th><th>Fail</th><th>Partial</th><th>N/A</th><th>Grade</th></tr></thead>
		<tbody>
		${report.frameworks.map(fw => {
			const grade = fw.summary.fail > 0 ? "fail" : fw.summary.partial > 0 ? "partial" : fw.summary.pass > 0 ? "pass" : "na";
			return `<tr>
				<td><strong>${esc(fw.framework.name)}</strong></td>
				<td>${fw.summary.total}</td>
				<td>${fw.summary.pass}</td>
				<td>${fw.summary.fail}</td>
				<td>${fw.summary.partial}</td>
				<td>${fw.summary.na}</td>
				<td>${statusBadge(grade as ControlStatus)}</td>
			</tr>`;
		}).join("")}
		</tbody>
	</table>
</section>

<!-- 2. Audit Trail Integrity -->
<section>
	<h2>2. Audit Trail Integrity</h2>
	<table>
		<tbody>
			<tr><td>Hash Chain</td><td>${data.integrity.chainValid ? statusBadge("pass") : statusBadge("fail")} ${data.integrity.chainedEvents} chained events, ${data.integrity.legacyEvents} legacy, ${data.integrity.invalidEvents} invalid</td></tr>
			<tr><td>Sealed</td><td>${data.integrity.sealed ? statusBadge("pass") + " HMAC-signed" : statusBadge("partial") + " Not sealed"}</td></tr>
			<tr><td>Attested</td><td>${data.integrity.attested ? statusBadge("pass") + " CI attestation present" : statusBadge("partial") + " No attestation"}</td></tr>
		</tbody>
	</table>
</section>

<!-- 3. Agent Activity -->
<section>
	<h2>3. Agent Activity Summary</h2>
	${data.sessions.length > 0 ? `
	<table>
		<thead><tr><th>Session</th><th>Agent</th><th>Project</th><th>Duration</th><th>Events</th><th>Writes</th><th>Commands</th><th>High Risk</th><th>Denials</th></tr></thead>
		<tbody>
		${data.sessions.slice(0, 20).map(s => `<tr>
			<td class="mono">${esc(s.id.slice(0, 16))}</td>
			<td>${esc(s.agent)}</td>
			<td>${esc(s.project)}</td>
			<td>${formatDuration(s.durationMs)}</td>
			<td>${s.count}</td>
			<td>${s.writes}</td>
			<td>${s.commands}</td>
			<td>${s.highRisk > 0 ? `<span style="color:${RISK_COLORS.critical}">${s.highRisk}</span>` : "0"}</td>
			<td>${s.denials > 0 ? `<span style="color:${RISK_COLORS.critical}">${s.denials}</span>` : "0"}</td>
		</tr>`).join("")}
		</tbody>
	</table>` : `<p class="empty">No sessions in reporting period.</p>`}
</section>

<!-- 4. File Access Audit -->
<section>
	<h2>4. Access Control & File Audit</h2>
	${renderFileAudit(data)}
</section>

<!-- 5. Command Execution -->
<section>
	<h2>5. Command Execution Audit</h2>
	${renderCommandAudit(data)}
</section>

<!-- 6. Risk & Policy -->
<section>
	<h2>6. Risk Profile & Policy Enforcement</h2>
	${renderRiskProfile(data)}
</section>

<!-- 7. Network & MCP -->
<section>
	<h2>7. Network & External Access</h2>
	${renderNetworkAudit(data)}
</section>

<!-- 8. Framework Control Mappings -->
${report.frameworks.map((fw, i) => `
<section class="framework-section">
	<h2>${8 + i}. ${esc(fw.framework.name)} — Control Mapping</h2>
	<p class="section-desc">${esc(fw.framework.description)} (${fw.framework.version})</p>
	<table class="control-table">
		<thead><tr><th>Control</th><th>Name</th><th>Status</th><th>Evidence</th><th>Events</th></tr></thead>
		<tbody>
		${fw.results.map(r => `<tr>
			<td class="mono"><strong>${esc(r.control.id)}</strong></td>
			<td>${esc(r.control.name)}</td>
			<td>${statusBadge(r.result.status)}</td>
			<td class="evidence">${esc(r.result.evidence)}</td>
			<td style="text-align:center">${r.result.linkedEvents?.length || r.result.eventCount || "—"}</td>
		</tr>`).join("")}
		</tbody>
	</table>
</section>`).join("")}

${report.gaps && report.gaps.length > 0 ? `
<!-- Gap Analysis -->
<section>
	<h2>${8 + report.frameworks.length}. Gap Analysis</h2>
	<p class="section-desc">${report.gaps.length} control(s) require attention — missing evidence or configuration needed.</p>
	<table>
		<thead><tr><th>Framework</th><th>Control</th><th>Issue</th><th>Remediation</th><th>Effort</th></tr></thead>
		<tbody>
		${report.gaps.map(g => `<tr>
			<td>${esc(g.frameworkId)}</td>
			<td class="mono"><strong>${esc(g.controlId)}</strong> ${esc(g.controlName)}</td>
			<td class="evidence">${esc(g.reason)}</td>
			<td><code style="font-size:12px">${esc(g.remediation)}</code></td>
			<td>${esc(g.effort)}</td>
		</tr>`).join("")}
		</tbody>
	</table>
</section>` : ""}

${report.trends && report.trends.length > 0 ? `
<!-- Compliance Trends -->
<section>
	<h2>${8 + report.frameworks.length + (report.gaps?.length ? 1 : 0)}. Compliance Posture Over Time</h2>
	${report.trends.map(t => {
		const labels = JSON.stringify(t.windows.map(w => w.start.slice(0, 10)));
		const passData = JSON.stringify(t.windows.map(w => w.passRate));
		const riskData = JSON.stringify(t.windows.map(w => w.highRiskCount));
		const denialData = JSON.stringify(t.windows.map(w => w.denialCount));
		const chartId = "trend_" + t.frameworkId.replace(/[^a-z0-9]/g, "_");
		return `
		<h3>${esc(t.frameworkId)} — ${t.period} trend</h3>
		<div style="position:relative;height:280px">
			<canvas id="${chartId}"></canvas>
		</div>
		<script>
		new Chart(document.getElementById('${chartId}'), {
			type: 'line',
			data: {
				labels: ${labels},
				datasets: [
					{ label: 'Pass Rate %', data: ${passData}, borderColor: '#2da44e', backgroundColor: 'rgba(45,164,78,0.1)', fill: true, tension: 0.3, yAxisID: 'y' },
					{ label: 'High Risk', data: ${riskData}, borderColor: '#bf8700', tension: 0.3, yAxisID: 'y1' },
					{ label: 'Denials', data: ${denialData}, borderColor: '#cf222e', tension: 0.3, yAxisID: 'y1' },
				]
			},
			options: {
				responsive: true, maintainAspectRatio: false,
				plugins: { legend: { position: 'bottom', labels: { color: '#656d76' } } },
				scales: {
					x: { grid: { color: '#d0d7de' }, ticks: { color: '#656d76' } },
					y: { position: 'left', grid: { color: '#d0d7de' }, ticks: { color: '#656d76' }, min: 0, max: 100, title: { display: true, text: 'Pass %' } },
					y1: { position: 'right', grid: { display: false }, ticks: { color: '#656d76' }, min: 0, title: { display: true, text: 'Count' } }
				}
			}
		});
		</script>`;
	}).join("")}
</section>` : ""}

<!-- Footer -->
<section class="report-footer">
	<h2>Report Metadata</h2>
	<table>
		<tbody>
			<tr><td>Generated</td><td>${new Date(report.generatedAt).toISOString()}</td></tr>
			<tr><td>Tool</td><td>Patchwork v${report.toolVersion}</td></tr>
			<tr><td>Period</td><td>${report.periodStart.slice(0, 10)} to ${report.periodEnd.slice(0, 10)}</td></tr>
			<tr><td>Events</td><td>${data.stats.totalEvents}</td></tr>
			<tr><td>Policy</td><td>${esc(data.policySource)}</td></tr>
		</tbody>
	</table>
	<p class="footer-note">This report was automatically generated by Patchwork from local audit data. It maps observed AI agent activity to compliance framework controls. This report does not constitute legal advice or a formal audit opinion.</p>
</section>

</main>

<footer>
	<p>Generated by <strong>Patchwork</strong> &mdash; The audit trail for AI coding agents &mdash; <a href="https://github.com/JonoGitty/patchwork">github.com/JonoGitty/patchwork</a></p>
</footer>

</body>
</html>`;
}

function renderFileAudit(data: ReportData): string {
	const reads = data.fileEvents.filter(e => e.action === "file_read").length;
	const writes = data.fileEvents.filter(e => e.action === "file_write" || e.action === "file_edit").length;
	const creates = data.fileEvents.filter(e => e.action === "file_create").length;
	const deletes = data.fileEvents.filter(e => e.action === "file_delete").length;
	const sensitive = data.sensitiveFileEvents;

	return `
	<div class="card-grid-sm">
		<div class="stat-card-sm"><span class="val">${reads}</span> Reads</div>
		<div class="stat-card-sm"><span class="val">${writes}</span> Writes/Edits</div>
		<div class="stat-card-sm"><span class="val">${creates}</span> Creates</div>
		<div class="stat-card-sm"><span class="val">${deletes}</span> Deletes</div>
		<div class="stat-card-sm"><span class="val" style="color:${sensitive.length > 0 ? RISK_COLORS.high : "inherit"}">${sensitive.length}</span> Sensitive Access</div>
	</div>
	${sensitive.length > 0 ? `
	<h3>Sensitive File Access</h3>
	<table>
		<thead><tr><th>Time</th><th>Action</th><th>Path</th><th>Risk</th><th>Status</th></tr></thead>
		<tbody>
		${sensitive.slice(0, 20).map(e => `<tr>
			<td class="mono">${esc(e.timestamp.slice(11, 19))}</td>
			<td>${esc(e.action)}</td>
			<td class="mono">${esc(e.target?.path || "—")}</td>
			<td>${riskBadge(e.risk.level)}</td>
			<td>${e.status === "denied" ? statusBadge("fail") : esc(e.status)}</td>
		</tr>`).join("")}
		</tbody>
	</table>` : `<p class="ok">No sensitive file access detected.</p>`}
	${data.stats.topFiles.length > 0 ? `
	<h3>Top Modified Files</h3>
	<table>
		<thead><tr><th>Path</th><th>Modifications</th></tr></thead>
		<tbody>
		${data.stats.topFiles.slice(0, 10).map(([p, c]) => `<tr><td class="mono">${esc(p)}</td><td>${c}</td></tr>`).join("")}
		</tbody>
	</table>` : ""}`;
}

function renderCommandAudit(data: ReportData): string {
	const total = data.commandEvents.length;
	const highRisk = data.commandEvents.filter(e => e.risk.level === "critical" || e.risk.level === "high");
	const denied = data.denials.filter(e => e.target?.command);

	return `
	<p>${total} commands executed. ${highRisk.length} classified as high-risk. ${denied.length} denied by policy.</p>
	${denied.length > 0 ? `
	<h3>Denied Commands</h3>
	<table>
		<thead><tr><th>Time</th><th>Command</th><th>Risk</th></tr></thead>
		<tbody>
		${denied.slice(0, 15).map(e => `<tr>
			<td class="mono">${esc(e.timestamp.slice(11, 19))}</td>
			<td class="mono">${esc((e.target?.command || "").slice(0, 80))}</td>
			<td>${riskBadge(e.risk.level)}</td>
		</tr>`).join("")}
		</tbody>
	</table>` : ""}
	${data.stats.topCommands.length > 0 ? `
	<h3>Top Commands</h3>
	<table>
		<thead><tr><th>Command</th><th>Count</th></tr></thead>
		<tbody>
		${data.stats.topCommands.slice(0, 10).map(([c, n]) => `<tr><td class="mono">${esc(c)}</td><td>${n}</td></tr>`).join("")}
		</tbody>
	</table>` : ""}`;
}

function renderRiskProfile(data: ReportData): string {
	const denials = data.denials;
	const highRisk = data.highRiskEvents;

	return `
	${denials.length > 0 ? `
	<h3>Policy Denials (${denials.length})</h3>
	<table>
		<thead><tr><th>Time</th><th>Action</th><th>Target</th><th>Risk</th></tr></thead>
		<tbody>
		${denials.slice(0, 20).map(e => {
			const target = e.target?.path || e.target?.command?.slice(0, 60) || e.target?.url || "—";
			return `<tr>
				<td class="mono">${esc(e.timestamp.slice(11, 19))}</td>
				<td>${esc(e.action)}</td>
				<td class="mono">${esc(target)}</td>
				<td>${riskBadge(e.risk.level)}</td>
			</tr>`;
		}).join("")}
		</tbody>
	</table>` : `<p class="ok">No policy denials in reporting period.</p>`}

	${highRisk.length > 0 ? `
	<h3>High-Risk Events (${highRisk.length})</h3>
	<table>
		<thead><tr><th>Time</th><th>Agent</th><th>Action</th><th>Target</th><th>Risk</th><th>Flags</th></tr></thead>
		<tbody>
		${highRisk.slice(0, 20).map(e => {
			const target = e.target?.path || e.target?.command?.slice(0, 60) || "—";
			return `<tr>
				<td class="mono">${esc(e.timestamp.slice(11, 19))}</td>
				<td>${esc(e.agent)}</td>
				<td>${esc(e.action)}</td>
				<td class="mono">${esc(target)}</td>
				<td>${riskBadge(e.risk.level)}</td>
				<td class="dim">${esc((e.risk.flags || []).join(", "))}</td>
			</tr>`;
		}).join("")}
		</tbody>
	</table>` : `<p class="ok">No high-risk events in reporting period.</p>`}`;
}

function renderNetworkAudit(data: ReportData): string {
	const web = data.networkEvents;
	const mcp = data.mcpEvents;

	if (web.length === 0 && mcp.length === 0) {
		return `<p class="ok">No network or MCP tool access in reporting period.</p>`;
	}

	const domains = new Map<string, number>();
	for (const e of web) {
		try {
			const url = e.target?.url || "";
			const host = new URL(url).hostname;
			domains.set(host, (domains.get(host) || 0) + 1);
		} catch { /* skip invalid URLs */ }
	}

	return `
	<p>${web.length} web requests. ${mcp.length} MCP tool calls.</p>
	${domains.size > 0 ? `
	<h3>Domains Accessed</h3>
	<table>
		<thead><tr><th>Domain</th><th>Requests</th></tr></thead>
		<tbody>
		${Array.from(domains.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([d, c]) => `<tr><td class="mono">${esc(d)}</td><td>${c}</td></tr>`).join("")}
		</tbody>
	</table>` : ""}
	${mcp.length > 0 ? `
	<h3>MCP Tool Calls</h3>
	<table>
		<thead><tr><th>Time</th><th>Tool</th><th>Risk</th><th>Status</th></tr></thead>
		<tbody>
		${mcp.slice(0, 15).map(e => `<tr>
			<td class="mono">${esc(e.timestamp.slice(11, 19))}</td>
			<td class="mono">${esc(e.target?.tool_name || "—")}</td>
			<td>${riskBadge(e.risk.level)}</td>
			<td>${esc(e.status)}</td>
		</tr>`).join("")}
		</tbody>
	</table>` : ""}`;
}

function formatDuration(ms: number): string {
	const s = Math.floor(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ${s % 60}s`;
	return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ---------------------------------------------------------------------------
// CSS — self-contained, professional, print-friendly
// ---------------------------------------------------------------------------

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #1f2328; line-height: 1.6; background: #f6f8fa; }

header { background: #0d1117; color: #e6edf3; padding: 32px 40px; }
.header-inner { max-width: 1000px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
header h1 { font-size: 24px; font-weight: 700; }
.header-sub { color: #8b949e; font-size: 14px; margin-top: 4px; }
.grade-badge { padding: 8px 20px; border-radius: 8px; font-size: 16px; font-weight: 700; color: white; }

main { max-width: 1000px; margin: 0 auto; padding: 32px 40px; }

section { margin-bottom: 40px; page-break-inside: avoid; }
h2 { font-size: 20px; font-weight: 700; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #d0d7de; }
h3 { font-size: 16px; font-weight: 600; margin: 20px 0 12px; color: #656d76; }
.section-desc { color: #656d76; font-size: 14px; margin-bottom: 16px; }

table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 14px; }
th { text-align: left; padding: 10px 12px; background: #f6f8fa; border: 1px solid #d0d7de; font-weight: 600; color: #656d76; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; }
td { padding: 10px 12px; border: 1px solid #d0d7de; vertical-align: top; }
tr:nth-child(even) td { background: #f9fafb; }

.badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; color: white; text-transform: uppercase; letter-spacing: 0.5px; }
.mono { font-family: "SF Mono", Consolas, monospace; font-size: 13px; }
.dim { color: #656d76; font-size: 13px; }
.evidence { font-size: 13px; line-height: 1.5; }
.ok { color: #2da44e; font-weight: 600; }
.empty { color: #656d76; font-style: italic; }

.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
.stat-card { background: white; border: 1px solid #d0d7de; border-radius: 8px; padding: 16px; text-align: center; }
.stat-value { font-size: 28px; font-weight: 700; }
.stat-label { font-size: 12px; color: #656d76; margin-top: 4px; text-transform: uppercase; }

.card-grid-sm { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; margin-bottom: 20px; }
.stat-card-sm { background: white; border: 1px solid #d0d7de; border-radius: 6px; padding: 12px; text-align: center; font-size: 13px; }
.stat-card-sm .val { font-size: 22px; font-weight: 700; display: block; }

.control-table td:first-child { white-space: nowrap; }
.control-table td:nth-child(3) { white-space: nowrap; text-align: center; }

.report-footer { border-top: 2px solid #d0d7de; padding-top: 24px; }
.footer-note { color: #656d76; font-size: 12px; font-style: italic; margin-top: 16px; }

footer { text-align: center; padding: 24px; color: #656d76; font-size: 13px; border-top: 1px solid #d0d7de; margin-top: 40px; }
footer a { color: #0969da; text-decoration: none; }

@media print {
	body { background: white; }
	header { background: #1f2328; }
	section { page-break-inside: avoid; }
	.badge { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
