import { Hono } from "hono";

const startedAt = Date.now();

export function healthRoutes(): Hono {
	const app = new Hono();

	app.get("/api/v1/health", (c) => {
		return c.json({
			ok: true,
			version: "0.6.3",
			uptime_ms: Date.now() - startedAt,
		});
	});

	return app;
}
