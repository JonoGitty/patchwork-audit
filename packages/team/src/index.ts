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

// Server
export { TeamDb } from "./server/db/schema.js";
export { createTeamApp } from "./server/app.js";
export { startTeamServer, type TeamServerOptions } from "./server/start.js";

// Enrollment & Identity
export { enrollMachine, saveTeamConfig, loadTeamConfig, isEnrolled } from "./sync/enrollment.js";
export { getMachineHardwareId, getMachineName, getMachineOS } from "./sync/identity.js";

// Sync Agent
export { SyncAgent, type SyncAgentOptions, type CycleResult } from "./sync/agent.js";
export { readCursor, writeCursor } from "./sync/cursor.js";
export { readNewEvents, type ReadResult } from "./sync/reader.js";
export { readNewSeals } from "./sync/seal-reader.js";
export { computeBackoffMs } from "./sync/backoff.js";
export { pushBatch, sendHeartbeat } from "./sync/transport.js";
