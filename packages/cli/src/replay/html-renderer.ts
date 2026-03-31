import type { AuditEvent } from "@patchwork/core";
import { computeFileDiff } from "../commands/diff.js";
import type { GitDiffResult } from "./git.js";

function esc(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const RISK_COLORS: Record<string, string> = {
	critical: "#cf222e",
	high: "#bf8700",
	medium: "#d4a72c",
	low: "#656d76",
	none: "#444d56",
};

const ACTION_ICONS: Record<string, string> = {
	session_start: "&#9654;",
	session_end: "&#9632;",
	file_read: "&#128196;",
	file_write: "&#128221;",
	file_edit: "&#9999;",
	file_create: "&#10133;",
	file_delete: "&#128465;",
	command_execute: "&#128187;",
	web_fetch: "&#127760;",
	web_search: "&#128269;",
	mcp_tool_call: "&#128295;",
	prompt_submit: "&#128172;",
	subagent_start: "&#129302;",
	subagent_stop: "&#129302;",
};

function formatDuration(ms: number): string {
	const s = Math.floor(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ${s % 60}s`;
	return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function formatRelTime(ms: number): string {
	const s = Math.floor(ms / 1000);
	if (s < 60) return `+${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `+${m}m${s % 60}s`;
	return `+${Math.floor(m / 60)}h${m % 60}m`;
}

function renderDiffHtml(diff: string): string {
	if (!diff) return "";
	const lines = diff.split("\n").slice(0, 40);
	const html = lines.map(l => {
		if (l.startsWith("+") && !l.startsWith("+++")) return `<span class="diff-add">${esc(l)}</span>`;
		if (l.startsWith("-") && !l.startsWith("---")) return `<span class="diff-del">${esc(l)}</span>`;
		if (l.startsWith("@@")) return `<span class="diff-hunk">${esc(l)}</span>`;
		return `<span class="diff-ctx">${esc(l)}</span>`;
	}).join("\n");

	const overflow = diff.split("\n").length > 40 ? `<div class="diff-overflow">... ${diff.split("\n").length - 40} more lines</div>` : "";
	return `<pre class="diff-block">${html}</pre>${overflow}`;
}

export function renderHtmlReplay(
	events: AuditEvent[],
	gitDiffs: Map<string, GitDiffResult>,
): string {
	if (events.length === 0) return "<html><body><p>No events.</p></body></html>";

	const first = events[0];
	const last = events[events.length - 1];
	const startTime = new Date(first.timestamp).getTime();
	const duration = formatDuration(new Date(last.timestamp).getTime() - startTime);
	const changes = computeFileDiff(events);
	const created = changes.filter(c => c.changeType === "CREATED").length;
	const modified = changes.filter(c => c.changeType === "MODIFIED").length;
	const deleted = changes.filter(c => c.changeType === "DELETED").length;
	const commands = events.filter(e => e.action === "command_execute").length;
	const denials = events.filter(e => e.status === "denied").length;

	const riskCounts: Record<string, number> = {};
	for (const e of events) riskCounts[e.risk.level] = (riskCounts[e.risk.level] || 0) + 1;

	const timelineHtml = events.map((e, i) => {
		const relMs = new Date(e.timestamp).getTime() - startTime;
		const target = e.target?.path || e.target?.command?.slice(0, 80) || e.target?.url?.slice(0, 80) || e.target?.tool_name || "";
		const icon = ACTION_ICONS[e.action] || "&#9675;";
		const riskColor = RISK_COLORS[e.risk.level] || "#444";
		const isDenied = e.status === "denied";
		const flags = (e.risk.flags || []).join(", ");

		let detailHtml = "";
		if (e.content?.size_bytes) detailHtml += `<div class="detail-item">${e.content.size_bytes} bytes</div>`;
		if (e.content?.hash) detailHtml += `<div class="detail-item mono dim">${esc(e.content.hash.slice(0, 24))}...</div>`;
		if (flags) detailHtml += `<div class="detail-item dim">Flags: ${esc(flags)}</div>`;
		if (isDenied && e.risk.policy_match) detailHtml += `<div class="detail-item denied">Policy: ${esc(e.risk.policy_match)}</div>`;

		// Git diff
		let diffHtml = "";
		if (e.target?.path && ["file_write", "file_edit", "file_create"].includes(e.action)) {
			const gd = gitDiffs.get(e.target.path);
			if (gd?.found && gd.diff) diffHtml = renderDiffHtml(gd.diff);
		}

		return `<div class="tl-event${isDenied ? " tl-denied" : ""}" onclick="this.classList.toggle('expanded')">
			<div class="tl-dot" style="background:${riskColor}"></div>
			<div class="tl-content">
				<div class="tl-header">
					<span class="tl-time">${esc(formatRelTime(relMs))}</span>
					<span class="tl-icon">${icon}</span>
					<span class="tl-action">${esc(e.action)}</span>
					<span class="tl-target mono">${esc(target)}</span>
					<span class="tl-risk" style="background:${riskColor}">${esc(e.risk.level)}</span>
					${isDenied ? '<span class="tl-status-denied">DENIED</span>' : ""}
				</div>
				<div class="tl-detail">
					${detailHtml}
					${diffHtml}
				</div>
			</div>
		</div>`;
	}).join("\n");

	const riskSummary = ["critical", "high", "medium", "low", "none"]
		.filter(r => riskCounts[r])
		.map(r => `<span class="risk-chip" style="background:${RISK_COLORS[r]}">${riskCounts[r]} ${r}</span>`)
		.join(" ");

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Session Replay — ${esc(first.session_id.slice(0, 16))}</title>
<style>${CSS}</style>
</head>
<body>

<header>
	<h1>Session Replay</h1>
	<div class="session-meta">
		<span class="mono">${esc(first.session_id)}</span>
		<span>${esc(first.agent)}${first.agent_version ? ` v${esc(first.agent_version)}` : ""}</span>
		<span>${esc(first.project?.name || "unknown")}</span>
		<span>${new Date(first.timestamp).toLocaleString()}</span>
		<span>${duration}</span>
		<span>${events.length} events</span>
	</div>
</header>

<main>
	<div class="stats-bar">
		<div class="stat">${created}<span>created</span></div>
		<div class="stat">${modified}<span>modified</span></div>
		<div class="stat">${deleted}<span>deleted</span></div>
		<div class="stat">${commands}<span>commands</span></div>
		<div class="stat${denials > 0 ? " stat-danger" : ""}">${denials}<span>denied</span></div>
	</div>

	<div class="risk-bar">${riskSummary}</div>

	<p class="hint">Click any event to expand details and diffs.</p>

	<div class="timeline">
		${timelineHtml}
	</div>
</main>

<footer>
	Generated by <strong>Patchwork</strong> &mdash; <a href="https://github.com/JonoGitty/patchwork">github.com/JonoGitty/patchwork</a>
</footer>

</body>
</html>`;
}

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; background: #0d1117; color: #e6edf3; line-height: 1.6; }

header { background: #161b22; border-bottom: 1px solid #30363d; padding: 24px 32px; }
header h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
.session-meta { display: flex; gap: 16px; flex-wrap: wrap; font-size: 14px; color: #8b949e; }
.session-meta .mono { color: #58a6ff; }

main { max-width: 900px; margin: 0 auto; padding: 24px; }

.stats-bar { display: flex; gap: 24px; margin-bottom: 16px; }
.stat { text-align: center; font-size: 28px; font-weight: 700; }
.stat span { display: block; font-size: 12px; font-weight: 400; color: #8b949e; text-transform: uppercase; }
.stat-danger { color: #cf222e; }

.risk-bar { margin-bottom: 20px; display: flex; gap: 8px; flex-wrap: wrap; }
.risk-chip { padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; color: white; }

.hint { color: #484f58; font-size: 13px; margin-bottom: 16px; }

.mono { font-family: "SF Mono", Consolas, monospace; font-size: 13px; }
.dim { color: #8b949e; }

/* Timeline */
.timeline { position: relative; padding-left: 32px; }
.timeline::before { content: ""; position: absolute; left: 11px; top: 0; bottom: 0; width: 2px; background: #30363d; }

.tl-event { position: relative; padding: 12px 0; cursor: pointer; }
.tl-event:hover .tl-content { background: #1c2128; }

.tl-dot { position: absolute; left: -27px; top: 16px; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #0d1117; z-index: 1; }

.tl-content { padding: 10px 16px; border-radius: 8px; transition: background 0.15s; }

.tl-header { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.tl-time { font-size: 12px; color: #484f58; min-width: 50px; font-family: monospace; }
.tl-icon { font-size: 16px; }
.tl-action { font-weight: 600; font-size: 14px; }
.tl-target { color: #8b949e; word-break: break-all; }
.tl-risk { padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; color: white; text-transform: uppercase; }
.tl-status-denied { background: #cf222e; color: white; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; }

.tl-denied { border-left: 3px solid #cf222e; margin-left: -3px; }

.tl-detail { display: none; margin-top: 8px; padding-top: 8px; border-top: 1px solid #21262d; }
.tl-event.expanded .tl-detail { display: block; }

.detail-item { font-size: 13px; color: #8b949e; margin-bottom: 4px; }
.detail-item.denied { color: #cf222e; font-weight: 600; }

/* Diffs */
.diff-block { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 12px; font-family: "SF Mono", Consolas, monospace; font-size: 12px; line-height: 1.5; overflow-x: auto; margin-top: 8px; white-space: pre; }
.diff-add { color: #3fb950; }
.diff-del { color: #f85149; }
.diff-hunk { color: #58a6ff; }
.diff-ctx { color: #8b949e; }
.diff-overflow { color: #484f58; font-size: 12px; font-style: italic; margin-top: 4px; }

footer { text-align: center; padding: 24px; color: #484f58; font-size: 13px; border-top: 1px solid #30363d; margin-top: 40px; }
footer a { color: #58a6ff; text-decoration: none; }

@media print {
	body { background: white; color: #1f2328; }
	header { background: #f6f8fa; border-bottom: 1px solid #d0d7de; }
	.tl-detail { display: block !important; }
	.tl-event:hover .tl-content { background: transparent; }
}
`;
