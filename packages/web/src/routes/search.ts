import { Hono } from "hono";
import type { Store, SearchableStore, AuditEvent } from "@patchwork/core";
import { layout } from "../templates/layout.js";
import { riskBadge, agentBadge } from "../templates/components.js";
import { formatTimeShort } from "../data/queries.js";

export function searchRoutes(store: Store, searchStore: SearchableStore | null) {
	const app = new Hono();

	app.get("/search", (c) => {
		const q = c.req.query("q") || "";

		const content = `
		<h1>Search</h1>
		<div class="text-center mb-24">
			<input type="text" class="search-box" name="q" value="${escapeHtml(q)}"
				placeholder="Search events (file paths, commands, actions...)"
				hx-get="/partials/search-results" hx-target="#search-results"
				hx-trigger="keyup changed delay:300ms" hx-include="this">
		</div>
		<div id="search-results">
			${q ? renderResults(q, searchStore, store) : `<div class="empty">Type to search across all audit events.</div>`}
		</div>`;

		return c.html(layout("Search", "/search", content));
	});

	app.get("/partials/search-results", (c) => {
		const q = c.req.query("q") || "";
		if (!q.trim()) return c.html(`<div class="empty">Type to search across all audit events.</div>`);
		return c.html(renderResults(q, searchStore, store));
	});

	return app;
}

function renderResults(q: string, searchStore: SearchableStore | null, store: Store): string {
	let results: AuditEvent[];

	if (searchStore) {
		try {
			results = searchStore.search(q, 50);
		} catch {
			results = [];
		}
	} else {
		// Fallback: filter readRecent by substring match
		const all = store.readRecent(500);
		const lq = q.toLowerCase();
		results = all.filter(e =>
			e.action.includes(lq)
			|| (e.target?.path || "").toLowerCase().includes(lq)
			|| (e.target?.command || "").toLowerCase().includes(lq)
			|| (e.target?.url || "").toLowerCase().includes(lq)
			|| (e.target?.tool_name || "").toLowerCase().includes(lq)
		).slice(0, 50);
	}

	if (results.length === 0) {
		return `<div class="empty">No results for "${escapeHtml(q)}"</div>`;
	}

	return `
	<p class="subtitle">${results.length} results for "${escapeHtml(q)}"</p>
	<div class="card">
		<table>
			<thead><tr><th>Time</th><th>Agent</th><th>Action</th><th>Target</th><th>Risk</th><th>Status</th></tr></thead>
			<tbody>
				${results.map(e => {
					const target = e.target?.path || e.target?.command?.slice(0, 60) || e.target?.url?.slice(0, 60) || "—";
					return `<tr>
						<td>${formatTimeShort(e.timestamp)}</td>
						<td>${agentBadge(e.agent)}</td>
						<td class="action">${e.action}</td>
						<td class="mono truncate">${escapeHtml(target)}</td>
						<td>${riskBadge(e.risk.level)}</td>
						<td><span class="status-${e.status}">${e.status}</span></td>
					</tr>`;
				}).join("")}
			</tbody>
		</table>
	</div>`;
}

function escapeHtml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
