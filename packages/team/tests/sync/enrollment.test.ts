import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { saveTeamConfig, loadTeamConfig, isEnrolled } from "../../src/sync/enrollment.js";
import type { TeamConfig } from "../../src/protocol.js";

describe("saveTeamConfig / loadTeamConfig", () => {
	let tmpDir: string;
	let configPath: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "patchwork-enroll-test-"));
		configPath = join(tmpDir, "team", "config.json");
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	const validConfig: TeamConfig = {
		schema_version: 1,
		team_id: "t1",
		team_name: "Engineering",
		server_url: "https://patchwork.example.com",
		machine_id: "m1",
		developer_name: "Jono",
		api_key: "pw_test123",
		enrolled_at: "2026-04-04T00:00:00Z",
	};

	it("saves and loads config round-trip", () => {
		saveTeamConfig(validConfig, configPath);
		const loaded = loadTeamConfig(configPath);
		expect(loaded).toEqual(validConfig);
	});

	it("creates directory if missing", () => {
		saveTeamConfig(validConfig, configPath);
		expect(existsSync(configPath)).toBe(true);
	});

	it("returns null when not enrolled", () => {
		expect(loadTeamConfig(configPath)).toBeNull();
	});

	it("returns null for corrupt file", () => {
		const { writeFileSync, mkdirSync } = require("node:fs");
		const { dirname } = require("node:path");
		mkdirSync(dirname(configPath), { recursive: true });
		writeFileSync(configPath, "not json");
		expect(loadTeamConfig(configPath)).toBeNull();
	});

	it("isEnrolled reflects config existence", () => {
		expect(isEnrolled(configPath)).toBe(false);
		saveTeamConfig(validConfig, configPath);
		expect(isEnrolled(configPath)).toBe(true);
	});
});
