import { describe, it, expect } from "vitest";
import { hashContent } from "../../src/hash/content.js";
import { generateEventId, generateSessionId } from "../../src/id/ulid.js";

describe("hashContent", () => {
	it("returns sha256: prefix", () => {
		const hash = hashContent("hello world");
		expect(hash.startsWith("sha256:")).toBe(true);
	});

	it("produces consistent hashes", () => {
		const h1 = hashContent("test content");
		const h2 = hashContent("test content");
		expect(h1).toBe(h2);
	});

	it("produces different hashes for different content", () => {
		const h1 = hashContent("content A");
		const h2 = hashContent("content B");
		expect(h1).not.toBe(h2);
	});

	it("works with Buffer input", () => {
		const hash = hashContent(Buffer.from("hello"));
		expect(hash.startsWith("sha256:")).toBe(true);
	});

	it("hash is 64 hex chars after prefix", () => {
		const hash = hashContent("test");
		const hex = hash.replace("sha256:", "");
		expect(hex).toHaveLength(64);
		expect(hex).toMatch(/^[0-9a-f]+$/);
	});
});

describe("generateEventId", () => {
	it("starts with evt_ prefix", () => {
		expect(generateEventId().startsWith("evt_")).toBe(true);
	});

	it("generates unique IDs", () => {
		const ids = new Set(Array.from({ length: 100 }, () => generateEventId()));
		expect(ids.size).toBe(100);
	});
});

describe("generateSessionId", () => {
	it("starts with ses_ prefix", () => {
		expect(generateSessionId().startsWith("ses_")).toBe(true);
	});

	it("generates unique IDs", () => {
		const ids = new Set(Array.from({ length: 100 }, () => generateSessionId()));
		expect(ids.size).toBe(100);
	});
});
