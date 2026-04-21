import { z } from "zod";

export const RiskSummarySchema = z.object({
	critical: z.number(),
	high: z.number(),
	medium: z.number(),
	low: z.number(),
	none: z.number(),
	denials: z.number(),
	/**
	 * Denials of critical/high-risk actions since the last commit.
	 * These indicate the policy blocked something meaningful and should
	 * typically cause attestation to FAIL. Optional for backward compatibility
	 * with attestations generated before this field existed.
	 */
	denials_high_risk_since_last_commit: z.number().optional(),
});

export const CommitAttestationSchema = z.object({
	schema_version: z.literal(1),
	type: z.literal("commit-attestation"),
	generated_at: z.string().datetime(),
	tool_version: z.string(),

	// Git binding
	commit_sha: z.string(),
	branch: z.string(),
	project_root: z.string(),

	// Session binding
	session_id: z.string(),
	session_events_count: z.number(),
	session_events_since_last_commit: z.number(),

	// Chain state at commit time
	chain_tip_hash: z.string().nullable(),
	chain_valid: z.boolean(),
	chain_chained_events: z.number(),

	// Risk summary
	risk_summary: RiskSummarySchema,

	// Policy
	policy_source: z.string(),

	// Verdict
	pass: z.boolean(),
	failure_reasons: z.array(z.string()),

	// Signing
	payload_hash: z.string(),
	signature: z.string(),
	key_id: z.string().optional(),
});

export type CommitAttestation = z.infer<typeof CommitAttestationSchema>;
export type RiskSummary = z.infer<typeof RiskSummarySchema>;
