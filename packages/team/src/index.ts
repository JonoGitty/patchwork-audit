// @patchwork/team — Team mode: sync agent + team server

// Protocol
export {
	SyncEnvelopeSchema,
	SyncCursorSchema,
	IngestResponseSchema,
	EnrollRequestSchema,
	EnrollResponseSchema,
	TeamConfigSchema,
	type SyncEnvelope,
	type SyncCursor,
	type IngestResponse,
	type EnrollRequest,
	type EnrollResponse,
	type TeamConfig,
	type MachineStatus,
} from "./protocol.js";

// Constants
export {
	TEAM_DIR,
	TEAM_CONFIG_PATH,
	SYNC_CURSOR_PATH,
	DEFAULT_TEAM_SERVER_PORT,
	SYNC_INTERVAL_MS,
	MAX_BATCH_EVENTS,
	MAX_BATCH_BYTES,
	API_KEY_PREFIX,
} from "./constants.js";

// Crypto
export {
	signEnvelope,
	verifyEnvelope,
	computeBatchHash,
	generateApiKey,
	hashApiKey,
	deriveMachineId,
} from "./crypto.js";
