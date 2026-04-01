import { Hono } from "hono";
import type { Store, AuditEvent, EventFilter } from "@patchwork/core";
import { layout } from "../templates/layout.js";
import { eventTable } from "../templates/components.js";

export function eventRoutes(store: Store) {
	const app = new Hono();

	app.get("/events", (c) => {
		const agent = c.req.query("agent") || "";
		const action = c.req.query("action") || "";
		const risk = c.req.query("risk") || "";
		const limit = parseInt(c.req.query("limit") || "100", 10);

		const filter: EventFilter = { limit };
		if (agent) filter.agent = agent;
		if (action) filter.action = action;
		if (risk) filter.minRisk = risk;

		const events = store.query(filter).reverse();

		// Collect unique values for filter dropdowns
		const allEvents = store.readRecent(500);
		const agents = [...new Set(allEvents.map(e => e.agent))];
		const actions = [...new Set(allEvents.map(e => e.action))].sort();
		const risks = ["critical", "high", "medium", "low", "none"];

		const filterBar = `
		<div class="filter-bar">
			<select name="agent" hx-get="/partials/events" hx-target="#event-tbody" hx-include="closest .filter-bar">
				<option value="">All agents</option>
				${agents.map(a => `<option value="${a}"${agent === a ? " selected" : ""}>${a}</option>`).join("")}
			</select>
			<select name="action" hx-get="/partials/events" hx-target="#event-tbody" hx-include="closest .filter-bar">
				<option value="">All actions</option>
				${actions.map(a => `<option value="${a}"${action === a ? " selected" : ""}>${a}</option>`).join("")}
			</select>
			<select name="risk" hx-get="/partials/events" hx-target="#event-tbody" hx-include="closest .filter-bar">
				<option value="">All risk levels</option>
				${risks.map(r => `<option value="${r}"${risk === r ? " selected" : ""}>${r}</option>`).join("")}
			</select>
			<select name="limit" hx-get="/partials/events" hx-target="#event-tbody" hx-include="closest .filter-bar">
				<option value="50"${limit === 50 ? " selected" : ""}>50</option>
				<option value="100"${limit === 100 ? " selected" : ""}>100</option>
				<option value="250"${limit === 250 ? " selected" : ""}>250</option>
				<option value="500"${limit === 500 ? " selected" : ""}>500</option>
			</select>
		</div>`;

		const content = `
		<h1>Event Log</h1>
		<p class="subtitle">${events.length} events</p>
		${filterBar}
		<div class="card">
			<table>
				<thead><tr>
					<th>Time</th><th>Agent</th><th>Action</th><th>Target</th><th>Risk</th><th>Status</th>
				</tr></thead>
				<tbody id="event-tbody">
					${events.map(e => eventRowHtml(e)).join("")}
				</tbody>
			</table>
		</div>`;

		return c.html(layout("Events", "/events", content));
	});

	// htmx partial for filtered events
	app.get("/partials/events", (c) => {
		const agent = c.req.query("agent") || "";
		const action = c.req.query("action") || "";
		const risk = c.req.query("risk") || "";
		const limit = parseInt(c.req.query("limit") || "100", 10);

		const filter: EventFilter = { limit };
		if (agent) filter.agent = agent;
		if (action) filter.action = action;
		if (risk) filter.minRisk = risk;

		const events = store.query(filter).reverse();
		return c.html(events.map(e => eventRowHtml(e)).join(""));
	});

	return app;
}

function eventRowHtml(event: AuditEvent): string {
	const { formatTimeShort } = await_import();
	const target = event.target?.path
		|| event.target?.command?.slice(0, 60)
		|| event.target?.url?.slice(0, 60)
		|| event.target?.tool_name
		|| "—";
	const t = escapeHtml(target);
	return `<tr class="clickable" onclick="this.nextElementSibling.classList.toggle('open')">
		<td>${formatTs(event.timestamp)}</td>
		<td><span class="agent">${event.agent}</span></td>
		<td><span class="action">${event.action}</span></td>
		<td><span class="truncate" title="${t}">${t}</span></td>
		<td><span class="risk risk-${event.risk.level}">${event.risk.level}</span></td>
		<td><span class="status-${event.status}">${event.status}</span></td>
	</tr>
	<tr class="detail-row"><td colspan="6"><div class="detail-content">${escapeHtml(JSON.stringify(event, null, 2))}</div></td></tr>`;
}

function formatTs(iso: string): string {
	if (!iso) return "—";
	const d = new Date(iso);
	return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function await_import() {
	return { formatTimeShort: formatTs };
}

function escapeHtml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
