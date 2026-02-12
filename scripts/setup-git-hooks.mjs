#!/usr/bin/env node

import { chmodSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const hooksPath = ".githooks";
const prePushPath = join(root, hooksPath, "pre-push");

if (!existsSync(prePushPath)) {
	console.error(`[patchwork] Missing hook script: ${prePushPath}`);
	process.exit(1);
}

try {
	chmodSync(prePushPath, 0o755);
} catch (err) {
	const msg = err instanceof Error ? err.message : String(err);
	console.error(`[patchwork] Failed to set executable bit on pre-push hook: ${msg}`);
	process.exit(1);
}

const gitConfig = spawnSync("git", ["config", "core.hooksPath", hooksPath], {
	cwd: root,
	stdio: "inherit",
});

if (gitConfig.status !== 0) {
	process.exit(gitConfig.status ?? 1);
}

console.log("[patchwork] Installed git hooks");
console.log("[patchwork] core.hooksPath=.githooks");
console.log("[patchwork] pre-push will now run `pnpm test:log`");
