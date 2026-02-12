import { describe, it, expect } from "vitest";
import { matchesGlob, SENSITIVE_GLOBS } from "../../src/risk/sensitive.js";

describe("matchesGlob", () => {
	it("matches .env at root", () => {
		expect(matchesGlob(".env", "**/.env")).toBe(true);
	});

	it("matches .env in subdirectory", () => {
		expect(matchesGlob("config/.env", "**/.env")).toBe(true);
	});

	it("matches .env.local", () => {
		expect(matchesGlob(".env.local", "**/.env.*")).toBe(true);
	});

	it("matches deep nested .env", () => {
		expect(matchesGlob("a/b/c/.env", "**/.env")).toBe(true);
	});

	it("matches id_rsa", () => {
		expect(matchesGlob(".ssh/id_rsa", "**/id_rsa")).toBe(true);
	});

	it("matches .pem files", () => {
		expect(matchesGlob("certs/server.pem", "**/*.pem")).toBe(true);
	});

	it("matches secret in filename", () => {
		expect(matchesGlob("config/my-secret-file.json", "**/*secret*")).toBe(true);
	});

	it("matches credential in filename", () => {
		expect(matchesGlob("credentials.json", "**/*credential*")).toBe(true);
	});

	it("does not match normal source files", () => {
		expect(matchesGlob("src/index.ts", "**/.env")).toBe(false);
	});

	it("does not match normal config", () => {
		expect(matchesGlob("tsconfig.json", "**/*secret*")).toBe(false);
	});
});

describe("SENSITIVE_GLOBS", () => {
	it("has entries for common sensitive patterns", () => {
		expect(SENSITIVE_GLOBS.length).toBeGreaterThan(15);
	});

	it("includes .env", () => {
		expect(SENSITIVE_GLOBS).toContain("**/.env");
	});

	it("includes id_rsa", () => {
		expect(SENSITIVE_GLOBS).toContain("**/id_rsa");
	});

	it("includes .pem files", () => {
		expect(SENSITIVE_GLOBS).toContain("**/*.pem");
	});
});
