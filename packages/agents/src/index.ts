// Claude Code
export { handleClaudeCodeHook, readDivergenceMarker, type DivergenceMarker } from "./claude-code/adapter.js";
export { mapClaudeCodeTool } from "./claude-code/mapper.js";
export { installClaudeCodeHooks, uninstallClaudeCodeHooks } from "./claude-code/installer.js";
export type {
	ClaudeCodeHookInput,
	ClaudeCodeHookOutput,
	ClaudeCodeHookEvent,
} from "./claude-code/types.js";

// Codex
export { syncCodexHistory } from "./codex/history-parser.js";

// Common
export { detectInstalledAgents, type DetectedAgent } from "./common/detector.js";
