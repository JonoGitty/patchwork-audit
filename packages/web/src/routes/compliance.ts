import { Hono } from "hono";
import type { Store, AuditEvent, Policy } from "@patchwork/core";
import { loadActivePolicy, verifyChain } from "@patchwork/core";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { layout } from "../templates/layout.js";
import { riskBadge, statCard } from "../templates/components.js";
import { computeStats } from "../data/queries.js";

// Inline the framework definitions and evaluator to avoid circular dependency with CLI
// These are pure data — no CLI imports needed

interface ControlResult {
	status: "pass" | "fail" | "partial" | "na";
	evidence: string;
	eventCount?: number;
}

interface ComplianceControl {
	id: string;
	name: string;
	evaluate: (events: AuditEvent[], integrity: any, policy: Policy | null, policySource: string) => ControlResult;
}

interface Framework {
	id: string;
	name: string;
	version: string;
	controls: ComplianceControl[];
}

function hasPolicy(policy: Policy | null, source: string): boolean {
	return policy !== null && source !== "built-in";
}

const SOC2: Framework = {
	id: "soc2", name: "SOC 2 Type II", version: "2017",
	controls: [
		{ id: "CC6.1", name: "Logical Access Controls", evaluate: (events, _, policy, src) => {
			const fileEvents = events.filter(e => e.action.startsWith("file_"));
			const denials = events.filter(e => e.status === "denied" && e.target?.path);
			if (fileEvents.length === 0) return { status: "na", evidence: "No file access events." };
			return { status: denials.length > 0 ? "pass" : "partial", evidence: `${fileEvents.length} file events. ${denials.length} unauthorised access blocked.`, eventCount: fileEvents.length };
		}},
		{ id: "CC6.2", name: "Privileged Operations", evaluate: (events) => {
			const cmds = events.filter(e => e.action === "command_execute");
			const denied = events.filter(e => e.status === "denied" && e.target?.command);
			if (cmds.length === 0) return { status: "na", evidence: "No command events." };
			return { status: denied.length > 0 ? "pass" : "partial", evidence: `${cmds.length} commands logged. ${denied.length} blocked.`, eventCount: cmds.length };
		}},
		{ id: "CC7.1", name: "System Activity Monitoring", evaluate: (events) => {
			if (events.length === 0) return { status: "fail", evidence: "No events recorded." };
			const days = new Set(events.map(e => e.timestamp.slice(0, 10))).size;
			return { status: "pass", evidence: `${events.length} events across ${days} day(s). All timestamped with risk assessment.`, eventCount: events.length };
		}},
		{ id: "CC7.2", name: "Monitoring Log Effectiveness", evaluate: (events, integrity) => {
			if (events.length === 0) return { status: "fail", evidence: "No events." };
			if (integrity.chainValid && integrity.chainedEvents > 0) {
				return { status: integrity.sealed ? "pass" : "partial", evidence: `Hash chain valid (${integrity.chainedEvents} chained). ${integrity.sealed ? "Sealed." : "Not sealed."}` };
			}
			return { status: "fail", evidence: `Chain ${integrity.chainValid ? "valid" : "BROKEN"}. ${integrity.invalidEvents} invalid.` };
		}},
		{ id: "CC7.3", name: "Exception & Anomaly Handling", evaluate: (events, _, policy, src) => {
			const denials = events.filter(e => e.status === "denied");
			const highRisk = events.filter(e => e.risk.level === "critical" || e.risk.level === "high");
			if (hasPolicy(policy, src) && denials.length > 0) return { status: "pass", evidence: `Policy active. ${denials.length} violations blocked. ${highRisk.length} high-risk detected.` };
			if (hasPolicy(policy, src)) return { status: "partial", evidence: `Policy loaded but no denials. ${highRisk.length} high-risk detected.` };
			return { status: "fail", evidence: `No policy. ${highRisk.length} high-risk uncontrolled.` };
		}},
		{ id: "CC8.1", name: "Change Management", evaluate: (events) => {
			const writes = events.filter(e => ["file_write", "file_edit", "file_create"].includes(e.action));
			if (writes.length === 0) return { status: "na", evidence: "No modifications." };
			return { status: "pass", evidence: `${writes.length} changes logged with risk classification.`, eventCount: writes.length };
		}},
	],
};

