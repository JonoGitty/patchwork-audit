// Schema
export {
	AuditEventSchema,
	CURRENT_SCHEMA_VERSION,
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
export {
	canonicalize,
	computeEventHash,
	verifyChain,
	type ChainVerification,
} from "./hash/chain.js";
export {
	computeSealPayload,
	signSeal,
	verifySeal,
	ensureSealKey,
	readSealKey,
	deriveSealKeyId,
	ensureKeyring,
	loadKeyById,
	rotateKey,
	type SealRecord,
} from "./hash/seal.js";
export {
	WitnessRecordSchema,
	buildWitnessPayload,
	validateWitnessResponse,
	hashWitnessPayload,
	type WitnessRecord,
} from "./hash/witness.js";
export {
	buildAttestationPayload,
	hashAttestationPayload,
	signAttestation,
	verifyAttestation,
} from "./hash/attestation.js";

// ID
export { generateEventId, generateSessionId } from "./id/ulid.js";
export { getHomeDir, homePath } from "./path/home.js";

// Policy
export {
	evaluatePolicy,
	isSafePolicyRegex,
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
