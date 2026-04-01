import type { ComplianceFramework, ComplianceControl, ReportData, ComplianceGap, ComplianceTrend, TrendWindow, ControlStatus, FrameworkReport } from "./types.js";

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
// GDPR (EU General Data Protection Regulation)
// ---------------------------------------------------------------------------

const GDPR_CONTROLS: ComplianceControl[] = [
	{
		id: "Art. 5",
		name: "Lawfulness, Fairness, Transparency",
		description: "Personal data shall be processed lawfully, fairly and in a transparent manner.",
		evaluate: (data) => {
			if (!hasEvents(data)) return { status: "fail", evidence: "No processing records." };
			const hasTimestamps = data.events.every(e => e.timestamp);
			const policyActive = hasPolicy(data);
			const ids = data.events.map(e => e.id);
			return {
				status: hasTimestamps && policyActive ? "pass" : "partial",
				evidence: `${data.stats.totalEvents} processing events logged. Timestamps: ${hasTimestamps ? "complete" : "incomplete"}. Processing purpose documented: ${policyActive ? "yes (policy active)" : "no policy — processing purpose undocumented"}.`,
				eventCount: data.stats.totalEvents,
				linkedEvents: ids.slice(0, 50),
			};
		},
	},
	{
		id: "Art. 28",
		name: "Data Processor Compliance",
		description: "Controller shall use only processors providing sufficient guarantees. Sub-processors must be documented.",
		evaluate: (data) => {
			const subprocessors = new Set<string>();
			const subprocessorEvents: string[] = [];
			for (const e of data.events) {
				if (e.action === "mcp_tool_call" && e.target?.tool_name) {
					subprocessors.add(e.target.tool_name);
					subprocessorEvents.push(e.id);
				}
				if ((e.action === "web_fetch" || e.action === "web_search") && e.target?.url) {
					try { subprocessors.add(new URL(e.target.url).hostname); } catch {}
					subprocessorEvents.push(e.id);
				}
			}
			if (subprocessors.size === 0) return { status: "na", evidence: "No external processors accessed.", linkedEvents: [] };
			return {
				status: "pass",
				evidence: `${subprocessors.size} external processor(s) identified and logged: ${Array.from(subprocessors).slice(0, 10).join(", ")}. All access events recorded with timestamps.`,
				eventCount: subprocessorEvents.length,
				linkedEvents: subprocessorEvents.slice(0, 50),
			};
		},
	},
	{
		id: "Art. 32",
		name: "Security of Processing",
		description: "Implement appropriate technical and organisational measures to ensure security of processing.",
		evaluate: (data) => {
			if (!hasEvents(data)) return { status: "fail", evidence: "No security measures observable." };
			const hasChain = data.integrity.chainValid;
			const hasDenials = data.denials.length > 0;
			const policyActive = hasPolicy(data);
			return {
				status: hasChain && policyActive ? "pass" : "partial",
				evidence: `Audit trail integrity: ${hasChain ? "VALID (hash-chained)" : "unverified"}. Access control: ${policyActive ? "policy active" : "no policy"}. ${hasDenials ? `${data.denials.length} unauthorised access attempts blocked.` : "No access violations detected."}`,
				eventCount: data.stats.totalEvents,
				linkedEvents: data.denials.map(e => e.id).slice(0, 50),
			};
		},
	},
	{
		id: "Art. 34",
		name: "Communication of Breach to Data Subject",
		description: "Where a breach is likely to result in high risk, the controller shall communicate the breach to the data subject.",
		evaluate: (data) => {
			const criticalEvents = data.events.filter(e => e.risk.level === "critical");
			const denials = data.denials;
			if (criticalEvents.length === 0 && denials.length === 0) {
				return { status: "pass", evidence: "No breach indicators detected. Zero critical events, zero policy violations.", linkedEvents: [] };
			}
			return {
				status: denials.length > 0 ? "pass" : "partial",
				evidence: `${criticalEvents.length} critical events detected. ${denials.length} blocked by policy. Breach indicators are logged and classifiable for notification assessment.`,
				eventCount: criticalEvents.length + denials.length,
				linkedEvents: [...criticalEvents, ...denials].map(e => e.id).slice(0, 50),
			};
		},
	},
];

