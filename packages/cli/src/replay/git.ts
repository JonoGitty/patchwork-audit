import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { AuditEvent } from "@patchwork/core";

export interface GitDiffResult {
	/** File path relative to project root */
	path: string;
	/** Unified diff string (empty if no diff available) */
	diff: string;
	/** Whether this file was found in git history */
	found: boolean;
}

/**
 * Check if a directory is a git repository.
 */
function isGitRepo(dir: string): boolean {
	try {
		execSync("git rev-parse --is-inside-work-tree", { cwd: dir, stdio: "pipe" });
		return true;
	} catch {
		return false;
	}
}

/**
 * Get git commits made during a session timeframe.
 */
function getCommitsInRange(projectRoot: string, after: string, before: string): string[] {
	try {
		const result = execSync(
			`git log --after="${after}" --before="${before}" --format="%H" 2>/dev/null`,
			{ cwd: projectRoot, stdio: "pipe", encoding: "utf-8" },
		);
		return result.trim().split("\n").filter(Boolean);
	} catch {
		return [];
	}
}

/**
 * Get the commit just before a given timestamp (the baseline).
 */
function getCommitBefore(projectRoot: string, before: string): string | null {
	try {
		const result = execSync(
			`git log --before="${before}" --format="%H" -1 2>/dev/null`,
			{ cwd: projectRoot, stdio: "pipe", encoding: "utf-8" },
		);
		return result.trim() || null;
	} catch {
		return null;
	}
}

/**
 * Get diff for a specific file between two commits.
 */
function getFileDiff(projectRoot: string, filePath: string, fromCommit: string, toCommit: string): string {
	try {
		return execSync(
			`git diff ${fromCommit}..${toCommit} -- "${filePath}" 2>/dev/null`,
			{ cwd: projectRoot, stdio: "pipe", encoding: "utf-8", maxBuffer: 1024 * 1024 },
		);
	} catch {
		return "";
	}
}

/**
 * Get diff for a file between a commit and the working tree.
 */
function getFileDiffToWorktree(projectRoot: string, filePath: string, fromCommit: string): string {
	try {
		return execSync(
			`git diff ${fromCommit} -- "${filePath}" 2>/dev/null`,
			{ cwd: projectRoot, stdio: "pipe", encoding: "utf-8", maxBuffer: 1024 * 1024 },
		);
	} catch {
		return "";
	}
}

/**
 * Get git diffs for all file events in a session.
 * Best-effort — returns empty diffs for files not in git history.
 */
export function getSessionGitDiffs(
	events: AuditEvent[],
): Map<string, GitDiffResult> {
	const results = new Map<string, GitDiffResult>();

	// Find project root from first event
	const projectRoot = events[0]?.project?.root;
	if (!projectRoot || !existsSync(projectRoot) || !isGitRepo(projectRoot)) {
		return results;
	}

	// Get session timeframe
	const timestamps = events.map(e => e.timestamp);
	const sessionStart = timestamps[0];
	const sessionEnd = timestamps[timestamps.length - 1];

	// Find baseline commit (just before session started)
	const baseCommit = getCommitBefore(projectRoot, sessionStart);

	// Find commits during the session
	const sessionCommits = getCommitsInRange(projectRoot, sessionStart, sessionEnd);

	// Collect unique file paths from file modification events
	const modifiedFiles = new Set<string>();
	for (const e of events) {
		if (
			e.target?.path &&
			["file_write", "file_edit", "file_create", "file_delete"].includes(e.action)
		) {
			modifiedFiles.add(e.target.path);
		}
	}

	for (const filePath of modifiedFiles) {
		let diff = "";
		let found = false;

		if (baseCommit && sessionCommits.length > 0) {
			// Diff from baseline to latest session commit
			const latestCommit = sessionCommits[0]; // git log returns newest first
			diff = getFileDiff(projectRoot, filePath, baseCommit, latestCommit);
			found = diff.length > 0;
		}

		if (!found && baseCommit) {
			// Try diff from baseline to working tree (uncommitted changes)
			diff = getFileDiffToWorktree(projectRoot, filePath, baseCommit);
			found = diff.length > 0;
		}

		if (!found && sessionCommits.length > 0) {
			// Try showing the file as added in the latest commit
			try {
				diff = execSync(
					`git show ${sessionCommits[0]}:"${filePath}" 2>/dev/null`,
					{ cwd: projectRoot, stdio: "pipe", encoding: "utf-8", maxBuffer: 512 * 1024 },
				);
				if (diff) {
					diff = diff.split("\n").map(l => `+${l}`).join("\n");
					found = true;
				}
			} catch { /* file not in that commit */ }
		}

		results.set(filePath, {
			path: filePath,
			diff: diff.slice(0, 10000), // Cap diff size
			found,
		});
	}

	return results;
}
