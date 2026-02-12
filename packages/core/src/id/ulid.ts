import { ulid } from "ulidx";

export function generateEventId(): string {
	return `evt_${ulid()}`;
}

export function generateSessionId(): string {
	return `ses_${ulid()}`;
}