const ISO27001: Framework = {
	id: "iso27001", name: "ISO/IEC 27001:2022", version: "2022",
	controls: [
		{ id: "A.8.2", name: "Privileged Access Rights", evaluate: (events) => {
			const cmds = events.filter(e => e.action === "command_execute");
			const denied = events.filter(e => e.status === "denied" && e.target?.command);
			if (cmds.length === 0) return { status: "na", evidence: "No commands." };
			return { status: denied.length > 0 ? "pass" : "partial", evidence: `${cmds.length} commands. ${denied.length} denied.` };
		}},
		{ id: "A.8.3", name: "Information Access Restriction", evaluate: (events) => {
			const sensitive = events.filter(e => e.risk.flags?.some(f => f === "sensitive_path"));
			const denied = events.filter(e => e.status === "denied" && e.target?.path);
			if (sensitive.length > 0 && denied.length > 0) return { status: "pass", evidence: `${sensitive.length} sensitive accesses detected. ${denied.length} blocked.` };
			if (sensitive.length > 0) return { status: "partial", evidence: `${sensitive.length} sensitive accesses but no active denials.` };
			return { status: "pass", evidence: "No sensitive file access detected." };
		}},
		{ id: "A.8.15", name: "Logging", evaluate: (events, integrity) => {
			if (events.length === 0) return { status: "fail", evidence: "No events." };
			return { status: integrity.chainValid ? "pass" : "partial", evidence: `${events.length} events with hash chain. Integrity: ${integrity.chainValid ? "VALID" : "BROKEN"}.` };
		}},
		{ id: "A.8.16", name: "Monitoring Activities", evaluate: (events, _, policy, src) => {
			if (events.length === 0) return { status: "fail", evidence: "No monitoring data." };
			const highRisk = events.filter(e => e.risk.level === "critical" || e.risk.level === "high");
			return { status: highRisk.length > 0 || hasPolicy(policy, src) ? "pass" : "partial", evidence: `${events.length} events monitored. ${highRisk.length} anomalies. Policy: ${hasPolicy(policy, src) ? "active" : "none"}.` };
		}},
		{ id: "A.8.28", name: "Secure Development", evaluate: (events) => {
			const writes = events.filter(e => ["file_write", "file_edit", "file_create"].includes(e.action));
			if (writes.length === 0) return { status: "na", evidence: "No code modifications." };
			return { status: "pass", evidence: `${writes.length} modifications risk-assessed and logged.` };
		}},
	],
};

const EU_AI_ACT: Framework = {
	id: "eu-ai-act", name: "EU AI Act", version: "2024",
	controls: [
		{ id: "Art. 12", name: "Record-Keeping", evaluate: (events, integrity) => {
			if (events.length === 0) return { status: "fail", evidence: "No automatic logging." };
			const hasLifecycle = events.some(e => e.action === "session_start") && events.some(e => e.action === "session_end");
			return { status: hasLifecycle && integrity.chainValid ? "pass" : "partial", evidence: `${events.length} events. Lifecycle: ${hasLifecycle ? "yes" : "no"}. Chain: ${integrity.chainValid ? "valid" : "broken"}.` };
		}},
		{ id: "Art. 13", name: "Transparency", evaluate: (events) => {
			if (events.length === 0) return { status: "na", evidence: "No events." };
			return { status: "pass", evidence: `Full audit trail: action, target, risk, outcome for all ${events.length} events.` };
		}},
		{ id: "Art. 14", name: "Human Oversight", evaluate: (events, _, policy, src) => {
			const denials = events.filter(e => e.status === "denied");
			if (hasPolicy(policy, src) && denials.length > 0) return { status: "pass", evidence: `Human-defined policy enforced. ${denials.length} actions blocked.` };
			if (hasPolicy(policy, src)) return { status: "partial", evidence: "Policy loaded but no denials this period." };
			return { status: "fail", evidence: "No policy — AI operated without human constraints." };
		}},
		{ id: "Art. 19", name: "Automatic Logging", evaluate: (events) => {
			if (events.length === 0) return { status: "fail", evidence: "No automatic logging." };
			const actions = new Set(events.map(e => e.action)).size;
			return { status: "pass", evidence: `${events.length} events, ${actions} action types. All auto-generated by hooks.` };
		}},
	],
};

const FRAMEWORKS: Record<string, Framework> = { soc2: SOC2, iso27001: ISO27001, "eu-ai-act": EU_AI_ACT };

const STATUS_COLORS: Record<string, string> = {
	pass: "var(--green)", fail: "var(--critical)", partial: "var(--medium)", na: "var(--text-muted)",
};
const STATUS_LABELS: Record<string, string> = {
	pass: "PASS", fail: "FAIL", partial: "PARTIAL", na: "N/A",
};

function statusBadge(status: string): string {
	return `<span class="risk" style="background:${STATUS_COLORS[status]}20;color:${STATUS_COLORS[status]}">${STATUS_LABELS[status] || status}</span>`;
}

