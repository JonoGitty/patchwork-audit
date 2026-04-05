/**
 * Post-changeset version sync.
 *
 * Changesets bumps package.json files automatically, but these other locations
 * also embed the version string. This script reads the CLI package version
 * (the canonical source) and patches them all to match.
 *
 * Run automatically via: pnpm version  (see root package.json)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Read canonical version from CLI package.json
const cliPkg = JSON.parse(
	readFileSync(resolve(root, "packages/cli/package.json"), "utf8"),
);
const version = cliPkg.version;

console.log(`Syncing version strings to ${version}`);

// 1. CLI .version() call in src/index.ts
const cliIndex = resolve(root, "packages/cli/src/index.ts");
const cliSrc = readFileSync(cliIndex, "utf8");
const cliUpdated = cliSrc.replace(
	/\.version\("[^"]+"\)/,
	`.version("${version}")`,
);
if (cliSrc !== cliUpdated) {
	writeFileSync(cliIndex, cliUpdated);
	console.log("  Updated packages/cli/src/index.ts");
}

// 2. Dashboard footer in web templates
const layoutPath = resolve(root, "packages/web/src/templates/layout.ts");
const layoutSrc = readFileSync(layoutPath, "utf8");
const layoutUpdated = layoutSrc.replace(
	/Patchwork v[\d.]+[^ ]*/,
	`Patchwork v${version}`,
);
if (layoutSrc !== layoutUpdated) {
	writeFileSync(layoutPath, layoutUpdated);
	console.log("  Updated packages/web/src/templates/layout.ts");
}

// 3. Team health endpoint
const healthPath = resolve(
	root,
	"packages/team/src/server/routes/health.ts",
);
try {
	const healthSrc = readFileSync(healthPath, "utf8");
	const healthUpdated = healthSrc.replace(
		/version: "[^"]+"/,
		`version: "${version}"`,
	);
	if (healthSrc !== healthUpdated) {
		writeFileSync(healthPath, healthUpdated);
		console.log("  Updated packages/team/src/server/routes/health.ts");
	}
} catch {
	// team package may not exist yet in all checkouts
}

console.log("Version sync complete.");
