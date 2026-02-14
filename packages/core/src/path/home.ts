import { homedir } from "node:os";
import { join } from "node:path";

export function getHomeDir(): string {
	return process.env.HOME || process.env.USERPROFILE || homedir();
}

export function homePath(...parts: string[]): string {
	return join(getHomeDir(), ...parts);
}