// ---------------------------------------------------------------------------
// NIST AI Risk Management Framework (NIST AI RMF 1.0)
// ---------------------------------------------------------------------------

const NIST_AI_RMF_CONTROLS: ComplianceControl[] = [
	{
		id: "GOVERN-1.1",
		name: "Risk Mapping",
		description: "AI risks are identified, classified, and mapped to organisational risk management processes.",
		evaluate: (data) => {
			if (!hasEvents(data)) return { status: "fail", evidence: "No events to assess risk." };
			const riskMapped = data.events.filter(e => e.risk.level !== "none");
			const pct = ((riskMapped.length / data.events.length) * 100).toFixed(1);
			return {
				status: riskMapped.length === data.events.length ? "pass" : riskMapped.length > 0 ? "partial" : "fail",
				evidence: `${riskMapped.length}/${data.events.length} events (${pct}%) have risk classification. Risk levels: ${Object.entries(data.stats.byRisk).map(([k, v]) => `${k}=${v}`).join(", ")}.`,
				eventCount: riskMapped.length,
				linkedEvents: riskMapped.map(e => e.id).slice(0, 50),
			};
		},
	},
	{
		id: "MAP-1.1",
		name: "Data Governance",
		description: "Data used by AI systems is traceable and governed throughout its lifecycle.",
		evaluate: (data) => {
			const dataEvents = data.events.filter(e => ["file_read", "file_write", "file_create", "web_fetch"].includes(e.action));
			const withHash = dataEvents.filter(e => e.content?.hash);
			if (dataEvents.length === 0) return { status: "na", evidence: "No data access events." };
			return {
				status: withHash.length > 0 ? "pass" : "partial",
				evidence: `${dataEvents.length} data access events. ${withHash.length} have content provenance (SHA-256 hash). Data lineage tracked via hash chain.`,
				eventCount: dataEvents.length,
				linkedEvents: dataEvents.map(e => e.id).slice(0, 50),
			};
		},
	},
	{
		id: "MEASURE-1.1",
		name: "Performance Monitoring",
		description: "AI system performance is monitored for anomalies and degradation.",
		evaluate: (data) => {
			if (!hasEvents(data)) return { status: "fail", evidence: "No monitoring data." };
			const anomalies = data.highRiskEvents;
			return {
				status: anomalies.length > 0 || hasPolicy(data) ? "pass" : "partial",
				evidence: `Continuous monitoring active: ${data.stats.totalEvents} events across ${data.sessions.length} sessions. ${anomalies.length} anomalous (high-risk) events detected and classified. ${hasPolicy(data) ? "Policy enforcement active." : "No enforcement policy."}`,
				eventCount: anomalies.length,
				linkedEvents: anomalies.map(e => e.id).slice(0, 50),
			};
		},
	},
	{
		id: "MANAGE-1.1",
		name: "Risk Mitigation",
		description: "Identified AI risks are mitigated through controls, policies, and human oversight.",
		evaluate: (data) => {
			const denials = data.denials;
			const policyActive = hasPolicy(data);
			if (!hasEvents(data)) return { status: "fail", evidence: "No events." };
			if (policyActive && denials.length > 0) {
				return { status: "pass", evidence: `Policy enforcement active (${data.policySource}). ${denials.length} risky actions mitigated by automatic denial. Human-defined risk thresholds enforced.`, eventCount: denials.length, linkedEvents: denials.map(e => e.id).slice(0, 50) };
			}
			if (policyActive) {
				return { status: "partial", evidence: `Policy loaded (${data.policySource}) but no denial events. Risk mitigation controls defined but not triggered.`, linkedEvents: [] };
			}
			return { status: "fail", evidence: "No risk mitigation policy configured. AI system operates without guardrails.", linkedEvents: [] };
		},
	},
];

