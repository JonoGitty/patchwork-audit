import { describe, it, expect } from "vitest";
import {
	canonicalizeUrl,
	decideUrlPolicy,
} from "../../src/url/canonicalize.js";
import type { AllowlistEntry } from "../../src/url/canonicalize.js";

/**
 * Adversarial corpus per design §3.4 (≥80 fixtures). Each entry says
 * "given this raw input + this allowlist + these opts, the policy
 * decision is X". The corpus is the data; the test loop is the engine.
 *
 * Categories covered:
 *   - userinfo @-confusion
 *   - scheme banlist (data:, file:, javascript:, gopher:, ftp:, ws:, ...)
 *   - IDN homographs / punycode
 *   - IP literal smuggling (decimal / hex / octal / IPv6 / IPv4-mapped)
 *   - loopback / private / link-local edge cases (incl. 169.254.169.254
 *     metadata IP — the canonical exfil target on AWS/GCP)
 *   - allowlist evasion: prefix, suffix, sibling, double-dot host
 *   - port confusion
 *   - case folding
 *   - percent-encoding of host bytes
 *   - empty / malformed inputs
 */

interface Fixture {
	input: string;
	allowlist?: string[];
	opts?: {
		allow_ip_literal?: boolean;
		allow_loopback?: boolean;
		allow_private?: boolean;
		allow_idn?: boolean;
	};
	allow: boolean;
	/** If `allow` is false, optionally pin the reason string. */
	reason?: string;
	/** Free-text label for test output. */
	tag: string;
}

const A = (...patterns: string[]): AllowlistEntry[] =>
	patterns.map((pattern) => ({ pattern }));

