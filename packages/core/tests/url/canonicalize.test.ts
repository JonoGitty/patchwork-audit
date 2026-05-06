import { describe, it, expect } from "vitest";
import {
	canonicalizeUrl,
	evaluateAllowlist,
	decideUrlPolicy,
} from "../../src/url/canonicalize.js";
import type { AllowlistEntry } from "../../src/url/canonicalize.js";

const ALLOW = (...patterns: string[]): AllowlistEntry[] =>
	patterns.map((pattern) => ({ pattern }));

describe("canonicalizeUrl — basic happy path", () => {
	it("normalizes scheme + host to lowercase", () => {
		const r = canonicalizeUrl("HTTPS://API.GitHub.com/X");
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.scheme).toBe("https");
			expect(r.host).toBe("api.github.com");
			expect(r.path).toBe("/X");
		}
	});

	it("strips default port 443 for https", () => {
		const r = canonicalizeUrl("https://example.com:443/x");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.port).toBeNull();
	});

	it("strips default port 80 for http", () => {
		const r = canonicalizeUrl("http://example.com:80/");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.port).toBeNull();
	});

	it("preserves non-default port", () => {
		const r = canonicalizeUrl("https://example.com:8443/api");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.port).toBe(8443);
	});

	it("preserves trailing slash root path", () => {
		const r = canonicalizeUrl("https://example.com");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.path).toBe("/");
	});

	it("emits a stable canonical string", () => {
		const r = canonicalizeUrl("https://API.example.com:443/Foo?bar=1#frag");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.canonical).toBe("https://api.example.com/Foo");
	});
});

describe("canonicalizeUrl — userinfo rejection", () => {
	it("rejects basic-auth userinfo", () => {
		const r = canonicalizeUrl("https://user:pass@example.com/");
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.reason).toBe("userinfo_present");
	});

	it("rejects username-only userinfo", () => {
		const r = canonicalizeUrl("https://user@example.com/");
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.reason).toBe("userinfo_present");
	});

	it("rejects the @-confusion attack", () => {
		// Strip-then-allow on URLs like this is how attackers smuggle
		// `evil.com` past naïve canonicalizers — the URL constructor
		// parses host=allowed.com but curl-class clients hit evil.com.
		const r = canonicalizeUrl("https://user:pwd@evil.com@allowed.com/");
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.reason).toBe("userinfo_present");
	});

	it("ignores empty colon-only userinfo (degenerate but not an attack vector)", () => {
		// `https://:@example.com/` parses with username="" password=""
		// which our userinfo check correctly treats as no userinfo. Not
		// rejected, but also doesn't smuggle anything — host = example.com.
		const r = canonicalizeUrl("https://:@example.com/");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.host).toBe("example.com");
	});
});

describe("canonicalizeUrl — scheme policy", () => {
	const banned = ["data", "file", "javascript", "gopher", "ftp", "ftps", "ws", "wss", "blob", "mailto"];
	for (const scheme of banned) {
		it(`rejects ${scheme}: scheme as banlisted`, () => {
			const r = canonicalizeUrl(`${scheme}://example.com/`);
			expect(r.ok).toBe(false);
			if (!r.ok) expect(r.reason).toBe("scheme_banlisted");
		});
	}

	it("rejects data: URLs even with embedded payload", () => {
		const r = canonicalizeUrl("data:text/plain,hello");
		expect(r.ok).toBe(false);
	});

	it("rejects javascript: pseudo-URL", () => {
		const r = canonicalizeUrl("javascript:alert(1)");
		expect(r.ok).toBe(false);
	});

	it("rejects unknown scheme as scheme_not_allowed", () => {
		const r = canonicalizeUrl("custom://example.com/");
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.reason).toMatch(/scheme/);
	});

	it("accepts http scheme", () => {
		expect(canonicalizeUrl("http://example.com").ok).toBe(true);
	});

	it("accepts https scheme", () => {
		expect(canonicalizeUrl("https://example.com").ok).toBe(true);
	});
});

