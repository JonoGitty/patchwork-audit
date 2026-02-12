import { z } from "zod";

export const ActionCategory = {
	file: ["file_read", "file_write", "file_create", "file_delete", "file_edit", "file_glob", "file_grep"],
	command: ["command_execute", "command_approve", "command_deny"],
	network: ["web_fetch", "web_search", "api_call"],
	session: ["session_start", "session_end", "prompt_submit", "response_complete"],
	agent: ["subagent_start", "subagent_stop", "task_delegate"],
	mcp: ["mcp_tool_call", "mcp_tool_result"],
} as const;

export const AllActions = Object.values(ActionCategory).flat();
export type Action = (typeof AllActions)[number];

export const RiskLevel = z.enum(["none", "low", "medium", "high", "critical"]);
export type RiskLevel = z.infer<typeof RiskLevel>;

export const AgentType = z.enum(["claude-code", "codex", "cursor", "copilot", "custom"]);
export type AgentType = z.infer<typeof AgentType>;

export const EventStatus = z.enum(["pending", "completed", "denied", "failed"]);
export type EventStatus = z.infer<typeof EventStatus>;

export const TargetSchema = z.object({
	type: z.enum(["file", "command", "url", "mcp_tool", "prompt"]),
	path: z.string().optional(),
	abs_path: z.string().optional(),
	command: z.string().optional(),
	url: z.string().optional(),
	tool_name: z.string().optional(),
});

export const ProjectContextSchema = z.object({
	root: z.string(),
	name: z.string(),
	git_ref: z.string().optional(),
});

export const RiskSchema = z.object({
	level: RiskLevel,
	flags: z.array(z.string()).default([]),
	policy_match: z.string().optional(),
});

export const ContentSchema = z.object({
	hash: z.string(),
	summary: z.string().optional(),
	before_hash: z.string().optional(),
	size_bytes: z.number().optional(),
	redacted: z.boolean().default(true),
});

export const ProvenanceSchema = z.object({
	hook_event: z.string(),
	tool_name: z.string().optional(),
	raw_input: z.record(z.unknown()).optional(),
	raw_output: z.record(z.unknown()).optional(),
});

export const CURRENT_SCHEMA_VERSION = 1;

export const AuditEventSchema = z.object({
	// Schema — accepts undefined (legacy) or literal 1 (current); rejects unknown future versions
	schema_version: z.literal(1).optional(),

	// Identity
	id: z.string(),
	session_id: z.string(),
	timestamp: z.string().datetime(),
	idempotency_key: z.string().optional(),

	// Agent
	agent: AgentType,
	agent_version: z.string().optional(),

	// Action
	action: z.string(),
	status: EventStatus.default("completed"),
	duration_ms: z.number().optional(),

	// Target
	target: TargetSchema.optional(),

	// Context
	project: ProjectContextSchema.optional(),

	// Risk
	risk: RiskSchema,

	// Content
	content: ContentSchema.optional(),

	// Provenance
	provenance: ProvenanceSchema.optional(),

	// Tamper-evident hash chain
	prev_hash: z.string().nullable().optional(),
	event_hash: z.string().optional(),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;
export type Target = z.infer<typeof TargetSchema>;
export type ProjectContext = z.infer<typeof ProjectContextSchema>;
export type Risk = z.infer<typeof RiskSchema>;
export type Content = z.infer<typeof ContentSchema>;
export type Provenance = z.infer<typeof ProvenanceSchema>;
