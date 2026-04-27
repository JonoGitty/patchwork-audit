import { Hono } from "hono";
import type { Store } from "@patchwork/core";
import { layout } from "../templates/layout.js";
import { statCard } from "../templates/components.js";
import { attestationTimelineChart } from "../templates/charts.js";
import {
	attestationSummary,
	attestationTimeline,
	recentFailures,
	readAttestations,
} from "../data/attestations.js";

export function attestationRoutes(_store: Store) {
	const app = new Hono();

	app.get("/attestations", (c) => {
		const summary = attestationSummary();
		const timeline = attestationTimeline(30);
		const failures = recentFailures(15);
		const recent = readAttestations().slice(-15).reverse();

		const passRate = summary.pass_rate == null ? "—" : `${summary.pass_rate}%`;
		const lastAt = summary.last_attested ? summary.last_attested.slice(0, 19).replace("T", " ") : "—";

		const failuresTable = failures.length === 0
			? `<div class="empty">No attestation failures recorded.</div>`
			: `<table>
				<thead><tr><th>When</th><th>Stage</th><th>Commit</th><th>Branch</th><th>Error</th></tr></thead>
				<tbody>${failures.map((f) => `
					<tr>
						<td class="mono" style="font-size:12px">${(f.timestamp || "").slice(0, 19).replace("T", " ")}</td>
						<td><span class="risk risk-${f.stage === "extract" ? "medium" : "high"}">${escapeHtml(f.stage)}</span></td>
						<td class="mono">${f.commit_sha ? escapeHtml(f.commit_sha.slice(0, 8)) : '<span style="color:var(--text-muted)">—</span>'}</td>
						<td class="mono" style="font-size:12px">${escapeHtml(f.branch || "—")}</td>
						<td style="color:var(--critical);font-size:12px">${escapeHtml((f.error_message || "").slice(0, 140))}</td>
					</tr>`).join("")}</tbody>
			</table>`;

		const recentTable = recent.length === 0
			? `<div class="empty">No commit attestations yet.</div>`
			: `<table>
				<thead><tr><th>When</th><th>Status</th><th>Commit</th><th>Branch</th><th>Session</th></tr></thead>
				<tbody>${recent.map((r) => `
					<tr>
						<td class="mono" style="font-size:12px">${(r.generated_at || "").slice(0, 19).replace("T", " ")}</td>
						<td><span class="risk risk-${r.pass ? "low" : "high"}">${r.pass ? "PASS" : "FAIL"}</span></td>
						<td class="mono">${escapeHtml(r.commit_sha)}</td>
						<td class="mono" style="font-size:12px">${escapeHtml(r.branch || "—")}</td>
						<td class="mono" style="font-size:11px;color:var(--text-muted)">${escapeHtml(r.session_id.slice(0, 12))}</td>
					</tr>`).join("")}</tbody>
			</table>`;

		const branchList = summary.by_branch.length === 0
			? `<div class="empty">No data.</div>`
			: `<ul style="list-style:none;padding:0;margin:0">${summary.by_branch.map((b) => `
				<li style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border)">
					<span class="mono" style="font-size:13px">${escapeHtml(b.branch)}</span>
					<span style="color:var(--text-dim)">${b.n}</span>
				</li>`).join("")}</ul>`;

		const failureColor = summary.recent_failures > 0 ? "var(--critical)" : undefined;

		const content = `
		<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
			<h1 style="margin-bottom:0">Commit Attestations</h1>
			<div style="color:var(--text-muted);font-size:13px">last attested: ${lastAt}</div>
		</div>
		<div class="card-grid">
			${statCard("Total", summary.total)}
			${statCard("Pass", summary.pass, "var(--low)")}
			${statCard("Fail", summary.fail, "var(--critical)")}
			${statCard("Pass Rate", passRate)}
			${statCard("Recent Failures", summary.recent_failures, failureColor)}
		</div>

		<div class="row">
			<div class="card" style="grid-column: span 2">
				<h3>Pass / Fail (last 30 days)</h3>
				${attestationTimelineChart(timeline)}
			</div>
			<div class="card">
				<h3>Top Branches</h3>
				${branchList}
			</div>
		</div>

		<h2>Recent Attestations</h2>
		${recentTable}

		<h2>Recent Failures</h2>
		<p style="color:var(--text-muted);font-size:13px;margin-top:-8px">
			Surfaces commits that should have been attested but weren't — populated from the post-tool catch.
			Empty list means everything attested cleanly (or you're on an old build that swallowed these silently).
		</p>
		${failuresTable}`;

		return c.html(layout("Attestations", "/attestations", content));
	});

	return app;
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}