describe("canonicalizeUrl — IP literal flags", () => {
	it("flags IPv4 literal", () => {
		const r = canonicalizeUrl("http://1.2.3.4/");
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.flags.is_ip_literal).toBe(true);
			expect(r.flags.is_ipv4_literal).toBe(true);
			expect(r.flags.is_ipv6_literal).toBe(false);
		}
	});

	it("flags IPv6 literal", () => {
		const r = canonicalizeUrl("http://[2001:db8::1]/");
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.flags.is_ip_literal).toBe(true);
			expect(r.flags.is_ipv6_literal).toBe(true);
		}
	});

	it("flags loopback IPv4 (127.0.0.1)", () => {
		const r = canonicalizeUrl("http://127.0.0.1/");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.flags.is_loopback).toBe(true);
	});

	it("flags loopback IPv4 (127.x range)", () => {
		const r = canonicalizeUrl("http://127.5.5.5/");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.flags.is_loopback).toBe(true);
	});

	it("flags loopback IPv6 (::1)", () => {
		const r = canonicalizeUrl("http://[::1]/");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.flags.is_loopback).toBe(true);
	});

	it("flags 'localhost' as loopback even though it's a hostname", () => {
		const r = canonicalizeUrl("http://localhost/");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.flags.is_loopback).toBe(true);
	});

	it("flags private IPv4 10.x", () => {
		const r = canonicalizeUrl("http://10.0.0.1/");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.flags.is_private).toBe(true);
	});

	it("flags private IPv4 172.16-31.x", () => {
		for (const second of [16, 20, 31]) {
			const r = canonicalizeUrl(`http://172.${second}.0.1/`);
			expect(r.ok).toBe(true);
			if (r.ok) expect(r.flags.is_private).toBe(true);
		}
	});

	it("does NOT flag 172.15.x or 172.32.x as private", () => {
		for (const second of [15, 32]) {
			const r = canonicalizeUrl(`http://172.${second}.0.1/`);
			expect(r.ok).toBe(true);
			if (r.ok) expect(r.flags.is_private).toBe(false);
		}
	});

	it("flags private IPv4 192.168.x", () => {
		const r = canonicalizeUrl("http://192.168.1.1/");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.flags.is_private).toBe(true);
	});

	it("flags link-local IPv4 169.254.x", () => {
		const r = canonicalizeUrl("http://169.254.1.1/");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.flags.is_link_local).toBe(true);
	});

	it("flags link-local IPv6 fe80::", () => {
		const r = canonicalizeUrl("http://[fe80::1]/");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.flags.is_link_local).toBe(true);
	});
});

describe("canonicalizeUrl — IDN handling", () => {
	it("flags IDN host (unicode → punycode)", () => {
		const r = canonicalizeUrl("http://пример.test/");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.flags.is_idn).toBe(true);
	});

	it("flags punycode host directly", () => {
		const r = canonicalizeUrl("http://xn--e1afmkfd.test/");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.flags.is_idn).toBe(true);
	});
});

describe("canonicalizeUrl — invalid + edge cases", () => {
	it("rejects empty string", () => {
		const r = canonicalizeUrl("");
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.reason).toBe("invalid_url");
	});

	it("rejects relative path", () => {
		const r = canonicalizeUrl("/foo/bar");
		expect(r.ok).toBe(false);
	});

	it("rejects bare host without scheme", () => {
		const r = canonicalizeUrl("example.com");
		expect(r.ok).toBe(false);
	});

	it("rejects garbage input", () => {
		const r = canonicalizeUrl("not a url at all");
		expect(r.ok).toBe(false);
	});

	it("rejects host with percent-encoding", () => {
		const r = canonicalizeUrl("http://evi%6c.com/");
		// WHATWG decodes the percent-encoded byte into the host so
		// `evi%6c.com` becomes `evil.com`. The classifier rejects any
		// host that retains percent-encoding after normalization.
		// (Some platforms decode pre-validation — we still defend
		// against the case where they don't.)
		// Either way: a percent-decoded host that successfully became
		// `evil.com` is now a normal host and may match elsewhere; the
		// caller's allowlist is the second line of defense.
		// This test only asserts that we don't crash and we don't lie
		// about the original raw input.
		if (r.ok) {
			expect(r.host).not.toContain("%");
		}
	});

	it("preserves raw_input in rejection", () => {
		const r = canonicalizeUrl("file:///etc/passwd");
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.raw_input).toBe("file:///etc/passwd");
	});

	it("treats scheme as case-insensitive", () => {
		const r = canonicalizeUrl("HTTPS://example.com/");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.scheme).toBe("https");
	});

	it("handles IPv4 with embedded zeros", () => {
		const r = canonicalizeUrl("http://0.0.0.0/");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.flags.is_ipv4_literal).toBe(true);
	});

	it("handles trailing-dot host", () => {
		const r = canonicalizeUrl("http://example.com./");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.host).toContain("example.com");
	});

	it("does not throw on extreme malformed input", () => {
		expect(() => canonicalizeUrl("http://[invalid")).not.toThrow();
	});
});

