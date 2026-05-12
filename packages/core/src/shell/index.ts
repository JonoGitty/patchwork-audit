/**
 * Conservative shell recognizer — public API for v0.6.11 commit 4.
 *
 * `parseShellCommand` is the single entry point the agents PostToolUse
 * handler (commit 7) calls to populate `ToolEvent.parsed_command`.
 * It never throws and returns a tree where every node has a
 * `confidence` field that the commit-8 enforcement layer reads to
 * decide allow / approval_required / deny under taint.
 */

export { tokenize } from "./lexer.js";
export { parseShellCommand } from "./parse.js";
export {
	indicatorsForLeaf,
	indicatorForRedirect,
	combineChildrenIndicators,
} from "./sink-indicators.js";

export type {
	Token,
	TokenKind,
	Redirect,
	RedirectKind,
	ParsedCommand,
	ParsedOp,
	SinkIndicator,
	SinkIndicatorKind,
	ParseConfidence,
} from "./types.js";

export {
	INTERPRETER_NAMES,
	FETCH_TOOL_NAMES,
	COMPOUND_PREFIXES,
	INLINE_EVAL_FLAGS,
} from "./types.js";