// ---------------------------------------------------------------------------
// HIPAA (US Health Insurance Portability and Accountability Act)
// ---------------------------------------------------------------------------

const HIPAA_CONTROLS: ComplianceControl[] = [
	{
		id: "§164.312(a)(2)",
		name: "Access Controls",
		description: "Implement technical policies to allow access only to authorised persons or software programs.",
		evaluate: (data) => {
			const phiPatterns = ["health", "patient", "medical", "ssn", "mrn", "phi", "hipaa", "ehr", "emr"];
			const phiEvents = data.events.filter(e => e.target?.path && phiPatterns.some(p => e.target!.path!.toLowerCase().includes(p)));
			const deniedAccess = data.denials.filter(e => e.target?.path);
			const allFileEvents = data.fileEvents;
			if (allFileEvents.length === 0) return { status: "na", evidence: "No file access events.", linkedEvents: [] };
			return {
				status: deniedAccess.length > 0 ? "pass" : phiEvents.length > 0 ? "partial" : "pass",
				evidence: `${allFileEvents.length} file access events logged. ${phiEvents.length} potential PHI-related accesses detected. ${deniedAccess.length} unauthorised access attempts blocked. All access includes agent identification and timestamps.`,
				eventCount: allFileEvents.length,
				linkedEvents: [...phiEvents, ...deniedAccess].map(e => e.id).slice(0, 50),
			};
		},
	},
	{
		id: "§164.312(b)",
		name: "Audit Controls",
		description: "Implement hardware, software, and/or procedural mechanisms to record and examine activity.",
		evaluate: (data) => {
			if (!hasEvents(data)) return { status: "fail", evidence: "No audit trail.", linkedEvents: [] };
			const hasChain = data.integrity.chainValid;
			return {
				status: hasChain ? "pass" : "partial",
				evidence: `Complete audit trail: ${data.stats.totalEvents} events with ${data.integrity.chainedEvents} hash-chained entries. Chain integrity: ${hasChain ? "VALID" : "BROKEN"}. All events timestamped with agent identification, action type, target, and risk level.`,
				eventCount: data.stats.totalEvents,
				linkedEvents: data.events.map(e => e.id).slice(0, 50),
			};
		},
	},
	{
		id: "§164.308(a)(5)(ii)",
		name: "Unique User Identification",
		description: "Assign a unique identifier to each user or software program accessing ePHI.",
		evaluate: (data) => {
			if (!hasEvents(data)) return { status: "na", evidence: "No events.", linkedEvents: [] };
			const agents = Object.keys(data.stats.byAgent);
			const allIdentified = data.events.every(e => e.agent && e.session_id);
			return {
				status: allIdentified ? "pass" : "partial",
				evidence: `${agents.length} distinct agent(s) identified: ${agents.join(", ")}. All ${data.stats.totalEvents} events include unique agent identifier and session ID. ${allIdentified ? "100% identification coverage." : "Some events missing agent identification."}`,
				eventCount: data.stats.totalEvents,
				linkedEvents: data.events.map(e => e.id).slice(0, 20),
			};
		},
	},
	{
		id: "§164.312(a)(2)(i)",
		name: "Access Management",
		description: "Implement policies and procedures for granting, reviewing, and revoking access.",
		evaluate: (data) => {
			const denials = data.denials;
			const policyActive = hasPolicy(data);
			if (!hasEvents(data)) return { status: "na", evidence: "No events.", linkedEvents: [] };
			if (policyActive && denials.length > 0) {
				return { status: "pass", evidence: `Access management via policy enforcement (${data.policySource}). ${denials.length} unauthorised access attempts blocked. Policy defines allowed/denied operations.`, eventCount: denials.length, linkedEvents: denials.map(e => e.id).slice(0, 50) };
			}
			return {
				status: policyActive ? "partial" : "fail",
				evidence: policyActive ? `Policy configured but no denials in period. Access management defined but not triggered.` : `No access management policy. All actions permitted without review.`,
				linkedEvents: [],
			};
		},
	},
];

