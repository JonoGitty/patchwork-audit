import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	dts: true,
	noExternal: ["@patchwork/core", "@patchwork/agents", "@patchwork/web"],
	external: ["better-sqlite3"],
	banner: {
		js: "#!/usr/bin/env node",
	},
});
