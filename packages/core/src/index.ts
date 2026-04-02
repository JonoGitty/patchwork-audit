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

export {
	CommitAttestationSchema,
	RiskSummarySchema,
	type CommitAttestation,
	type RiskSummary,
} from "./schema/commit-attestation.js";

// Store
export { JsonlStore, type JsonlRotationOptions } from "./store/jsonl.js";
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

// Relay
export {
	RelayDaemon,
	runRelayDaemon,
	type RelayDaemonOptions,
	type RelayDaemonState,
} from "./relay/daemon.js";
export {
	sendToRelay,
	sendToRelayAsync,
	sendToRelaySync,
	pingRelay,
	readRelayDivergenceMarker,
	type RelayDivergenceMarker,
} from "./relay/client.js";
export {
	RELAY_SOCKET_PATH,
	RELAY_LOG_PATH,
	RELAY_DAEMON_LOG_PATH,
	RELAY_PID_PATH,
	HEARTBEAT_INTERVAL_MS,
	RELAY_PROTOCOL_VERSION,
	type RelayMessage,
	type RelayResponse,
	type HeartbeatRecord,
	type SealStatusResponse,
	type ChainStateResponse,
	type SignRequest,
	type SignResponse,
} from "./relay/protocol.js";
export {
	loadRelayConfig,
	RELAY_CONFIG_PATH,
	DEFAULT_RELAY_CONFIG,
	type RelayConfig,
	type AutoSealConfig,
	type WitnessConfig,
	type WitnessEndpointConfig,
} from "./relay/config.js";
export {
	performAutoSealCycle,
	performSeal,
	shouldAutoSeal,
	publishToWitnesses,
	readLastSeal,
	RELAY_SEALS_PATH,
	RELAY_WITNESSES_PATH,
	ROOT_KEYRING_PATH,
	type AutoSealResult,
	type WitnessResult,
	type SealState,
} from "./relay/auto-seal.js";
export {
	requestSignature,
	type SignatureResult,
} from "./relay/signing-proxy.js";

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
	SYSTEM_POLICY_PATH,
	getSystemPolicyPath,
} from "./policy/loader.js";
