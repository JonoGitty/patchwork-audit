/**
 * Read commit-attestation artefacts from ~/.patchwork/commit-attestations/.
 *
 * The CLI writes attestations to per-commit JSON files plus an append-only
 * index.jsonl. Failures (introduced when the previously-empty post-tool catch
 * was instrumented) land in _failures.jsonl alongside.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getHomeDir } from "@patchwork/core";

export interface AttestationIndexEntry {
	commit_sha: string;
	branch?: string;
	session_id: string;
	pass: boolean;
	generated_at: string;
	payload_hash?: string;
}

export interface AttestationFailureEntry {
	timestamp: string;
	stage: "extract" | "generate" | "write" | "note" | string;
	commit_sha: string | null;
	branch: string | null;
	session_id: string;
	error_message: string;
	error_stack?: string;
}

export interface AttestationTimelinePoint {
	date: string;
	pass: number;
	fail: number;
}

export interface AttestationSummary {
	total: number;
	pass: number;
	fail: number;
	pass_rate: number | null;
	last_attested: string | null;
	by_branch: Array<{ branch: string; n: number }>;
	recent_failures: number;
}

function commitAttestationsDir(): string {
	return join(getHomeDir(), ".patchwork", "commit-attestations");
}

function indexPath(): string { return join(commitAttestationsDir(), "index.jsonl"); }
function failuresPath(): string { return join(commitAttestationsDir(), "_failures.jsonl"); }

function readJsonl<T>(path: string): T[] {
	if (!existsSync(path)) return [];
	try {
		return readFileSync(path, "utf-8")
			.split("\n")
			.filter((l) => l.trim())
			.map((l) => {
				try { return JSON.parse(l) as T; } catch { return null; }
			})
			.filter((x): x is T => x !== null);
	} catch {
		return [];
	}
}

export function readAttestations(): AttestationIndexEntry[] {
	return readJsonl<AttestationIndexEntry>(indexPath());
}

export function readAttestationFailures(): AttestationFailureEntry[] {
	return readJsonl<AttestationFailureEntry>(failuresPath());
}

export function attestationTimeline(days: number = 30): AttestationTimelinePoint[] {
	const today = new Date();
	const startMs = today.getTime() - (days - 1) * 86_400_000;
	const startDay = new Date(startMs).toISOString().slice(0, 10);

	const passByDay: Record<string, number> = {};
	const failByDay: Record<string, number> = {};

	for (const a of readAttestations()) {
		const day = (a.generated_at || "").slice(0, 10);
		if (!day || day < startDay) continue;
		const bucket = a.pass ? passByDay : failByDay;
		bucket[day] = (bucket[day] || 0) + 1;
	}

	const out: AttestationTimelinePoint[] = [];
	for (let i = 0; i < days; i++) {
		const d = new Date(startMs + i * 86_400_000).toISOString().slice(0, 10);
		out.push({ date: d, pass: passByDay[d] || 0, fail: failByDay[d] || 0 });
	}
	return out;
}

export function attestationSummary(): AttestationSummary {
	const atts = readAttestations();
	const fails = readAttestationFailures();
	const total = atts.length;
	const pass = atts.filter((a) => a.pass).length;
	const last = atts.reduce<string>((acc, a) => (a.generated_at > acc ? a.generated_at : acc), "");

	const branchCounts: Record<string, number> = {};
	for (const a of atts) {
		const b = a.branch || "?";
		branchCounts[b] = (branchCounts[b] || 0) + 1;
	}
	const byBranch = Object.entries(branchCounts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([branch, n]) => ({ branch, n }));

	return {
		total,
		pass,
		fail: total - pass,
		pass_rate: total ? Math.round((pass / total) * 1000) / 10 : null,
		last_attested: last || null,
		by_branch: byBranch,
		recent_failures: fails.length,
	};
}

export function recentFailures(limit: number = 20): AttestationFailureEntry[] {
	const all = readAttestationFailures();
	return all.slice(-limit).reverse();
}
