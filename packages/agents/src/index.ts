// Claude Code
export { handleClaudeCodeHook, readDivergenceMarker, type DivergenceMarker } from "./claude-code/adapter.js";
export { mapClaudeCodeTool } from "./claude-code/mapper.js";
export {
	installClaudeCodeHooks,
	uninstallClaudeCodeHooks,
	resolveFailClosed,
	type InstallOptions,
	type PolicyMode,
	type TelemetryDest,
	type TelemetryLockMode,
} from "./claude-code/installer.js";
export type {
	ClaudeCodeHookInput,
	ClaudeCodeHookOutput,
	ClaudeCodeHookEvent,
} from "./claude-code/types.js";

// Commit attestation
export { isGitCommitCommand, extractCommitInfo, usesNoVerify } from "./claude-code/git-commit-detector.js";
export {
	generateCommitAttestation,
	writeCommitAttestation,
	addGitNote,
	readCommitAttestation,
	type CommitAttestationParams,
} from "./claude-code/commit-attestor.js";

// Taint store (v0.6.11 commit 7)
export {
	readTaintSnapshot,
	writeTaintSnapshot,
	loadOrInitSnapshot,
	getTaintDir,
	getTaintSnapshotPath,
} from "./claude-code/taint-store.js";

// Approval store (v0.6.11 commit 9)
export {
	canonicalKey,
	getApprovalDir,
	writePendingRequest,
	readPendingRequest,
	writeApprovedToken,
	consumeApprovedToken,
	listPendingRequests,
	DEFAULT_APPROVAL_TTL_MS,
	type PendingRequest,
	type ApprovedToken,
	type CanonicalKeyInput,
} from "./claude-code/approval-store.js";

// Codex
export { syncCodexHistory } from "./codex/history-parser.js";

// Common
export { detectInstalledAgents, type DetectedAgent } from "./common/detector.js";
