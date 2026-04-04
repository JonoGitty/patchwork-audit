/**
 * Client-side enrollment — connects a machine to a team server.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { TeamConfigSchema, type TeamConfig, type EnrollResponse } from "../protocol.js";
import { TEAM_CONFIG_PATH, TEAM_DIR } from "../constants.js";
import { deriveMachineId } from "../crypto.js";
import { getMachineHardwareId, getMachineName, getMachineOS } from "./identity.js";

/**
 * Enroll this machine with a team server.
 *
 * @returns The team config (also saved to disk)
 */
export async function enrollMachine(
	serverUrl: string,
	enrollmentToken: string,
	developerName: string,
	configPath?: string,
): Promise<TeamConfig> {
	const hardwareId = getMachineHardwareId();

	// We need the team ID to derive machine ID, but we don't have it yet.
	// Use a preliminary enrollment call. The server returns the team_id.
	const resp = await fetch(`${serverUrl}/api/v1/enroll`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			enrollment_token: enrollmentToken,
			machine_id: hardwareId, // Send raw hardware ID; server stores as-is
			machine_name: getMachineName(),
			developer_name: developerName,
			os: getMachineOS(),
		}),
		signal: AbortSignal.timeout(15_000),
	});

	const body = (await resp.json()) as EnrollResponse;

	if (!body.ok || !body.api_key) {
		throw new Error(`Enrollment failed: ${body.error || "unknown error"}`);
	}

	const config: TeamConfig = {
		schema_version: 1,
		team_id: body.team_id!,
		team_name: body.team_name!,
		server_url: serverUrl,
		machine_id: body.machine_id!,
		developer_name: developerName,
		api_key: body.api_key,
		enrolled_at: new Date().toISOString(),
	};

	saveTeamConfig(config, configPath);
	return config;
}

/**
 * Save team config to disk (root-owned, 0600).
 */
export function saveTeamConfig(config: TeamConfig, configPath?: string): void {
	const p = configPath ?? TEAM_CONFIG_PATH;
	const dir = dirname(p);

	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true, mode: 0o700 });
	}

	// Atomic write
	const tmpPath = `${p}.${randomBytes(4).toString("hex")}.tmp`;
	writeFileSync(tmpPath, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
	renameSync(tmpPath, p);
}

/**
 * Load team config from disk. Returns null if not enrolled.
 */
export function loadTeamConfig(configPath?: string): TeamConfig | null {
	const p = configPath ?? TEAM_CONFIG_PATH;

	if (!existsSync(p)) return null;

	try {
		const content = readFileSync(p, "utf-8");
		const parsed = TeamConfigSchema.safeParse(JSON.parse(content));
		if (!parsed.success) return null;
		return parsed.data;
	} catch {
		return null;
	}
}

/**
 * Check if this machine is enrolled in a team.
 */
export function isEnrolled(configPath?: string): boolean {
	return loadTeamConfig(configPath) !== null;
}
