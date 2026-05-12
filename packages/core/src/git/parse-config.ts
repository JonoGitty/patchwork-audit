/**
 * Minimal `.git/config` parser for the v0.6.11 commit-6 remote-resolver.
 *
 * Why home-grown: the only consumer is the configured-remote resolver,
 * we control the input format, and we need a pure (no fs / no exec)
 * parser so the resolver can be unit-tested with literal config strings.
 *
 * What this parses (subset enough for design 3.4 + watch-out #3):
 *   - section headers           [remote "origin"]
 *   - subsectionless headers    [core]
 *   - bracketed multi-word      [url "https://github.com/"]
 *   - key = value pairs         (with whitespace tolerance)
 *   - multi-value keys          (same key declared multiple times)
 *   - line continuations        (trailing backslash)
 *   - quoted values             "..."  with \\, \", \t, \n escapes
 *   - comments                  # and ; (whole-line and trailing)
 *   - case-insensitive section + key names per git semantics
 *
 * What this DOES NOT parse:
 *   - include.path / includeIf chains. Caller MUST pre-resolve and merge
 *     included configs before calling the resolver. (Documented in
 *     resolveGitRemote — under taint, unresolvable include is treated as
 *     unresolved-destination = deny.)
 *   - Conditional includes, file:// fetches.
 */

export interface GitConfig {
	/**
	 * Sections keyed as `<section>` (no subsection) or
	 * `<section>.<subsection>` with the subsection lower-cased only
	 * for the section name comparison rules — values keep original case.
	 *
	 * The keys ARE case-folded (git treats `URL`, `url`, `Url` as the
	 * same key). Section names are case-folded too.
	 */
	sections: Record<string, Record<string, string[]>>;
}

const SECTION_HEADER_RE =
	/^\[\s*([A-Za-z][A-Za-z0-9-]*)(?:\s+"((?:[^"\\]|\\.)*)")?\s*\]/;
const SIMPLE_SECTION_HEADER_RE =
	/^\[\s*([A-Za-z][A-Za-z0-9-]*)(?:\.([^\]]+))?\s*\]/;

function unescapeQuoted(s: string): string {
	let out = "";
	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (c === "\\" && i + 1 < s.length) {
			const next = s[i + 1];
			switch (next) {
				case "n": out += "\n"; i++; continue;
				case "t": out += "\t"; i++; continue;
				case "\\": out += "\\"; i++; continue;
				case '"': out += '"'; i++; continue;
				default: out += next; i++; continue;
			}
		}
		out += c;
	}
	return out;
}

function parseValue(rawValue: string): string {
	// Strip leading whitespace and trailing whitespace, drop trailing
	// comments unless quoted.
	let v = rawValue;
	let result = "";
	let inQuote = false;
	for (let i = 0; i < v.length; i++) {
		const c = v[i];
		if (c === '"') {
			inQuote = !inQuote;
			continue;
		}
		if (!inQuote && (c === "#" || c === ";")) {
			break;
		}
		if (c === "\\" && i + 1 < v.length) {
			const next = v[i + 1];
			if (next === "\n") {
				// line continuation — eat
				i++;
				continue;
			}
			switch (next) {
				case "n": result += "\n"; i++; continue;
				case "t": result += "\t"; i++; continue;
				case "\\": result += "\\"; i++; continue;
				case '"': result += '"'; i++; continue;
				default: result += next; i++; continue;
			}
		}
		result += c;
	}
	return result.trim();
}

/**
 * Parse a `.git/config`-format string. Never throws; on syntax errors
 * the offending line is skipped and parsing continues.
 *
 * Section name handling:
 *   `[remote "origin"]`  → key  `remote.origin`
 *   `[core]`             → key  `core`
 *   `[branch.main]`      → key  `branch.main`        (legacy dot form)
 *   `[url "https://github.com/"]` → key `url.https://github.com/`
 */
