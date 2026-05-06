/**
 * Multi-kind taint state engine — public API for v0.6.11 commit 3.
 *
 * The PostToolUse handler in `@patchwork/agents` (commit 7) drives
 * `registerTaint` / `registerGeneratedFile`. The PreToolUse sink
 * classifier in `src/sinks/classify.ts` reads `hasAnyTaint` /
 * `hasKind`. The CLI (`patchwork clear-taint`, commit 9) drives
 * `clearTaint` / `forgetGeneratedFile`.
 */

export {
	createSnapshot,
	registerTaint,
	registerGeneratedFile,
	clearTaint,
	forgetGeneratedFile,
	hasAnyTaint,
	hasKind,
	getActiveSources,
	getAllSources,
	isFileGenerated,
	getGeneratedFileSources,
	isPathUntrustedRepo,
	ALL_TAINT_KINDS,
	RAISES_FOR_TOOL,
	FORCE_UNTRUSTED_PATTERNS,
	type ClearTaintOptions,
	type TrustClassifierOptions,
} from "./snapshot.js";
