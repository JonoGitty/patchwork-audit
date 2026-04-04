/**
 * Patchwork Team Mode — Sync protocol types and Zod schemas.
 *
 * Defines the contract between the sync agent (on developer machines)
 * and the team server. All types are validated with Zod at boundaries.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Machine status
// ---------------------------------------------------------------------------

export const MachineStatusEnum = z.enum(["active", "suspended", "revoked"]);
export type MachineStatus = z.infer<typeof MachineStatusEnum>;

// ---------------------------------------------------------------------------
// Sync cursor — persisted locally, tracks sync position
// ---------------------------------------------------------------------------

export const SyncCursorSchema = z.object({
	schema_version: z.literal(1),
	last_synced_offset: z.number().int().nonnegative(),
	last_synced_event_hash: z.string().nullable(),
	last_synced_at: z.string().nullable(),
	last_seal_synced: z.string().nullable(),
	consecutive_failures: z.number().int().nonnegative(),
});

export type SyncCursor = z.infer<typeof SyncCursorSchema>;

export const DEFAULT_SYNC_CURSOR: SyncCursor = {
	schema_version: 1,
	last_synced_offset: 0,
	last_synced_event_hash: null,
	last_synced_at: null,
	last_seal_synced: null,
	consecutive_failures: 0,
};

// ---------------------------------------------------------------------------
// Sync envelope — batch wrapper sent from agent to server
// ---------------------------------------------------------------------------

export const SyncEnvelopeSchema = z.object({
	schema_version: z.literal(1),
	type: z.enum(["event-batch", "seal-batch", "attestation"]),
	machine_id: z.string(),
	machine_name: z.string(),
	developer_id: z.string(),
	team_id: z.string(),

	// Batch content
	events: z.array(z.record(z.unknown())),
	seals: z.array(z.record(z.unknown())).optional(),

	// Integrity
	batch_hash: z.string(),
	first_event_hash: z.string().nullable(),
	last_event_hash: z.string().nullable(),
	relay_chain_tip: z.string().nullable(),

	// Signature (added by signEnvelope)
	signature: z.string(),
	signed_at: z.string(),

	// Cursor position
	byte_offset_start: z.number().int().nonnegative(),
	byte_offset_end: z.number().int().nonnegative(),
});

export type SyncEnvelope = z.infer<typeof SyncEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Ingest response — server response to POST /api/v1/ingest
// ---------------------------------------------------------------------------

export const IngestResponseSchema = z.object({
	ok: z.boolean(),
	accepted: z.number().int().nonnegative().optional(),
	duplicates: z.number().int().nonnegative().optional(),
	chain_tip: z.string().nullable().optional(),
	error: z.string().optional(),
});

export type IngestResponse = z.infer<typeof IngestResponseSchema>;

// ---------------------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------------------

export const EnrollRequestSchema = z.object({
	enrollment_token: z.string(),
	machine_id: z.string(),
	machine_name: z.string(),
	developer_name: z.string(),
	developer_email: z.string().email().optional(),
	os: z.string(),
	agent_version: z.string().optional(),
});

export type EnrollRequest = z.infer<typeof EnrollRequestSchema>;

export const EnrollResponseSchema = z.object({
	ok: z.boolean(),
	api_key: z.string().optional(),
	machine_id: z.string().optional(),
	team_id: z.string().optional(),
	team_name: z.string().optional(),
	error: z.string().optional(),
});

export type EnrollResponse = z.infer<typeof EnrollResponseSchema>;

// ---------------------------------------------------------------------------
// Team config — persisted on the developer machine after enrollment
// ---------------------------------------------------------------------------

export const TeamConfigSchema = z.object({
	schema_version: z.literal(1),
	team_id: z.string(),
	team_name: z.string(),
	server_url: z.string().url(),
	machine_id: z.string(),
	developer_id: z.string().optional(),
	developer_name: z.string(),
	api_key: z.string(),
	enrolled_at: z.string(),
});

export type TeamConfig = z.infer<typeof TeamConfigSchema>;

// ---------------------------------------------------------------------------
// Admin bootstrap
// ---------------------------------------------------------------------------

export const BootstrapRequestSchema = z.object({
	team_name: z.string().min(1).max(100),
	admin_email: z.string().email(),
	admin_password: z.string().min(8),
});

export type BootstrapRequest = z.infer<typeof BootstrapRequestSchema>;

export const BootstrapResponseSchema = z.object({
	ok: z.boolean(),
	team_id: z.string().optional(),
	enrollment_token: z.string().optional(),
	error: z.string().optional(),
});

export type BootstrapResponse = z.infer<typeof BootstrapResponseSchema>;
