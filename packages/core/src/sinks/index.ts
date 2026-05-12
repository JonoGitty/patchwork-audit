/**
 * Sink taxonomy public API for v0.6.11.
 *
 * `classifyToolEvent` is the predicate the PreToolUse integration handler
 * (commit 8) calls. The other exports are pattern data + helper types
 * consumed by the taint engine (commit 3) and tests.
 */

export {
	classifyToolEvent,
	highestSeverity,
} from "./classify.js";

export {
	PERSISTENCE_PATTERNS,
	expandHomePattern,
	type PersistencePattern,
} from "./persistence-paths.js";

export {
	SECRET_PATTERNS,
	type SecretPattern,
} from "./secret-paths.js";

export {
	SINK_CLASSES,
	type SinkClass,
	type SinkSeverity,
	type SinkMatch,
} from "./types.js";