const FIXTURES: Fixture[] = [
	// === userinfo / @-confusion ===
	{ tag: "userinfo basic", input: "https://user:pass@example.com/", allow: false, reason: "userinfo_present" },
	{ tag: "userinfo username only", input: "https://user@example.com/", allow: false, reason: "userinfo_present" },
	{ tag: "userinfo @ confusion (host smuggle)", input: "https://u:p@evil.com@allowed.com/", allowlist: ["allowed.com"], allow: false, reason: "userinfo_present" },
	{ tag: "userinfo only colon (degenerate, parses cleanly)", input: "https://:@example.com/", allowlist: ["example.com"], allow: true /* :@ has empty username and password, host is plain example.com */ },
	{ tag: "userinfo encoded @", input: "https://user%40evil@allowed.com/", allowlist: ["allowed.com"], allow: false, reason: "userinfo_present" },

	// === scheme banlist ===
	{ tag: "data url", input: "data:text/plain,hello", allow: false, reason: "scheme_banlisted" },
	{ tag: "data url with payload", input: "data:text/html;base64,PHNjcmlwdD4=", allow: false, reason: "scheme_banlisted" },
	{ tag: "file url", input: "file:///etc/passwd", allow: false, reason: "scheme_banlisted" },
	{ tag: "javascript: pseudo url", input: "javascript:alert(1)", allow: false, reason: "scheme_banlisted" },
	{ tag: "gopher url", input: "gopher://example.com/x", allow: false, reason: "scheme_banlisted" },
	{ tag: "ftp url", input: "ftp://example.com/x", allow: false, reason: "scheme_banlisted" },
	{ tag: "ftps url", input: "ftps://example.com/x", allow: false, reason: "scheme_banlisted" },
	{ tag: "ws url", input: "ws://example.com/", allow: false, reason: "scheme_banlisted" },
	{ tag: "wss url", input: "wss://example.com/", allow: false, reason: "scheme_banlisted" },
	{ tag: "blob url", input: "blob:https://example.com/uuid", allow: false },
	{ tag: "mailto", input: "mailto:victim@example.com", allow: false, reason: "scheme_banlisted" },
	{ tag: "chrome internal", input: "chrome://settings", allow: false },
	{ tag: "view-source: prefix", input: "view-source:https://example.com/", allow: false },
	{ tag: "custom scheme", input: "evilscheme://example.com/", allow: false, reason: "scheme_not_allowed" },

	// === IP literal smuggling ===
	{ tag: "IPv4 literal denied by default", input: "http://1.2.3.4/", allowlist: ["1.2.3.4"], allow: false, reason: "ip_literal_not_allowed" },
	{ tag: "IPv4 literal allowed with opt-in", input: "http://1.2.3.4/", allowlist: ["1.2.3.4"], opts: { allow_ip_literal: true }, allow: true },
	{ tag: "IPv4 decimal smuggle (2130706433 = 127.0.0.1)", input: "http://2130706433/", allowlist: ["127.0.0.1"], opts: { allow_ip_literal: true }, allow: false },
	{ tag: "IPv4 hex smuggle (0x7f000001)", input: "http://0x7f000001/", allowlist: ["127.0.0.1"], opts: { allow_ip_literal: true }, allow: false },
	{ tag: "IPv4 octal smuggle (0177.0.0.1)", input: "http://0177.0.0.1/", allowlist: ["127.0.0.1"], opts: { allow_ip_literal: true }, allow: false },
	{ tag: "IPv6 literal denied", input: "http://[2001:db8::1]/", allowlist: ["[2001:db8::1]"], allow: false, reason: "ip_literal_not_allowed" },
	{ tag: "IPv6 mapped IPv4 denied", input: "http://[::ffff:127.0.0.1]/", allowlist: ["[::ffff:127.0.0.1]"], opts: { allow_ip_literal: true }, allow: false },
	{ tag: "0.0.0.0 (any-host smuggle)", input: "http://0.0.0.0/", allowlist: ["0.0.0.0"], opts: { allow_ip_literal: true }, allow: true /* not classified as loopback/private — caller's allowlist is the gate */ },

	// === loopback ===
	{ tag: "127.0.0.1 denied default", input: "http://127.0.0.1/", allowlist: ["127.0.0.1"], opts: { allow_ip_literal: true }, allow: false, reason: "loopback_not_allowed" },
	{ tag: "127.5.5.5 denied default", input: "http://127.5.5.5/", allowlist: ["127.5.5.5"], opts: { allow_ip_literal: true }, allow: false, reason: "loopback_not_allowed" },
	{ tag: "[::1] denied default", input: "http://[::1]/", allowlist: ["[::1]"], opts: { allow_ip_literal: true }, allow: false, reason: "loopback_not_allowed" },
	{ tag: "localhost denied default", input: "http://localhost/", allowlist: ["localhost"], allow: false, reason: "loopback_not_allowed" },
	{ tag: "loopback allowed with opt-in", input: "http://127.0.0.1/", allowlist: ["127.0.0.1"], opts: { allow_ip_literal: true, allow_loopback: true }, allow: true },

	// === private RFC1918 ===
	{ tag: "10.0.0.1 denied default", input: "http://10.0.0.1/", allowlist: ["10.0.0.1"], opts: { allow_ip_literal: true }, allow: false, reason: "private_not_allowed" },
	{ tag: "172.16.0.1 denied default", input: "http://172.16.0.1/", allowlist: ["172.16.0.1"], opts: { allow_ip_literal: true }, allow: false, reason: "private_not_allowed" },
	{ tag: "172.31.255.255 denied default", input: "http://172.31.255.255/", allowlist: ["172.31.255.255"], opts: { allow_ip_literal: true }, allow: false, reason: "private_not_allowed" },
	{ tag: "172.15.0.1 NOT private (boundary)", input: "http://172.15.0.1/", allowlist: ["172.15.0.1"], opts: { allow_ip_literal: true }, allow: true },
	{ tag: "172.32.0.1 NOT private (boundary)", input: "http://172.32.0.1/", allowlist: ["172.32.0.1"], opts: { allow_ip_literal: true }, allow: true },
	{ tag: "192.168.1.1 denied default", input: "http://192.168.1.1/", allowlist: ["192.168.1.1"], opts: { allow_ip_literal: true }, allow: false, reason: "private_not_allowed" },
	{ tag: "private allowed with opt-in", input: "http://10.0.0.1/", allowlist: ["10.0.0.1"], opts: { allow_ip_literal: true, allow_private: true }, allow: true },

	// === link-local (always denied) ===
	{ tag: "169.254.169.254 metadata IP always denied", input: "http://169.254.169.254/latest/meta-data/", allowlist: ["169.254.169.254"], opts: { allow_ip_literal: true, allow_loopback: true, allow_private: true }, allow: false, reason: "link_local_denied" },
	{ tag: "169.254.1.1 link-local IPv4", input: "http://169.254.1.1/", allowlist: ["169.254.1.1"], opts: { allow_ip_literal: true }, allow: false, reason: "link_local_denied" },
	{ tag: "[fe80::1] link-local IPv6", input: "http://[fe80::1]/", allowlist: ["[fe80::1]"], opts: { allow_ip_literal: true }, allow: false, reason: "link_local_denied" },

	// === IDN / punycode ===
	{ tag: "IDN denied by default", input: "http://пример.test/", allowlist: ["xn--e1afmkfd.test"], allow: false, reason: "idn_not_allowed" },
	{ tag: "punycode literal denied by default", input: "http://xn--e1afmkfd.test/", allowlist: ["xn--e1afmkfd.test"], allow: false, reason: "idn_not_allowed" },
	{ tag: "IDN allowed with allow_idn", input: "http://пример.test/", allowlist: ["xn--e1afmkfd.test"], opts: { allow_idn: true }, allow: true },
	{ tag: "Cyrillic 'a' homograph not on allowlist", input: "http://exаmple.com/", allowlist: ["example.com"], opts: { allow_idn: true }, allow: false, reason: "not_on_allowlist" },

	// === allowlist evasion ===
	{ tag: "prefix-collision attacker domain", input: "https://aexample.com/", allowlist: ["*.example.com"], allow: false },
	{ tag: "suffix-collision attacker domain", input: "https://example.com.evil.com/", allowlist: ["*.example.com"], allow: false },
	{ tag: "sibling host", input: "https://otherexample.com/", allowlist: ["example.com"], allow: false },
	{ tag: "double-dot host (path-like)", input: "https://example.com..evil.com/", allowlist: ["example.com"], allow: false },
	{ tag: "wildcard apex match", input: "https://example.com/", allowlist: ["*.example.com"], allow: true },
	{ tag: "wildcard sub match", input: "https://api.example.com/", allowlist: ["*.example.com"], allow: true },
	{ tag: "wildcard nested sub", input: "https://a.b.example.com/", allowlist: ["*.example.com"], allow: true },
	{ tag: "exact match", input: "https://api.github.com/x", allowlist: ["api.github.com"], allow: true },
	{ tag: "exact mismatch (uppercased pattern)", input: "https://api.github.com/", allowlist: ["API.GITHUB.COM"], allow: true /* pattern matcher is case-insensitive */ },

	// === port confusion ===
	{ tag: "default https port stripped", input: "https://example.com:443/", allowlist: ["example.com"], allow: true },
	{ tag: "default http port stripped", input: "http://example.com:80/", allowlist: ["example.com"], allow: true },
	{ tag: "non-default port preserved + must match", input: "https://example.com:8443/", allowlist: ["example.com:8443"], allow: true },
	{ tag: "non-default port mismatch", input: "https://example.com:8443/", allowlist: ["example.com:8080"], allow: false },
	{ tag: "non-default port no port-qualified entry matches host", input: "https://example.com:8443/", allowlist: ["example.com"], allow: true /* unqualified pattern accepts any port */ },
	{ tag: "port out of range", input: "https://example.com:99999/", allow: false /* invalid_url */ },
	{ tag: "port zero normalized to default", input: "https://example.com:0/", allowlist: ["example.com"], allow: true /* WHATWG normalizes :0 to default */ },

	// === case folding ===
	{ tag: "uppercase scheme", input: "HTTPS://example.com/", allowlist: ["example.com"], allow: true },
	{ tag: "uppercase host", input: "https://EXAMPLE.com/", allowlist: ["example.com"], allow: true },
	{ tag: "mixed case host + pattern", input: "https://Api.Example.com/", allowlist: ["api.example.com"], allow: true },

	// === percent encoding ===
	{ tag: "percent-encoded host bytes (evi%6c.com → evil.com)", input: "http://evi%6c.com/", allowlist: ["evil.com"], allow: true /* WHATWG decodes; if your allowlist has 'evil.com' it matches; rejection is at the explicit allowlist boundary */ },
	{ tag: "percent-encoded host on attacker domain", input: "http://evi%6c.com/", allowlist: ["example.com"], allow: false, reason: "not_on_allowlist" },

	// === empty / malformed ===
	{ tag: "empty string", input: "", allow: false, reason: "invalid_url" },
	{ tag: "garbage", input: "not a url", allow: false, reason: "invalid_url" },
	{ tag: "relative path", input: "/foo/bar", allow: false, reason: "invalid_url" },
	{ tag: "bare host", input: "example.com", allow: false, reason: "invalid_url" },
	{ tag: "scheme only", input: "https://", allow: false, reason: "invalid_url" },
	{ tag: "double-scheme parses to weird host (not on allowlist either way)", input: "http://https://example.com/", allow: false /* parser may accept it but the resolved host isn't on any normal allowlist */ },
	{ tag: "extreme broken brackets", input: "http://[invalid", allow: false, reason: "invalid_url" },

	// === path stays out of allowlist ===
	{ tag: "path is irrelevant to allow", input: "https://example.com/admin", allowlist: ["example.com"], allow: true },
	{ tag: "query string is irrelevant", input: "https://example.com/?q=1&r=2", allowlist: ["example.com"], allow: true },
	{ tag: "fragment is irrelevant", input: "https://example.com/#evil", allowlist: ["example.com"], allow: true },

	// === metadata IPs by hostname (some clouds) ===
	{ tag: "metadata.google.internal not on allowlist", input: "http://metadata.google.internal/", allow: false, reason: "not_on_allowlist" },
	{ tag: "metadata.google.internal on allowlist still has to be allowed by user", input: "http://metadata.google.internal/", allowlist: ["metadata.google.internal"], allow: true },

	// === edge real-world targets ===
	{ tag: "GitHub raw content allowed via wildcard", input: "https://raw.githubusercontent.com/foo/bar/main/x", allowlist: ["*.githubusercontent.com"], allow: true },
	{ tag: "GitHub gist allowed via wildcard", input: "https://gist.githubusercontent.com/anon/abc/raw/x", allowlist: ["*.githubusercontent.com"], allow: true },
	{ tag: "GitHub api allowed via exact", input: "https://api.github.com/repos/x/y", allowlist: ["api.github.com"], allow: true },
	{ tag: "npm registry allowed", input: "https://registry.npmjs.org/foo", allowlist: ["registry.npmjs.org"], allow: true },
	{ tag: "PyPI allowed via wildcard", input: "https://files.pythonhosted.org/packages/x/y", allowlist: ["*.pythonhosted.org"], allow: true },
	{ tag: "Sigstore Rekor allowed", input: "https://rekor.sigstore.dev/api/v1/log", allowlist: ["rekor.sigstore.dev"], allow: true },
	{ tag: "Slack webhook unlisted", input: "https://hooks.slack.com/services/T/X/Y", allowlist: ["api.github.com"], allow: false, reason: "not_on_allowlist" },
	{ tag: "Discord webhook unlisted", input: "https://discord.com/api/webhooks/x/y", allowlist: ["api.github.com"], allow: false },
	{ tag: "S3 bucket via virtual-host style unlisted", input: "https://attacker-bucket.s3.amazonaws.com/x", allowlist: ["api.github.com"], allow: false },
	{ tag: "S3 bucket via wildcard amazonaws.com", input: "https://attacker-bucket.s3.amazonaws.com/x", allowlist: ["*.amazonaws.com"], allow: true },
	{ tag: "Pastebin unlisted", input: "https://pastebin.com/raw/X", allowlist: ["api.github.com"], allow: false },
];

