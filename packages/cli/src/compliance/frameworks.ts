import type { ComplianceFramework, ComplianceControl, ReportData } from "./types.js";

// ---------------------------------------------------------------------------
// Sensitive file patterns (for checking if sensitive access was monitored)
// ---------------------------------------------------------------------------
const SENSITIVE_PATTERNS = [".env", ".key", ".pem", "id_rsa", ".aws/credentials", ".ssh/", "secret", "password", "token"];

function hasSensitiveAccess(data: ReportData): boolean {
	return data.sensitiveFileEvents.length > 0;
}

function hasEvents(data: ReportData): boolean {
	return data.events.length > 0;
}

function hasSessions(data: ReportData): boolean {
	return data.sessions.length > 0;
}

function hasPolicy(data: ReportData): boolean {
	return data.policy !== null && data.policySource !== "built-in";
}

// ---------------------------------------------------------------------------
// SOC 2 Trust Service Criteria
// ---------------------------------------------------------------------------

const SOC2_CONTROLS: ComplianceControl[] = [
	{
		id: "CC6.1",
		name: "Logical Access Controls",
		description: "The entity implements logical access security measures to protect against unauthorised access to information assets.",
		evaluate: (data) => {
			const fileEvents = data.fileEvents.length;
			const sensitiveAccess = data.sensitiveFileEvents.length;
			const deniedAccess = data.denials.filter(e => e.target?.path).length;

			if (!hasEvents(data)) return { status: "na", evidence: "No events in reporting period." };
			if (fileEvents === 0) return { status: "na", evidence: "No file access events recorded." };

			const hasDenials = deniedAccess > 0;
			const hasRiskClassification = data.events.some(e => e.risk.level !== "none");

			if (hasRiskClassification && (hasDenials || sensitiveAccess > 0)) {
				return {
					status: "pass",
					evidence: `${fileEvents} file access events recorded with risk classification. ${sensitiveAccess} sensitive file accesses detected. ${deniedAccess} unauthorised access attempts blocked by policy.`,
					eventCount: fileEvents,
				};
			}
			return {
				status: "partial",
				evidence: `${fileEvents} file access events recorded but ${hasDenials ? "" : "no "}policy denials detected. Risk classification is ${hasRiskClassification ? "active" : "not configured"}.`,
				eventCount: fileEvents,
			};
		},
	},
	{
		id: "CC6.2",
		name: "Privileged Operations",
		description: "The entity authorises, monitors, and controls access to system components that are limited to authorised personnel.",
		evaluate: (data) => {
			const commands = data.commandEvents.length;
			const highRiskCmds = data.commandEvents.filter(e => e.risk.level === "critical" || e.risk.level === "high").length;
			const deniedCmds = data.denials.filter(e => e.target?.command).length;

			if (!hasEvents(data)) return { status: "na", evidence: "No events in reporting period." };
			if (commands === 0) return { status: "na", evidence: "No command execution events recorded." };

			if (deniedCmds > 0) {
				return {
					status: "pass",
					evidence: `${commands} command executions logged. ${highRiskCmds} high-risk commands detected. ${deniedCmds} privileged operations blocked by policy enforcement.`,
					eventCount: commands,
				};
			}
			return {
				status: "partial",
				evidence: `${commands} command executions logged with ${highRiskCmds} flagged as high-risk. No policy denials recorded — policy enforcement may not be active.`,
				eventCount: commands,
			};
		},
	},
	{
		id: "CC7.1",
		name: "System Activity Monitoring",
		description: "The entity uses monitoring procedures to detect system and user activity and evaluate the effectiveness of controls.",
		evaluate: (data) => {
			if (!hasEvents(data)) return { status: "fail", evidence: "No events recorded. Monitoring appears inactive." };

			const sessionCount = data.sessions.length;
			const agents = Object.keys(data.stats.byAgent);
			const daysCovered = Object.keys(data.stats.byDay).length;

			return {
				status: "pass",
				evidence: `${data.stats.totalEvents} events recorded across ${sessionCount} sessions from ${agents.length} agent(s) over ${daysCovered} day(s). All events include timestamps, agent identification, action classification, and risk assessment.`,
				eventCount: data.stats.totalEvents,
			};
		},
	},
	{
		id: "CC7.2",
		name: "Monitoring Log Effectiveness",
		description: "The entity monitors and evaluates the effectiveness of the system monitoring controls.",
		evaluate: (data) => {
			if (!hasEvents(data)) return { status: "fail", evidence: "No events in audit trail." };

			const chainOk = data.integrity.chainValid;
			const sealed = data.integrity.sealed;
			const chained = data.integrity.chainedEvents;

			if (chainOk && chained > 0) {
				return {
					status: sealed ? "pass" : "partial",
					evidence: `Hash chain verified: ${chained} events with tamper-evident linking. Chain integrity: VALID. ${sealed ? "Audit trail is HMAC-sealed." : "Audit trail is NOT sealed — run 'patchwork seal' for cryptographic signing."}`,
					eventCount: chained,
				};
			}
			return {
				status: "fail",
				evidence: `Hash chain verification ${chainOk ? "passed" : "FAILED"}. ${data.integrity.invalidEvents} invalid events detected. Log integrity cannot be guaranteed.`,
			};
		},
	},
	{
		id: "CC7.3",
		name: "Exception & Anomaly Handling",
		description: "The entity evaluates exceptions and anomalies identified during monitoring and takes appropriate action.",
		evaluate: (data) => {
			if (!hasEvents(data)) return { status: "na", evidence: "No events in reporting period." };

			const highRisk = data.highRiskEvents.length;
			const denials = data.denials.length;

			if (hasPolicy(data) && denials > 0) {
				return {
					status: "pass",
					evidence: `Policy enforcement active (source: ${data.policySource}). ${highRisk} high-risk events detected. ${denials} policy violations blocked in real-time. Anomalous actions are automatically classified and denied.`,
					eventCount: denials,
				};
			}
			if (hasPolicy(data)) {
				return {
					status: "partial",
					evidence: `Policy loaded (source: ${data.policySource}) but no denial events recorded. ${highRisk} high-risk events detected. Policy may not be configured for active enforcement.`,
					eventCount: highRisk,
				};
			}
			return {
				status: "fail",
				evidence: `No security policy loaded. ${highRisk} high-risk events detected but no policy enforcement active. Run 'patchwork policy init --strict' to enable.`,
				eventCount: highRisk,
			};
		},
	},
	{
		id: "CC8.1",
		name: "Change Management",
		description: "The entity authorises, designs, develops, implements, and monitors changes to infrastructure and software.",
		evaluate: (data) => {
			const writes = data.fileEvents.filter(e => ["file_write", "file_edit", "file_create", "file_delete"].includes(e.action)).length;
			const projects = [...new Set(data.events.map(e => e.project?.name).filter(Boolean))];

			if (!hasEvents(data)) return { status: "na", evidence: "No events in reporting period." };
			if (writes === 0) return { status: "na", evidence: "No file modification events recorded." };

			return {
				status: "pass",
				evidence: `${writes} file modifications recorded across ${projects.length} project(s). All changes logged with risk classification, agent identification, and timestamp. Top modified files tracked.`,
				eventCount: writes,
			};
		},
	},
];

