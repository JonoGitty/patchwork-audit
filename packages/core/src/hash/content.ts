import { createHash } from "node:crypto";

/**
 * SHA-256 content hashing for audit integrity.
 * Every file operation records a content hash so changes are verifiable.
 */
export function hashContent(content: string | Buffer): string {
	const hash = createHash("sha256");
	hash.update(content);
	return `sha256:${hash.digest("hex")}`;
}

export function hashFile(filePath: string): string | null {
	try {
		const { readFileSync } = require("node:fs");
		const content = readFileSync(filePath);
		return hashContent(content);
	} catch {
		return null;
	}
}
