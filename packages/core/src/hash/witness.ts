import { createHash } from "node:crypto";
import { z } from "zod";

/**
 * Schema for a witness record anchoring a chain tip to an external witness.
 * Each record represents a successful publication to one witness endpoint.
 */
export const WitnessRecordSchema = z.object({
	schema_version: z.literal(1),
	witnessed_at: z.string().datetime(),
	tip_hash: z.string(),
	chained_events: z.number().int().nonnegative(),
	seal_signature: z.string(),
	key_id: z.string().optional(),
	witness_url: z.string(),
	anchor_id: z.string(),
	receipt_hash: z.string().optional(),
});

export type WitnessRecord = z.infer<typeof WitnessRecordSchema>;

/**
 * Build the deterministic payload for an outbound witness request.
 * This is the canonical JSON that gets POSTed to witness endpoints.
 *
 * All inputs — including `requested_at` — must be provided by the caller
 * so that identical logical inputs always produce identical output.
 */
export function buildWitnessPayload(params: {
	tip_hash: string;
	chained_events: number;
	seal_signature: string;
	key_id?: string;
	requested_at: string;
}): string {
	// Deterministic key ordering for reproducible payloads
	const obj: Record<string, unknown> = {
		protocol: "patchwork-witness-v1",
		tip_hash: params.tip_hash,
		chained_events: params.chained_events,
		seal_signature: params.seal_signature,
	};
	if (params.key_id !== undefined) {
		obj.key_id = params.key_id;
	}
	obj.requested_at = params.requested_at;
	return JSON.stringify(obj);
}

/**
 * Validate and normalize a raw witness endpoint response into a WitnessRecord.
 * Returns the validated record or an error string.
 */
export function validateWitnessResponse(
	raw: unknown,
	witnessUrl: string,
	tipHash: string,
	chainedEvents: number,
	sealSignature: string,
	keyId?: string,
	fallbackWitnessedAt?: string,
): WitnessRecord | { error: string } {
	if (raw === null || raw === undefined || typeof raw !== "object") {
		return { error: "Response is not a JSON object" };
	}

	const resp = raw as Record<string, unknown>;

	// anchor_id is required from the witness
	if (typeof resp.anchor_id !== "string" || resp.anchor_id.length === 0) {
		return { error: "Response missing required anchor_id" };
	}

	// Resolve witnessed_at: use response value if valid ISO datetime, else use fallback
	let witnessedAt: string;
	if (typeof resp.witnessed_at === "string") {
		// Validate that it's a valid ISO datetime
		const ts = Date.parse(resp.witnessed_at);
		if (Number.isNaN(ts)) {
			return { error: `Invalid witnessed_at: "${resp.witnessed_at}" is not a valid ISO datetime` };
		}
		witnessedAt = resp.witnessed_at;
	} else if (fallbackWitnessedAt !== undefined) {
		witnessedAt = fallbackWitnessedAt;
	} else {
		return { error: "Response missing witnessed_at and no fallback provided" };
	}

	const record: WitnessRecord = {
		schema_version: 1,
		witnessed_at: witnessedAt,
		tip_hash: tipHash,
		chained_events: chainedEvents,
		seal_signature: sealSignature,
		witness_url: witnessUrl,
		anchor_id: resp.anchor_id as string,
	};

	if (keyId !== undefined) {
		record.key_id = keyId;
	}

	if (typeof resp.receipt_hash === "string") {
		record.receipt_hash = resp.receipt_hash;
	}

	// Validate the assembled record against the schema
	const result = WitnessRecordSchema.safeParse(record);
	if (!result.success) {
		return { error: `Schema validation failed: ${result.error.message}` };
	}

	return result.data;
}

/**
 * Compute a hash of the witness payload for integrity verification.
 * Returns `sha256:<hex>`.
 */
export function hashWitnessPayload(payload: string): string {
	return `sha256:${createHash("sha256").update(payload).digest("hex")}`;
}