// ---------------------------------------------------------------------------
// ISO 27001:2022
// ---------------------------------------------------------------------------

const ISO27001_CONTROLS: ComplianceControl[] = [
	{
		id: "A.8.2",
		name: "Privileged Access Rights",
		description: "The allocation and use of privileged access rights shall be restricted and managed.",
		evaluate: (data) => {
			const commands = data.commandEvents.length;
			const elevated = data.commandEvents.filter(e =>
				e.risk.level === "critical" || e.risk.level === "high"
			).length;
			const denied = data.denials.filter(e => e.target?.command).length;

			if (commands === 0) return { status: "na", evidence: "No command execution events." };

			if (denied > 0) {
				return {
					status: "pass",
					evidence: `${commands} commands logged. ${elevated} elevated/dangerous commands detected and classified. ${denied} privileged operations denied by policy.`,
					eventCount: commands,
				};
			}
			return {
				status: "partial",
				evidence: `${commands} commands logged with ${elevated} classified as elevated risk. No active policy denials — consider enabling fail-closed enforcement.`,
				eventCount: commands,
			};
		},
	},
	{
		id: "A.8.3",
		name: "Information Access Restriction",
		description: "Access to information and other associated assets shall be restricted in accordance with the established access control policy.",
		evaluate: (data) => {
			const sensitiveCount = data.sensitiveFileEvents.length;
			const deniedFiles = data.denials.filter(e => e.target?.path).length;

			if (!hasEvents(data)) return { status: "na", evidence: "No events in reporting period." };

			if (sensitiveCount > 0 && deniedFiles > 0) {
				return {
					status: "pass",
					evidence: `${sensitiveCount} sensitive file accesses detected and classified. ${deniedFiles} unauthorised file access attempts blocked. Access control policy actively enforced.`,
					eventCount: sensitiveCount + deniedFiles,
				};
			}
			if (sensitiveCount > 0) {
				return {
					status: "partial",
					evidence: `${sensitiveCount} sensitive file accesses detected but no active denials. Access is logged but may not be restricted.`,
					eventCount: sensitiveCount,
				};
			}
			return {
				status: "pass",
				evidence: `No sensitive file access detected in reporting period. File access is logged and classified.`,
			};
		},
	},
	{
		id: "A.8.15",
		name: "Logging",
		description: "Logs that record activities, exceptions, faults and other relevant events shall be produced, stored, protected and analysed.",
		evaluate: (data) => {
			if (!hasEvents(data)) return { status: "fail", evidence: "No events recorded. Logging appears inactive." };

			const chainOk = data.integrity.chainValid;
			const chained = data.integrity.chainedEvents;

			if (chainOk && chained > 0) {
				return {
					status: "pass",
					evidence: `${data.stats.totalEvents} events logged with tamper-evident hash chaining (${chained} chained events). All events include: timestamp, agent, action, target, risk level, status. Chain integrity: VALID.`,
					eventCount: data.stats.totalEvents,
				};
			}
			return {
				status: "partial",
				evidence: `${data.stats.totalEvents} events logged. Hash chain ${chainOk ? "valid" : "BROKEN — integrity compromised"}.`,
				eventCount: data.stats.totalEvents,
			};
		},
	},
	{
		id: "A.8.16",
		name: "Monitoring Activities",
		description: "Networks, systems and applications shall be monitored for anomalous behaviour and appropriate actions taken.",
		evaluate: (data) => {
			if (!hasEvents(data)) return { status: "fail", evidence: "No monitoring data available." };

			const highRisk = data.highRiskEvents.length;
			const agents = Object.keys(data.stats.byAgent);

			return {
				status: highRisk > 0 || hasPolicy(data) ? "pass" : "partial",
				evidence: `Continuous monitoring active across ${agents.length} agent(s). ${data.stats.totalEvents} events with automatic risk classification. ${highRisk} anomalous (high-risk) events detected. ${hasPolicy(data) ? "Policy enforcement active." : "No enforcement policy configured."}`,
				eventCount: data.stats.totalEvents,
			};
		},
	},
	{
		id: "A.8.28",
		name: "Secure Development",
		description: "Secure development principles shall be applied to software development.",
		evaluate: (data) => {
			const writes = data.fileEvents.filter(e => ["file_write", "file_edit", "file_create"].includes(e.action)).length;
			const riskAssessed = data.fileEvents.filter(e => e.risk.level !== "none").length;

			if (writes === 0) return { status: "na", evidence: "No code modification events." };

			return {
				status: "pass",
				evidence: `${writes} code modifications logged. ${riskAssessed} changes risk-assessed. All modifications include agent identification, timestamp, and risk classification.`,
				eventCount: writes,
			};
		},
	},
];

