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

	// Git binding — commit_sha must be a real hex SHA (20 or 32 bytes); branch
	// must not contain control chars. Both prevent path-traversal /
	// log-injection via attestation files keyed on these fields.
	commit_sha: z.string().regex(/^[0-9a-f]{40}$|^[0-9a-f]{64}$/i, {
		message: "commit_sha must be a 40- or 64-char hex git SHA",
	}),
	branch: z.string().refine(
		// Reject control characters (0x00-0x1F + 0x7F) so a malicious branch name
		// can't smuggle ANSI escapes / newline injection / path traversal into
		// attestation log lines and git-note bodies.
		// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control-char rejection
		(s) => s.length > 0 && s.length <= 256 && !/[\x00-\x1f\x7f]/.test(s),
		{ message: "branch must be 1..256 chars and contain no control characters" },
	),
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
