/**
 * Injectable HTTP client seam.
 *
 * All remote HTTP calls in the CLI go through this module so that tests can
 * mock `fetchJson` via `vi.spyOn` without spinning up real HTTP servers.
 */

export async function fetchJson(
	url: string,
	opts: { timeoutMs: number; bearerToken?: string },
): Promise<{ status: number; body: unknown }> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
	const headers: Record<string, string> = {};
	if (opts.bearerToken) {
		headers["Authorization"] = `Bearer ${opts.bearerToken}`;
	}
	try {
		const res = await fetch(url, { signal: controller.signal, headers });
		const body = await res.json();
		return { status: res.status, body };
	} finally {
		clearTimeout(timer);
	}
}