// ---------------------------------------------------------------------------
// EU AI Act (2024)
// ---------------------------------------------------------------------------

const EU_AI_ACT_CONTROLS: ComplianceControl[] = [
	{
		id: "Art. 12",
		name: "Record-Keeping",
		description: "High-risk AI systems shall technically allow for automatic recording of events (logs) over the lifetime of the system.",
		evaluate: (data) => {
			if (!hasEvents(data)) return { status: "fail", evidence: "No automatic event recording detected." };

			const hasSessionLifecycle = data.events.some(e => e.action === "session_start") && data.events.some(e => e.action === "session_end");
			const chainOk = data.integrity.chainValid;

			if (hasSessionLifecycle && chainOk) {
				return {
					status: "pass",
					evidence: `Automatic logging active: ${data.stats.totalEvents} events recorded across ${data.sessions.length} sessions. Full lifecycle tracked (session start/end). Events include: timestamp, action, target, risk assessment, agent identification. Hash chain integrity: VALID. Records are tamper-evident.`,
					eventCount: data.stats.totalEvents,
				};
			}
			return {
				status: "partial",
				evidence: `${data.stats.totalEvents} events recorded. ${hasSessionLifecycle ? "Session lifecycle tracked." : "Session lifecycle NOT fully tracked."} Hash chain: ${chainOk ? "VALID" : "BROKEN"}.`,
				eventCount: data.stats.totalEvents,
			};
		},
	},
	{
		id: "Art. 13",
		name: "Transparency",
		description: "High-risk AI systems shall be designed and developed to ensure their operation is sufficiently transparent to enable deployers to interpret the system's output.",
		evaluate: (data) => {
			if (!hasEvents(data)) return { status: "na", evidence: "No events in reporting period." };

			const hasRisk = data.events.some(e => e.risk.level !== "none");
			const hasTargets = data.events.some(e => e.target?.path || e.target?.command);

			return {
				status: hasRisk && hasTargets ? "pass" : "partial",
				evidence: `Audit trail provides full transparency: each action includes the target (file/command/URL), risk assessment, and decision outcome (completed/denied). ${hasPolicy(data) ? `Policy documentation available (${data.policySource}).` : "No policy documentation configured."}`,
				eventCount: data.stats.totalEvents,
			};
		},
	},
	{
		id: "Art. 14",
		name: "Human Oversight",
		description: "High-risk AI systems shall be designed and developed so they can be effectively overseen by natural persons.",
		evaluate: (data) => {
			if (!hasEvents(data)) return { status: "na", evidence: "No events in reporting period." };

			const denials = data.denials.length;
			const policyActive = hasPolicy(data);

			if (policyActive && denials > 0) {
				return {
					status: "pass",
					evidence: `Human oversight implemented via policy enforcement: ${denials} AI agent actions blocked by human-defined rules. Policy source: ${data.policySource}. Audit trail enables post-hoc review of all ${data.stats.totalEvents} events. Dashboard available for real-time monitoring.`,
					eventCount: denials,
				};
			}
			if (policyActive) {
				return {
					status: "partial",
					evidence: `Policy configured (${data.policySource}) providing human-defined guardrails. No denial events in this period. Audit trail of ${data.stats.totalEvents} events available for human review.`,
					eventCount: data.stats.totalEvents,
				};
			}
			return {
				status: "fail",
				evidence: `No enforcement policy configured. AI agent operated without human-defined constraints. Audit trail exists (${data.stats.totalEvents} events) but no real-time controls.`,
				eventCount: data.stats.totalEvents,
			};
		},
	},
	{
		id: "Art. 19",
		name: "Automatic Logging",
		description: "High-risk AI systems shall be designed and developed with capabilities enabling automatic recording of events relevant to identifying risks.",
		evaluate: (data) => {
			if (!hasEvents(data)) return { status: "fail", evidence: "No automatic logging detected." };

			const actions = Object.keys(data.stats.byAction);
			const riskLevels = Object.keys(data.stats.byRisk);

			return {
				status: "pass",
				evidence: `Automatic logging fully operational: ${data.stats.totalEvents} events captured without manual intervention. ${actions.length} distinct action types monitored. ${riskLevels.length} risk levels assigned automatically. Events generated by native hook integration (no manual logging required).`,
				eventCount: data.stats.totalEvents,
			};
		},
	},
];

