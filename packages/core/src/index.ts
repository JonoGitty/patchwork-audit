// Schema
export {
	AuditEventSchema,
	type AuditEvent,
	type Action,
	type Target,
	type ProjectContext,
	type Risk,
	type Content,
	type Provenance,
	ActionCategory,
	AllActions,
	RiskLevel,
	AgentType,
	EventStatus,
	TargetSchema,
	ProjectContextSchema,
	RiskSchema,
	ContentSchema,
	ProvenanceSchema,
} from "./schema/event.js";

export { SessionSchema, type Session } from "./schema/session.js";

// Store
export { JsonlStore } from "./store/jsonl.js";
export { SqliteStore } from "./store/sqlite.js";
export type { EventFilter, Store, SearchableStore } from "./store/types.js";

// Risk
export { classifyRisk } from "./risk/classifier.js";
export { SENSITIVE_GLOBS, matchesGlob } from "./risk/sensitive.js";

// Hash
export { hashContent, hashFile } from "./hash/content.js";

// ID
export { generateEventId, generateSessionId } from "./id/ulid.js";

// Policy
export {
	evaluatePolicy,
	PolicySchema,
	type Policy,
	type PolicyDecision,
	type PolicyEvalInput,
} from "./policy/engine.js";
export {
	loadPolicyFromFile,
	loadActivePolicy,
	policyToYaml,
	DEFAULT_POLICY,
	STRICT_POLICY,
} from "./policy/loader.js";