export function complianceRoutes(store: Store) {
	const app = new Hono();

	app.get("/compliance", (c) => {
		const frameworkId = c.req.query("framework") || "all";
		const events = store.readAll();

		if (events.length === 0) {
			return c.html(layout("Compliance", "/compliance",
				`<div class="empty">No events to evaluate. Run some Claude Code sessions first.</div>`));
		}

		// Integrity
		let integrity = { chainValid: false, chainedEvents: 0, legacyEvents: 0, invalidEvents: 0, sealed: false };
		try {
			const result = verifyChain(events);
			integrity = { ...integrity, chainValid: result.is_valid, chainedEvents: result.chained_events, legacyEvents: result.legacy_events, invalidEvents: result.invalid_schema_events };
		} catch { /* skip */ }

		const sealsPath = join(process.env.HOME || "", ".patchwork", "seals.jsonl");
		integrity.sealed = existsSync(sealsPath);

		// Policy
		let policy: Policy | null = null;
		let policySource = "none";
		try {
			const r = loadActivePolicy();
			policy = r.policy;
			policySource = r.source;
		} catch { /* skip */ }

		// Evaluate
		const fwIds = frameworkId === "all" ? Object.keys(FRAMEWORKS) : [frameworkId];
		const results: Array<{ framework: Framework; controls: Array<{ control: ComplianceControl; result: ControlResult }> }> = [];

		for (const fwId of fwIds) {
			const fw = FRAMEWORKS[fwId];
			if (!fw) continue;
			results.push({
				framework: fw,
				controls: fw.controls.map(ctrl => ({
					control: ctrl,
					result: ctrl.evaluate(events, integrity, policy, policySource),
				})),
			});
		}

		const allResults = results.flatMap(r => r.controls);
		const hasFails = allResults.some(r => r.result.status === "fail");
		const hasPartials = allResults.some(r => r.result.status === "partial");
		const overallGrade = hasFails ? "fail" : hasPartials ? "partial" : "pass";

		const content = `
		<h1>Compliance Report</h1>
		<p class="subtitle">${events.length} events evaluated &middot; Policy: ${esc(policySource)}</p>

		<div class="filter-bar mb-24">
			<select onchange="window.location='/compliance?framework='+this.value">
				<option value="all"${frameworkId === "all" ? " selected" : ""}>All Frameworks</option>
				<option value="soc2"${frameworkId === "soc2" ? " selected" : ""}>SOC 2 Type II</option>
				<option value="iso27001"${frameworkId === "iso27001" ? " selected" : ""}>ISO 27001:2022</option>
				<option value="eu-ai-act"${frameworkId === "eu-ai-act" ? " selected" : ""}>EU AI Act</option>
			</select>
		</div>

		<div class="card-grid mb-24">
			${statCard("Overall", overallGrade.toUpperCase(), STATUS_COLORS[overallGrade])}
			${statCard("Events", events.length)}
			${statCard("Chain", integrity.chainValid ? "VALID" : "BROKEN", integrity.chainValid ? "var(--green)" : "var(--critical)")}
			${statCard("Sealed", integrity.sealed ? "Yes" : "No", integrity.sealed ? "var(--green)" : "var(--text-muted)")}
		</div>

		${results.map(r => {
			const passes = r.controls.filter(c => c.result.status === "pass").length;
			const fails = r.controls.filter(c => c.result.status === "fail").length;
			return `
			<div class="card mb-24">
				<h2>${esc(r.framework.name)} <span style="color:var(--text-dim);font-weight:400">(${r.framework.version})</span></h2>
				<p class="subtitle">${passes} pass, ${fails} fail, ${r.controls.length - passes - fails} other</p>
				<table>
					<thead><tr><th>Control</th><th>Name</th><th>Status</th><th>Evidence</th></tr></thead>
					<tbody>
					${r.controls.map(c => `<tr>
						<td class="mono"><strong>${esc(c.control.id)}</strong></td>
						<td>${esc(c.control.name)}</td>
						<td>${statusBadge(c.result.status)}</td>
						<td style="font-size:13px;color:var(--text-dim)">${esc(c.result.evidence)}</td>
					</tr>`).join("")}
					</tbody>
				</table>
			</div>`;
		}).join("")}

		<div style="text-align:center;margin-top:24px">
			<p style="color:var(--text-muted);font-size:12px">
				For a full printable report with all sections: <code>patchwork report --framework ${frameworkId} -o report.html</code>
			</p>
		</div>`;

		return c.html(layout("Compliance", "/compliance", content));
	});

	return app;
}

function esc(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
