/**
 * Machine identity — platform-specific hardware ID extraction.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { hostname, release, platform } from "node:os";

/**
 * Get a stable hardware ID for this machine.
 * - macOS: IOPlatformUUID from ioreg
 * - Linux: /etc/machine-id
 * - Windows: MachineGuid from registry
 *
 * Returns a non-empty string, or falls back to hostname + platform.
 */
export function getMachineHardwareId(): string {
	try {
		switch (process.platform) {
			case "darwin": {
				const output = execSync(
					"ioreg -rd1 -c IOPlatformExpertDevice",
					{ encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] },
				);
				const match = output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
				if (match?.[1]) return match[1];
				break;
			}

			case "linux": {
				if (existsSync("/etc/machine-id")) {
					const id = readFileSync("/etc/machine-id", "utf-8").trim();
					if (id) return id;
				}
				if (existsSync("/sys/class/dmi/id/product_uuid")) {
					const id = readFileSync("/sys/class/dmi/id/product_uuid", "utf-8").trim();
					if (id) return id;
				}
				break;
			}

			case "win32": {
				const output = execSync(
					'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
					{ encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] },
				);
				const match = output.match(/MachineGuid\s+REG_SZ\s+(\S+)/);
				if (match?.[1]) return match[1];
				break;
			}
		}
	} catch {
		// Discovery failed — fall through to fallback
	}

	// Fallback: hostname + platform (less stable but always available)
	return `${hostname()}-${process.platform}-${release()}`;
}

/** Get the machine's hostname. */
export function getMachineName(): string {
	return hostname();
}

/** Get OS string (e.g. "darwin", "linux", "win32"). */
export function getMachineOS(): string {
	return platform();
}
