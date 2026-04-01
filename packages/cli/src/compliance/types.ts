import type { AuditEvent, Policy } from "@patchwork/core";

export interface ReportData {
	/** All events in the report period */
	events: AuditEvent[];
	/** Report period start */
	periodStart: Date;
	/** Report period end */
	periodEnd: Date;
	/** Aggregated statistics */
	stats: {
		totalEvents: number;
		totalSessions: number;
		byAction: Record<string, number>;
		byAgent: Record<string, number>;
		byRisk: Record<string, number>;
		byDay: Record<string, number>;
		topFiles: Array<[string, number]>;
		topCommands: Array<[string, number]>;
	};
	/** Session summaries */
	sessions: Array<{
		id: string;
		agent: string;
		project: string;
		started: string;
		ended: string;
		durationMs: number;
		count: number;
		writes: number;
		commands: number;
		highRisk: number;
		denials: number;
	}>;
	/** Integrity verification */
	integrity: {
		chainValid: boolean;
		chainedEvents: number;
		legacyEvents: number;
		invalidEvents: number;
		sealed: boolean;
		attested: boolean;
	};
	/** Active policy */
	policy: Policy | null;
	policySource: string;
	/** Denied events */
	denials: AuditEvent[];
	/** High-risk events (critical + high) */
	highRiskEvents: AuditEvent[];
	/** Sensitive file accesses */
	sensitiveFileEvents: AuditEvent[];
	/** Command events */
	commandEvents: AuditEvent[];
	/** File events */
	fileEvents: AuditEvent[];
	/** Network events */
	networkEvents: AuditEvent[];
	/** MCP tool events */
	mcpEvents: AuditEvent[];
}

export type ControlStatus = "pass" | "fail" | "partial" | "na";

export interface ControlResult {
	status: ControlStatus;
	evidence: string;
	details?: string;
	eventCount?: number;
	/** Event IDs that satisfy this control — for evidence drill-down */
	linkedEvents?: string[];
}

export interface ComplianceControl {
	id: string;
	name: string;
	description: string;
	evaluate: (data: ReportData) => ControlResult;
}

export interface ComplianceFramework {
	id: string;
	name: string;
	version: string;
	description: string;
	controls: ComplianceControl[];
}

export interface FrameworkReport {
	framework: ComplianceFramework;
	results: Array<{
		control: ComplianceControl;
		result: ControlResult;
	}>;
	summary: {
		pass: number;
		fail: number;
		partial: number;
		na: number;
		total: number;
	};
}

export interface ComplianceGap {
	frameworkId: string;
	controlId: string;
	controlName: string;
	reason: string;
	remediation: string;
	effort: "minutes" | "hours" | "days";
}

export interface TrendWindow {
	start: string;
	end: string;
	eventsInWindow: number;
	passRate: number;
	highRiskCount: number;
	denialCount: number;
	overallGrade: ControlStatus;
}

export interface ComplianceTrend {
	frameworkId: string;
	period: "daily" | "weekly" | "monthly";
	windows: TrendWindow[];
}

export interface ComplianceReport {
	generatedAt: string;
	toolVersion: string;
	periodStart: string;
	periodEnd: string;
	data: ReportData;
	frameworks: FrameworkReport[];
	overallGrade: ControlStatus;
	gaps?: ComplianceGap[];
	trends?: ComplianceTrend[];
}