export function parseGitConfig(text: string): GitConfig {
	const sections: Record<string, Record<string, string[]>> = {};
	let current: string | null = null;
	const lines = text.replace(/\\\n/g, " ").split("\n");
	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (line === "" || line.startsWith("#") || line.startsWith(";")) continue;
		if (line.startsWith("[")) {
			let m = SECTION_HEADER_RE.exec(line);
			if (m) {
				const section = m[1].toLowerCase();
				const sub = m[2];
				current =
					sub !== undefined ? `${section}.${unescapeQuoted(sub)}` : section;
				if (!sections[current]) sections[current] = {};
				continue;
			}
			m = SIMPLE_SECTION_HEADER_RE.exec(line);
			if (m) {
				const section = m[1].toLowerCase();
				const sub = m[2];
				current = sub !== undefined ? `${section}.${sub}` : section;
				if (!sections[current]) sections[current] = {};
				continue;
			}
			continue;
		}
		if (current === null) continue;
		const eq = line.indexOf("=");
		if (eq === -1) {
			// boolean shorthand: `key` alone is `key = true`
			const key = line.toLowerCase();
			if (!sections[current][key]) sections[current][key] = [];
			sections[current][key].push("true");
			continue;
		}
		const key = line.slice(0, eq).trim().toLowerCase();
		const value = parseValue(line.slice(eq + 1));
		if (!sections[current][key]) sections[current][key] = [];
		sections[current][key].push(value);
	}
	return { sections };
}

/**
 * Normalize a section query — git semantics: section name is
 * case-insensitive, subsection name is case-sensitive. So
 * `remote.Origin` stays `remote.Origin` (only `remote` folds), but
 * `Remote.Origin` becomes `remote.Origin`.
 */
function normalizeSection(section: string): string {
	const dot = section.indexOf(".");
	if (dot === -1) return section.toLowerCase();
	return section.slice(0, dot).toLowerCase() + section.slice(dot);
}

/**
 * Lookup helper — first value of `<section>.<key>`. Returns undefined
 * if missing.
 */
export function getConfigValue(
	config: GitConfig,
	section: string,
	key: string,
): string | undefined {
	const sec = config.sections[normalizeSection(section)];
	if (!sec) return undefined;
	const arr = sec[key.toLowerCase()];
	if (!arr || arr.length === 0) return undefined;
	return arr[0];
}

/** All values of a key — multi-value keys keep insertion order. */
export function getConfigValues(
	config: GitConfig,
	section: string,
	key: string,
): string[] {
	const sec = config.sections[normalizeSection(section)];
	if (!sec) return [];
	return sec[key.toLowerCase()] ?? [];
}

/**
 * Merge an overlay config on top of a base. Used by the resolver to
 * apply `-c` flag pairs and same-command `git remote add` mutations on
 * top of the parsed `.git/config`. Overlay sections REPLACE base
 * sections at the same key (not deep-merge), matching git's
 * "last-write-wins" within a single config layer. Cross-layer
 * precedence (-c > runtime > local > global > system) is the caller's
 * responsibility — they pass a single merged GitConfig.
 */
export function mergeGitConfig(base: GitConfig, overlay: GitConfig): GitConfig {
	const out: Record<string, Record<string, string[]>> = {};
	for (const [k, v] of Object.entries(base.sections)) {
		out[k] = {};
		for (const [kk, vv] of Object.entries(v)) {
			out[k][kk] = [...vv];
		}
	}
	for (const [k, v] of Object.entries(overlay.sections)) {
		if (!out[k]) out[k] = {};
		for (const [kk, vv] of Object.entries(v)) {
			out[k][kk] = [...vv];
		}
	}
	return { sections: out };
}

/** Build a config from a flat `{section.subsection.key: value}` map. */
export function configFromFlat(flat: Record<string, string>): GitConfig {
	const sections: Record<string, Record<string, string[]>> = {};
	for (const [path, value] of Object.entries(flat)) {
		const lastDot = path.lastIndexOf(".");
		if (lastDot === -1) continue;
		const section = path.slice(0, lastDot).toLowerCase();
		const key = path.slice(lastDot + 1).toLowerCase();
		if (!sections[section]) sections[section] = {};
		if (!sections[section][key]) sections[section][key] = [];
		sections[section][key].push(value);
	}
	return { sections };
}
