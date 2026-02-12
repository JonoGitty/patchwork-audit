import type { AuditEvent } from "../schema/event.js";

export interface EventFilter {
	agent?: string;
	action?: string;
	minRisk?: string;
	sessionId?: string;
	since?: Date;
	targetGlob?: string;
	projectName?: string;
	limit?: number;
}

export interface Store {
	append(event: AuditEvent): void;
	readAll(): AuditEvent[];
	readRecent(limit: number): AuditEvent[];
	query(filter: EventFilter): AuditEvent[];
	readonly path: string;
}

export interface SearchableStore extends Store {
	search(query: string, limit?: number): AuditEvent[];
}
