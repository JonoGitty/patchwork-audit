/**
 * Remote witness proof verification.
 *
 * Given a set of local witness records (each with a witness_url and anchor_id),
 * this module calls each endpoint via HTTP GET to confirm the anchor exists
 * remotely. This prevents accepting locally-fabricated witness records.
 */

import { fetchJson } from "./http-client.js";

/** Result for a single remote witness proof check. */
export interface RemoteWitnessProofResult {
	url: string;
	anchor_id: string;
	verified: boolean;
	error?: string;
}

/** Aggregated result for all remote witness proof checks. */
export interface RemoteWitnessCheckResult {
	remote_witness_checked: boolean;
	remote_witness_proof_results: RemoteWitnessProofResult[];
	remote_witness_verified_count: number;
	remote_witness_quorum_met: boolean;
	remote_witness_failure_reason: string | null;
}

export function emptyRemoteWitnessResult(): RemoteWitnessCheckResult {
	return {
		remote_witness_checked: false,
		remote_witness_proof_results: [],
		remote_witness_verified_count: 0,
		remote_witness_quorum_met: false,
		remote_witness_failure_reason: null,
	};
}

/**
 * Check remote witness endpoints for proof that anchors exist.
 *
 * For each witness record, performs:
 *   GET {witness_url}/anchors/{anchor_id}
 *
 * A 200 response with a JSON body containing matching `anchor_id` is a verified proof.
 */
export async function checkRemoteWitnesses(opts: {
	witnessRecords: Array<{ witness_url: string; anchor_id: string }>;
	quorum: number;
	timeoutMs: number;
	bearerToken?: string;
}): Promise<RemoteWitnessCheckResult> {
	const { witnessRecords, quorum, timeoutMs, bearerToken } = opts;

	if (witnessRecords.length === 0) {
		return {
			remote_witness_checked: true,
			remote_witness_proof_results: [],
			remote_witness_verified_count: 0,
			remote_witness_quorum_met: false,
			remote_witness_failure_reason: `No witness records with witness_url and anchor_id available for remote verification (quorum: ${quorum})`,
		};
	}

	const results: RemoteWitnessProofResult[] = [];

	for (const record of witnessRecords) {
		const proofUrl = `${record.witness_url.replace(/\/+$/, "")}/anchors/${record.anchor_id}`;
		try {
			const { status, body } = await fetchJson(proofUrl, { timeoutMs, bearerToken });

			if (status !== 200) {
				results.push({
					url: proofUrl,
					anchor_id: record.anchor_id,
					verified: false,
					error: `HTTP ${status}`,
				});
				continue;
			}

			// Validate response body contains matching anchor_id
			const respObj = body as Record<string, unknown> | null;
			if (respObj && typeof respObj === "object" && respObj.anchor_id === record.anchor_id) {
				results.push({
					url: proofUrl,
					anchor_id: record.anchor_id,
					verified: true,
				});
			} else {
				results.push({
					url: proofUrl,
					anchor_id: record.anchor_id,
					verified: false,
					error: "Response body does not contain matching anchor_id",
				});
			}
		} catch (err) {
			results.push({
				url: proofUrl,
				anchor_id: record.anchor_id,
				verified: false,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	const verifiedCount = results.filter((r) => r.verified).length;
	const quorumMet = verifiedCount >= quorum;

	return {
		remote_witness_checked: true,
		remote_witness_proof_results: results,
		remote_witness_verified_count: verifiedCount,
		remote_witness_quorum_met: quorumMet,
		remote_witness_failure_reason: quorumMet
			? null
			: `Remote witness quorum not met: ${verifiedCount}/${witnessRecords.length} verified (need ${quorum})`,
	};
}