describe("URL canonicalization adversarial corpus (≥80 fixtures)", () => {
	it("has at least 80 fixtures (design 3.4 contract)", () => {
		expect(FIXTURES.length).toBeGreaterThanOrEqual(80);
	});

	for (const fx of FIXTURES) {
		const allowlist = A(...(fx.allowlist ?? []));
		const opts = fx.opts ?? {};
		it(fx.tag, () => {
			const d = decideUrlPolicy(fx.input, allowlist, opts);
			expect(d.allow, `expected allow=${fx.allow} for "${fx.input}", got reason=${d.reason}`).toBe(
				fx.allow,
			);
			if (fx.reason) {
				expect(d.reason).toBe(fx.reason);
			}
		});
	}
});

describe("canonicalizeUrl produces stable identity for equivalent inputs", () => {
	const inputs = [
		"https://example.com",
		"https://example.com/",
		"https://EXAMPLE.com/",
		"HTTPS://example.com:443/",
		"https://example.com:443/",
	];

	it("all five normalize to the same canonical string", () => {
		const canons = inputs.map((i) => {
			const r = canonicalizeUrl(i);
			expect(r.ok).toBe(true);
			return r.ok ? r.canonical : null;
		});
		const set = new Set(canons);
		expect(set.size).toBe(1);
	});
});
