// Core (v0.6.11 — taint-aware policy enforcement substrate)
export {
	ToolEventSchema,
	TaintSnapshotSchema,
	ToolPhase,
	SafetyMode,
	ParseConfidence,
	TaintKind,
	type ToolEvent,
	type TaintSnapshot,
	type TaintSource,
	type ParsedCommand,
} from "./core/tool-event.js";
export {
	lookupToolRegistry,
	listToolRegistry,
	getMcpPrefixEntry,
	type ToolRegistryEntry,
} from "./core/tool-registry.js";
export {
	normalizeToolEvent,
	POLICY_VERSION,
	type NormalizeInput,
	type NormalizeResult,
} from "./core/normalize-tool-event.js";

// URL canonicalization + allowlist (v0.6.11 commit 5 — single decision fn)
export {
	canonicalizeUrl,
	evaluateAllowlist,
	decideUrlPolicy,
	type CanonicalUrl,
	type CanonicalReject,
	type CanonicalResult,
	type CanonicalFlags,
	type RejectReason,
	type AllowlistEntry,
	type AllowlistEvalOptions,
	type AllowlistDecision,
	type UrlPolicyDecision,
} from "./url/index.js";

// Taint engine (v0.6.11 commit 3 — multi-kind in-memory taint state)
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
} from "./taint/index.js";

// Sinks (v0.6.11 commit 2 — Claude-native sink taxonomy)
export {
	classifyToolEvent,
	highestSeverity,
	PERSISTENCE_PATTERNS,
	SECRET_PATTERNS,
	expandHomePattern,
	SINK_CLASSES,
	type PersistencePattern,
	type SecretPattern,
	type SinkClass,
	type SinkSeverity,
	type SinkMatch,
} from "./sinks/index.js";

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
	verifyEventHashes,
	type ChainVerification,
	type EventIntegrityResult,
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
export {
	IN_TOTO_STATEMENT_TYPE,
	PATCHWORK_PREDICATE_TYPE,
	DSSE_PAYLOAD_TYPE,
	dssePAE,
	buildInTotoStatement,
	buildDsseEnvelope,
	verifyDsseEnvelope,
	decodeStatement,
	digestStatement,
	type InTotoSubject,
	type InTotoStatement,
	type DsseSignature,
	type DsseEnvelope,
	type DsseSignFn,
	type DsseVerifyFn,
	type PatchworkAiAgentPredicate,
} from "./attestation/intoto.js";

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
	type VerifyRequest,
	type VerifyResponse,
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
	requestVerification,
	type SignatureResult,
	type VerifyResult,
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
