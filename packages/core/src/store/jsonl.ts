import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { AuditEvent } from "../schema/event.js";
import type { EventFilter, Store } from "./types.js";

/**
 * Append-only JSONL store for audit events.
 * Design principle from Tool Factory: thread-safe, immutable, greppable.
 */
export class JsonlStore implements Store {
	constructor(private readonly filePath: string) {
		const dir = dirname(filePath);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
	}

	append(event: AuditEvent): void {
		const line = JSON.stringify(event) + "\n";
		appendFileSync(this.filePath, line, "utf-8");
	}

	readAll(): AuditEvent[] {
		if (!existsSync(this.filePath)) {
			return [];
		}
		const content = readFileSync(this.filePath, "utf-8");
		return content
			.split("\n")
			.filter((line) => line.trim().length > 0)
			.map((line) => JSON.parse(line) as AuditEvent);
	}

	readRecent(limit: number): AuditEvent[] {
		const all = this.readAll();
		return all.slice(-limit);
	}

	query(filter: EventFilter): AuditEvent[] {
		let events = this.readAll();

		if (filter.agent) {
			events = events.filter((e) => e.agent === filter.agent);
		}
		if (filter.action) {
			events = events.filter((e) => e.action === filter.action);
		}
		if (filter.minRisk) {
			const order = ["none", "low", "medium", "high", "critical"];
			const minIdx = order.indexOf(filter.minRisk);
			events = events.filter((e) => order.indexOf(e.risk.level) >= minIdx);
		}
		if (filter.sessionId) {
			events = events.filter((e) => e.session_id === filter.sessionId);
		}
		if (filter.since) {
			const sinceTs = filter.since.toISOString();
			events = events.filter((e) => e.timestamp >= sinceTs);
		}
		if (filter.targetGlob) {
			const pattern = filter.targetGlob;
			events = events.filter((e) => {
				const path = e.target?.path || e.target?.abs_path || "";
				return path.includes(pattern.replace(/\*/g, ""));
			});
		}
		if (filter.projectName) {
			events = events.filter((e) => e.project?.name === filter.projectName);
		}

		if (filter.limit) {
			events = events.slice(-filter.limit);
		}

		return events;
	}

	get path(): string {
		return this.filePath;
	}
}
