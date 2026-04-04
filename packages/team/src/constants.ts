/** Root-owned team config directory (macOS). */
export const TEAM_DIR = "/Library/Patchwork/team";

/** Team config file path (root-owned, 0600). */
export const TEAM_CONFIG_PATH = "/Library/Patchwork/team/config.json";

/** Sync cursor file path (root-owned). */
export const SYNC_CURSOR_PATH = "/Library/Patchwork/team/sync-cursor.json";

/** Default team server port. */
export const DEFAULT_TEAM_SERVER_PORT = 3001;

/** Sync interval in milliseconds (30 seconds). */
export const SYNC_INTERVAL_MS = 30_000;

/** Maximum events per sync batch. */
export const MAX_BATCH_EVENTS = 500;

/** Maximum batch size in bytes (1 MB). */
export const MAX_BATCH_BYTES = 1_048_576;

/** API key prefix for easy identification. */
export const API_KEY_PREFIX = "pw_";

/** Enrollment token prefix. */
export const ENROLL_TOKEN_PREFIX = "enroll_";

/** Backoff schedule in milliseconds (by consecutive failure count). */
export const BACKOFF_SCHEDULE_MS = [30_000, 60_000, 120_000, 300_000, 600_000];
