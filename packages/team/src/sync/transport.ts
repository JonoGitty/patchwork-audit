/**
 * HTTP transport — pushes event batches and seals to the team server.
 */

import type { SyncEnvelope, IngestResponse } from "../protocol.js";

/**
 * Push an event batch to the team server.
 */
export async function pushBatch(
	serverUrl: string,
	apiKey: string,
	envelope: SyncEnvelope,
): Promise<IngestResponse> {
	const resp = await fetch(`${serverUrl}/api/v1/ingest`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify(envelope),
		signal: AbortSignal.timeout(30_000),
	});

	return resp.json() as Promise<IngestResponse>;
}

/**
 * Send a heartbeat to the team server (updates last_seen_at).
 */
export async function sendHeartbeat(
	serverUrl: string,
	apiKey: string,
): Promise<boolean> {
	try {
		const resp = await fetch(`${serverUrl}/api/v1/health`, {
			headers: { Authorization: `Bearer ${apiKey}` },
			signal: AbortSignal.timeout(10_000),
		});
		return resp.ok;
	} catch {
		return false;
	}
}