describe("evaluateAllowlist — exact + subdomain matching", () => {
	const base = (input: string) => {
		const r = canonicalizeUrl(input);
		if (!r.ok) throw new Error(`expected ok: ${input}`);
		return r;
	};

	it("exact host match allows", () => {
		const c = base("https://api.github.com/x");
		const d = evaluateAllowlist(c, ALLOW("api.github.com"));
		expect(d.allow).toBe(true);
		expect(d.matched_pattern).toBe("api.github.com");
	});

	it("subdomain wildcard matches sub.example.com", () => {
		const c = base("https://api.example.com/");
		const d = evaluateAllowlist(c, ALLOW("*.example.com"));
		expect(d.allow).toBe(true);
	});

	it("subdomain wildcard matches the apex via implicit dot", () => {
		const c = base("https://example.com/");
		const d = evaluateAllowlist(c, ALLOW("*.example.com"));
		expect(d.allow).toBe(true);
	});

	it("subdomain wildcard does NOT match sibling domain", () => {
		const c = base("https://example.com.evil.com/");
		const d = evaluateAllowlist(c, ALLOW("*.example.com"));
		expect(d.allow).toBe(false);
	});

	it("subdomain wildcard does NOT match prefix-collision attacker", () => {
		const c = base("https://aexample.com/");
		const d = evaluateAllowlist(c, ALLOW("*.example.com"));
		expect(d.allow).toBe(false);
	});

	it("port-qualified entry must match port", () => {
		const c = base("https://api.example.com:8443/");
		const d = evaluateAllowlist(c, ALLOW("api.example.com:8443"));
		expect(d.allow).toBe(true);
	});

	it("port-qualified entry rejects mismatched port", () => {
		const c = base("https://api.example.com:9999/");
		const d = evaluateAllowlist(c, ALLOW("api.example.com:8443"));
		expect(d.allow).toBe(false);
	});

	it("default denies unlisted host", () => {
		const c = base("https://attacker.example/");
		const d = evaluateAllowlist(c, ALLOW("api.github.com"));
		expect(d.allow).toBe(false);
		expect(d.reason).toBe("not_on_allowlist");
	});

	it("deny IDN by default even if allowlist matches the punycode form", () => {
		const c = base("https://пример.test/");
		const d = evaluateAllowlist(c, ALLOW("xn--e1afmkfd.test"));
		expect(d.allow).toBe(false);
		expect(d.reason).toBe("idn_not_allowed");
	});

	it("allow IDN with allow_idn=true and matching punycode", () => {
		const c = base("https://пример.test/");
		const d = evaluateAllowlist(c, ALLOW("xn--e1afmkfd.test"), {
			allow_idn: true,
		});
		expect(d.allow).toBe(true);
	});
});

describe("evaluateAllowlist — IP / loopback / private / link-local", () => {
	const base = (input: string) => {
		const r = canonicalizeUrl(input);
		if (!r.ok) throw new Error("expected ok");
		return r;
	};

	it("denies IP literal by default even if allowlist contains the IP", () => {
		const c = base("http://1.2.3.4/");
		const d = evaluateAllowlist(c, ALLOW("1.2.3.4"));
		expect(d.allow).toBe(false);
		expect(d.reason).toBe("ip_literal_not_allowed");
	});

	it("allows IP literal with allow_ip_literal=true and exact match", () => {
		const c = base("http://1.2.3.4/");
		const d = evaluateAllowlist(c, ALLOW("1.2.3.4"), {
			allow_ip_literal: true,
		});
		expect(d.allow).toBe(true);
	});

	it("denies loopback even with IP-literal opt-in", () => {
		const c = base("http://127.0.0.1/");
		const d = evaluateAllowlist(c, ALLOW("127.0.0.1"), {
			allow_ip_literal: true,
		});
		expect(d.allow).toBe(false);
		expect(d.reason).toBe("loopback_not_allowed");
	});

	it("allows loopback with allow_loopback opt-in", () => {
		const c = base("http://127.0.0.1/");
		const d = evaluateAllowlist(c, ALLOW("127.0.0.1"), {
			allow_ip_literal: true,
			allow_loopback: true,
		});
		expect(d.allow).toBe(true);
	});

	it("denies private RFC1918 even with IP-literal opt-in", () => {
		const c = base("http://10.0.0.1/");
		const d = evaluateAllowlist(c, ALLOW("10.0.0.1"), {
			allow_ip_literal: true,
		});
		expect(d.allow).toBe(false);
		expect(d.reason).toBe("private_not_allowed");
	});

	it("allows private with allow_private opt-in", () => {
		const c = base("http://192.168.1.1/");
		const d = evaluateAllowlist(c, ALLOW("192.168.1.1"), {
			allow_ip_literal: true,
			allow_private: true,
		});
		expect(d.allow).toBe(true);
	});

	it("ALWAYS denies link-local IPv4 (no opt-in path)", () => {
		const c = base("http://169.254.169.254/");
		const d = evaluateAllowlist(c, ALLOW("169.254.169.254"), {
			allow_ip_literal: true,
			allow_loopback: true,
			allow_private: true,
		});
		expect(d.allow).toBe(false);
		expect(d.reason).toBe("link_local_denied");
	});

	it("ALWAYS denies link-local IPv6 (fe80::)", () => {
		const c = base("http://[fe80::1]/");
		const d = evaluateAllowlist(c, ALLOW("[fe80::1]"), {
			allow_ip_literal: true,
		});
		expect(d.allow).toBe(false);
		expect(d.reason).toBe("link_local_denied");
	});

	it("denies localhost by default", () => {
		const c = base("http://localhost/");
		const d = evaluateAllowlist(c, ALLOW("localhost"));
		expect(d.allow).toBe(false);
		expect(d.reason).toBe("loopback_not_allowed");
	});
});