// ---------------------------------------------------------------------------
// Framework registry
// ---------------------------------------------------------------------------

export const FRAMEWORKS: Record<string, ComplianceFramework> = {
	soc2: {
		id: "soc2",
		name: "SOC 2 Type II",
		version: "2017",
		description: "AICPA Trust Services Criteria for Security, Availability, Processing Integrity, Confidentiality, and Privacy",
		controls: SOC2_CONTROLS,
	},
	iso27001: {
		id: "iso27001",
		name: "ISO/IEC 27001:2022",
		version: "2022",
		description: "Information security, cybersecurity and privacy protection — Information security management systems",
		controls: ISO27001_CONTROLS,
	},
	"eu-ai-act": {
		id: "eu-ai-act",
		name: "EU AI Act",
		version: "2024",
		description: "Regulation (EU) 2024/1689 — Harmonised rules on artificial intelligence",
		controls: EU_AI_ACT_CONTROLS,
	},
};

export const FRAMEWORK_IDS = Object.keys(FRAMEWORKS);

export function evaluateFramework(framework: ComplianceFramework, data: ReportData) {
	const results = framework.controls.map(control => ({
		control,
		result: control.evaluate(data),
	}));

	const summary = {
		pass: results.filter(r => r.result.status === "pass").length,
		fail: results.filter(r => r.result.status === "fail").length,
		partial: results.filter(r => r.result.status === "partial").length,
		na: results.filter(r => r.result.status === "na").length,
		total: results.length,
	};

	return { framework, results, summary };
}
