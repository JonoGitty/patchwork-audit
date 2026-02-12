import { z } from "zod";
import { AgentType, RiskLevel } from "./event.js";

export const SessionSchema = z.object({
	id: z.string(),
	agent: AgentType,
	agent_version: z.string().optional(),
	started_at: z.string().datetime(),
	ended_at: z.string().datetime().optional(),
	duration_ms: z.number().optional(),
	project: z
		.object({
			root: z.string(),
			name: z.string(),
		})
		.optional(),
	stats: z.object({
		total_events: z.number().default(0),
		files_read: z.number().default(0),
		files_written: z.number().default(0),
		files_created: z.number().default(0),
		files_deleted: z.number().default(0),
		commands_run: z.number().default(0),
		web_requests: z.number().default(0),
		highest_risk: RiskLevel.default("none"),
		high_risk_count: z.number().default(0),
	}),
});

export type Session = z.infer<typeof SessionSchema>;