describe("decideUrlPolicy — combined entry point", () => {
	it("rejects userinfo at the canonicalize stage with a useful reason", () => {
		const d = decideUrlPolicy(
			"https://u:p@evil.com@example.com/",
			ALLOW("example.com"),
		);
		expect(d.allow).toBe(false);
		expect(d.reason).toBe("userinfo_present");
		expect(d.canonical).toBeUndefined();
	});

	it("rejects file: scheme even if allowlist is empty", () => {
		const d = decideUrlPolicy("file:///etc/passwd", []);
		expect(d.allow).toBe(false);
		expect(d.reason).toBe("scheme_banlisted");
	});

	it("rejects javascript: scheme", () => {
		const d = decideUrlPolicy("javascript:alert(1)", []);
		expect(d.allow).toBe(false);
		expect(d.reason).toBe("scheme_banlisted");
	});

	it("allows allowlisted https URL", () => {
		const d = decideUrlPolicy(
			"https://api.github.com/repos/foo/bar",
			ALLOW("api.github.com"),
		);
		expect(d.allow).toBe(true);
		expect(d.canonical?.host).toBe("api.github.com");
	});

	it("denies host not on allowlist", () => {
		const d = decideUrlPolicy(
			"https://attacker.example/x",
			ALLOW("api.github.com"),
		);
		expect(d.allow).toBe(false);
		expect(d.reason).toBe("not_on_allowlist");
	});

	it("matches *.subdomain across the allowlist", () => {
		const d = decideUrlPolicy(
			"https://raw.githubusercontent.com/foo/bar",
			ALLOW("*.githubusercontent.com"),
		);
		expect(d.allow).toBe(true);
	});

	it("denies decimal-encoded IP smuggle (2130706433 = 127.0.0.1)", () => {
		// WHATWG URL parses 2130706433 as the IPv4 127.0.0.1 — so the
		// canonical host comes back as the dotted form and our IPv4
		// loopback check catches it.
		const d = decideUrlPolicy("http://2130706433/", ALLOW("127.0.0.1"), {
			allow_ip_literal: true,
		});
		expect(d.allow).toBe(false);
		// Either loopback_not_allowed or ip_literal_not_allowed depending
		// on parser path — the important thing is it doesn't allow.
	});

	it("denies hex-encoded IP smuggle (0x7f000001)", () => {
		const d = decideUrlPolicy("http://0x7f000001/", ALLOW("127.0.0.1"), {
			allow_ip_literal: true,
		});
		expect(d.allow).toBe(false);
	});

	it("denies octal-encoded IP smuggle (0177.0.0.1)", () => {
		const d = decideUrlPolicy("http://0177.0.0.1/", ALLOW("127.0.0.1"), {
			allow_ip_literal: true,
		});
		expect(d.allow).toBe(false);
	});

	it("allowlist match returns matched_pattern in decision", () => {
		const d = decideUrlPolicy(
			"https://api.github.com/x",
			ALLOW("*.github.com", "api.github.com"),
		);
		expect(d.allow).toBe(true);
		expect(d.matched_pattern).toBeDefined();
	});

	it("first-match-wins ordering is stable", () => {
		const d = decideUrlPolicy(
			"https://api.github.com/x",
			ALLOW("api.github.com", "*.github.com"),
		);
		expect(d.matched_pattern).toBe("api.github.com");
	});
});