// ---------------------------------------------------------------------------
// PCI DSS (Payment Card Industry Data Security Standard)
// ---------------------------------------------------------------------------

const PCI_DSS_CONTROLS: ComplianceControl[] = [
	{
		id: "Req. 2.1",
		name: "Change Defaults",
		description: "Always change vendor-supplied defaults and remove or disable unnecessary default accounts.",
		evaluate: (data) => {
			const configPatterns = ["config", "package.json", "tsconfig", "dockerfile", ".yml", ".yaml", ".toml", ".ini", ".conf"];
			const configChanges = data.events.filter(e =>
				["file_write", "file_edit", "file_create"].includes(e.action) &&
				e.target?.path && configPatterns.some(p => e.target!.path!.toLowerCase().includes(p))
			);
			if (configChanges.length === 0) return { status: "na", evidence: "No configuration changes detected.", linkedEvents: [] };
			return {
				status: "pass",
				evidence: `${configChanges.length} configuration file changes logged and risk-assessed. All modifications tracked with agent ID, timestamp, and content hash.`,
				eventCount: configChanges.length,
				linkedEvents: configChanges.map(e => e.id).slice(0, 50),
			};
		},
	},
	{
		id: "Req. 7",
		name: "Restrict Access",
		description: "Restrict access to cardholder data and system components to only those individuals whose job requires such access.",
		evaluate: (data) => {
			const denials = data.denials;
			const sensitiveAccess = data.sensitiveFileEvents;
			if (!hasEvents(data)) return { status: "na", evidence: "No access events.", linkedEvents: [] };
			if (denials.length > 0) {
				return { status: "pass", evidence: `Access restricted via policy enforcement. ${sensitiveAccess.length} sensitive file accesses logged. ${denials.length} unauthorised accesses blocked.`, eventCount: denials.length + sensitiveAccess.length, linkedEvents: [...denials, ...sensitiveAccess].map(e => e.id).slice(0, 50) };
			}
			return {
				status: sensitiveAccess.length > 0 ? "partial" : "pass",
				evidence: `${data.fileEvents.length} file accesses logged. ${sensitiveAccess.length} sensitive accesses detected. ${denials.length} blocked.`,
				eventCount: data.fileEvents.length,
				linkedEvents: data.fileEvents.map(e => e.id).slice(0, 50),
			};
		},
	},
	{
		id: "Req. 10",
		name: "Logging and Monitoring",
		description: "Log and monitor all access to system components and cardholder data.",
		evaluate: (data) => {
			if (!hasEvents(data)) return { status: "fail", evidence: "No logging active.", linkedEvents: [] };
			const allTimestamped = data.events.every(e => e.timestamp && e.agent);
			const hasChain = data.integrity.chainValid;
			return {
				status: allTimestamped && hasChain ? "pass" : "partial",
				evidence: `${data.stats.totalEvents} events logged. Timestamps: ${allTimestamped ? "complete" : "incomplete"}. Hash chain: ${hasChain ? "VALID" : "BROKEN"}. Covers: file access, commands, network, MCP tools.`,
				eventCount: data.stats.totalEvents,
				linkedEvents: data.events.map(e => e.id).slice(0, 50),
			};
		},
	},
	{
		id: "Req. 12",
		name: "Security Policy",
		description: "Maintain a policy that addresses information security for all personnel.",
		evaluate: (data) => {
			const policyActive = hasPolicy(data);
			const denials = data.denials;
			if (policyActive && denials.length > 0) {
				return { status: "pass", evidence: `Security policy active (${data.policySource}). ${denials.length} policy violations detected and blocked. Policy defines file, command, network, and MCP rules.`, eventCount: denials.length, linkedEvents: denials.map(e => e.id).slice(0, 50) };
			}
			if (policyActive) {
				return { status: "partial", evidence: `Policy configured (${data.policySource}) but no violations in period. Policy enforcement is operational.`, linkedEvents: [] };
			}
			return { status: "fail", evidence: "No security policy configured. AI agent operates without defined security rules.", linkedEvents: [] };
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
	gdpr: {
		id: "gdpr",
		name: "GDPR",
		version: "2018",
		description: "EU General Data Protection Regulation — Data processing, security, and breach notification",
		controls: GDPR_CONTROLS,
	},
	"nist-ai-rmf": {
		id: "nist-ai-rmf",
		name: "NIST AI RMF",
		version: "1.0",
		description: "NIST Artificial Intelligence Risk Management Framework",
		controls: NIST_AI_RMF_CONTROLS,
	},
	hipaa: {
		id: "hipaa",
		name: "HIPAA",
		version: "2013",
		description: "US Health Insurance Portability and Accountability Act — Security and privacy of health information",
		controls: HIPAA_CONTROLS,
	},
	"pci-dss": {
		id: "pci-dss",
		name: "PCI DSS",
		version: "4.0",
		description: "Payment Card Industry Data Security Standard",
		controls: PCI_DSS_CONTROLS,
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

// ---------------------------------------------------------------------------
// Gap analysis
// ---------------------------------------------------------------------------

const REMEDIATIONS: Record<string, { remediation: string; effort: "minutes" | "hours" | "days" }> = {
	"CC6.1": { remediation: "Configure file deny rules in policy.yml for sensitive paths.", effort: "minutes" },
	"CC6.2": { remediation: "Add command deny rules (sudo, rm -rf) to policy.yml.", effort: "minutes" },
	"CC7.1": { remediation: "Run Claude Code sessions — events are recorded automatically.", effort: "minutes" },
	"CC7.2": { remediation: "Run 'patchwork seal' to HMAC-sign the audit trail.", effort: "minutes" },
	"CC7.3": { remediation: "Run 'patchwork policy init --strict' to enable policy enforcement.", effort: "minutes" },
	"CC8.1": { remediation: "Use AI agent to make code changes — modifications are tracked automatically.", effort: "minutes" },
	"A.8.2": { remediation: "Add command deny rules for elevated operations.", effort: "minutes" },
	"A.8.3": { remediation: "Configure sensitive file patterns in policy.yml.", effort: "minutes" },
	"A.8.15": { remediation: "Ensure hooks are installed: patchwork init claude-code --strict-profile.", effort: "minutes" },
	"A.8.16": { remediation: "Enable fail-closed mode and webhook alerts.", effort: "hours" },
	"A.8.28": { remediation: "Integrate SAST scanner and track code review events.", effort: "days" },
	"Art. 12": { remediation: "Verify hooks record session start/end. Run 'patchwork verify'.", effort: "minutes" },
	"Art. 13": { remediation: "Document policy rules with reason fields for transparency.", effort: "hours" },
	"Art. 14": { remediation: "Configure policy.yml with human-defined constraints.", effort: "hours" },
	"Art. 19": { remediation: "Ensure hooks are installed — logging is automatic.", effort: "minutes" },
	"Art. 5": { remediation: "Configure policy.yml to document processing purposes.", effort: "hours" },
	"Art. 28": { remediation: "MCP tools and web access are logged automatically when hooks are active.", effort: "minutes" },
	"Art. 32": { remediation: "Run 'patchwork seal' and configure strict policy.", effort: "minutes" },
	"Art. 34": { remediation: "Enable webhook alerts (PATCHWORK_WEBHOOK_URL) for breach notification.", effort: "hours" },
	"GOVERN-1.1": { remediation: "Risk classification is automatic — ensure hooks are installed.", effort: "minutes" },
	"MAP-1.1": { remediation: "Content hashing is automatic for all file operations.", effort: "minutes" },
	"MEASURE-1.1": { remediation: "Enable policy and webhook alerts for anomaly detection.", effort: "hours" },
	"MANAGE-1.1": { remediation: "Run 'patchwork policy init --strict' for risk mitigation.", effort: "minutes" },
	"§164.312(a)(2)": { remediation: "Add PHI-related file patterns to policy deny rules.", effort: "hours" },
	"§164.312(b)": { remediation: "Ensure hooks are installed and hash chain is valid.", effort: "minutes" },
	"§164.308(a)(5)(ii)": { remediation: "Agent identification is automatic — no action needed.", effort: "minutes" },
	"§164.312(a)(2)(i)": { remediation: "Configure access deny rules in policy.yml.", effort: "hours" },
	"Req. 2.1": { remediation: "Configuration changes are tracked automatically.", effort: "minutes" },
	"Req. 7": { remediation: "Add file deny rules for sensitive data paths.", effort: "minutes" },
	"Req. 10": { remediation: "Ensure hooks are installed: patchwork init claude-code.", effort: "minutes" },
	"Req. 12": { remediation: "Run 'patchwork policy init --strict' to create security policy.", effort: "minutes" },
};

export function generateGaps(frameworkReports: FrameworkReport[]): ComplianceGap[] {
	const gaps: ComplianceGap[] = [];
	for (const fw of frameworkReports) {
		for (const r of fw.results) {
			if (r.result.status === "fail" || r.result.status === "na") {
				const rem = REMEDIATIONS[r.control.id] || { remediation: "Review control requirements and enable missing capabilities.", effort: "hours" as const };
				gaps.push({
					frameworkId: fw.framework.id,
					controlId: r.control.id,
					controlName: r.control.name,
					reason: r.result.evidence,
					remediation: rem.remediation,
					effort: rem.effort,
				});
			}
		}
	}
	return gaps;
}

// ---------------------------------------------------------------------------
// Compliance trends
// ---------------------------------------------------------------------------

export function generateTrends(
	data: ReportData,
	frameworkReports: FrameworkReport[],
	period: "daily" | "weekly" | "monthly" = "daily",
): ComplianceTrend[] {
	// Group events by time window
	const periodMs = period === "daily" ? 86400000 : period === "weekly" ? 604800000 : 2592000000;
	const start = data.periodStart.getTime();
	const end = data.periodEnd.getTime();

	return frameworkReports.map(fw => {
		const windows: TrendWindow[] = [];
		let windowStart = start;

		while (windowStart < end) {
			const windowEnd = Math.min(windowStart + periodMs, end);
			const windowEvents = data.events.filter(e => {
				const t = new Date(e.timestamp).getTime();
				return t >= windowStart && t < windowEnd;
			});

			// Build minimal ReportData for this window
			const windowData: ReportData = {
				...data,
				events: windowEvents,
				denials: windowEvents.filter(e => e.status === "denied"),
				highRiskEvents: windowEvents.filter(e => e.risk.level === "critical" || e.risk.level === "high"),
				sensitiveFileEvents: windowEvents.filter(e => e.target?.path && SENSITIVE_PATTERNS.some(p => (e.target?.path || "").toLowerCase().includes(p))),
				commandEvents: windowEvents.filter(e => e.action === "command_execute"),
				fileEvents: windowEvents.filter(e => e.action.startsWith("file_")),
				networkEvents: windowEvents.filter(e => ["web_fetch", "web_search"].includes(e.action)),
				mcpEvents: windowEvents.filter(e => e.action === "mcp_tool_call"),
			};

			const evaluation = evaluateFramework(fw.framework, windowData);
			const passRate = evaluation.summary.total > 0
				? Math.round((evaluation.summary.pass / evaluation.summary.total) * 100)
				: 0;
			const grade: ControlStatus = evaluation.summary.fail > 0 ? "fail" : evaluation.summary.partial > 0 ? "partial" : evaluation.summary.pass > 0 ? "pass" : "na";

			windows.push({
				start: new Date(windowStart).toISOString(),
				end: new Date(windowEnd).toISOString(),
				eventsInWindow: windowEvents.length,
				passRate,
				highRiskCount: windowData.highRiskEvents.length,
				denialCount: windowData.denials.length,
				overallGrade: grade,
			});

			windowStart = windowEnd;
		}

		return {
			frameworkId: fw.framework.id,
			period,
			windows,
		};
	});
}
