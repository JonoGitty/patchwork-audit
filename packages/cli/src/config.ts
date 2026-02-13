/**
 * Config loader and enforcement profile resolver.
 *
 * Resolution order: CLI flags > config file > profile defaults > built-in defaults.
 *
 * Config files follow the same resolution pattern as the policy loader:
 *   1. Project-level: .patchwork/config.yml (in cwd)
 *   2. User-level:    ~/.patchwork/config.yml
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Zod schemas — strict variant rejects unknown keys, base strips them
// ---------------------------------------------------------------------------

const VerifyConfigSectionSchemaBase = z.object({
	profile: z.string().optional(),
	max_seal_age_seconds: z.number().int().positive().optional(),
	max_witness_age_seconds: z.number().int().positive().optional(),
	max_attestation_age_seconds: z.number().int().positive().optional(),
	remote_witness_quorum: z.number().int().positive().optional(),
	remote_witness_timeout_ms: z.number().int().positive().optional(),
	require_seal: z.boolean().optional(),
	require_witness: z.boolean().optional(),
	require_signed_attestation: z.boolean().optional(),
	require_attestation_binding: z.boolean().optional(),
	require_remote_witness_proof: z.boolean().optional(),
	strict_attestation_file: z.boolean().optional(),
	token_env: z.string().optional(),
});

const PatchworkConfigSchemaBase = z.object({
	verify: VerifyConfigSectionSchemaBase.optional(),
});

const VerifyConfigSectionSchemaStrict = VerifyConfigSectionSchemaBase.strict();
const PatchworkConfigSchemaStrict = z.object({
	verify: VerifyConfigSectionSchemaStrict.optional(),
}).strict();

// ---------------------------------------------------------------------------
// Config file types (derived from Zod)
// ---------------------------------------------------------------------------

export type VerifyConfigSection = z.infer<typeof VerifyConfigSectionSchemaBase>;
export type PatchworkConfig = z.infer<typeof PatchworkConfigSchemaBase>;

// ---------------------------------------------------------------------------
// Validation types
// ---------------------------------------------------------------------------

export interface ConfigValidationError {
	path: string;
	message: string;
}

export interface ConfigValidationResult {
	status: "valid" | "invalid";
	errors: ConfigValidationError[];
}

const VALID_RESULT: ConfigValidationResult = { status: "valid", errors: [] };

export interface LoadedConfig {
	config: PatchworkConfig;
	source: string; // file path or "none"
	validation: ConfigValidationResult;
}

// ---------------------------------------------------------------------------
// Resolved defaults (output of the merge pipeline)
// ---------------------------------------------------------------------------

export interface ResolvedVerifyDefaults {
	requireSeal: boolean;
	requireWitness: boolean;
	requireRemoteWitnessProof: boolean;
	requireSignedAttestation: boolean;
	requireAttestationBinding: boolean;
	strictAttestationFile: boolean;
	maxSealAgeSeconds?: string;
	maxWitnessAgeSeconds?: string;
	maxAttestationAgeSeconds?: string;
	remoteWitnessQuorum?: string;
	remoteWitnessTimeoutMs?: string;
	tokenEnv?: string;
}

export interface ResolvedPolicy {
	defaults: ResolvedVerifyDefaults;
	profileName: string;
	configSource: string;
	configValidation: ConfigValidationResult;
}

// ---------------------------------------------------------------------------
// Profile definitions
// ---------------------------------------------------------------------------

const PROFILES: Record<string, Partial<ResolvedVerifyDefaults>> = {
	strict: {
		requireSeal: true,
		requireWitness: true,
		requireRemoteWitnessProof: true,
		requireSignedAttestation: true,
		requireAttestationBinding: true,
		strictAttestationFile: true,
	},
	baseline: {
		// all false/undefined — current default behavior
	},
};

// ---------------------------------------------------------------------------
// Config file loading
// ---------------------------------------------------------------------------

export function loadConfig(cwd?: string): LoadedConfig {
	if (cwd) {
		const projectPath = join(cwd, ".patchwork", "config.yml");
		if (existsSync(projectPath)) {
			const parsed = parseConfigFile(projectPath);
			return { config: parsed.config, source: projectPath, validation: parsed.validation };
		}
	}

	const userPath = join(process.env.HOME || "~", ".patchwork", "config.yml");
	if (existsSync(userPath)) {
		const parsed = parseConfigFile(userPath);
		return { config: parsed.config, source: userPath, validation: parsed.validation };
	}

	return { config: {}, source: "none", validation: VALID_RESULT };
}

function parseConfigFile(path: string): { config: PatchworkConfig; validation: ConfigValidationResult } {
	try {
		const content = readFileSync(path, "utf-8");
		const raw = YAML.parse(content);
		if (!raw || typeof raw !== "object") {
			return {
				config: {},
				validation: { status: "invalid", errors: [{ path: "", message: "Config file is not a YAML object" }] },
			};
		}

		// Strict validation — detect unknown keys + type errors
		const strictResult = PatchworkConfigSchemaStrict.safeParse(raw);
		const validation: ConfigValidationResult = strictResult.success
			? VALID_RESULT
			: { status: "invalid", errors: formatZodErrors(strictResult.error.issues) };

		// Lenient parse — extract only known, valid keys for runtime use
		const lenientResult = PatchworkConfigSchemaBase.safeParse(raw);
		const config = lenientResult.success ? lenientResult.data : {};

		return { config, validation };
	} catch {
		return {
			config: {},
			validation: { status: "invalid", errors: [{ path: "", message: "Failed to parse YAML" }] },
		};
	}
}

function formatZodErrors(issues: z.ZodIssue[]): ConfigValidationError[] {
	const errors: ConfigValidationError[] = [];
	for (const issue of issues) {
		if (issue.code === "unrecognized_keys") {
			for (const key of issue.keys) {
				errors.push({
					path: [...issue.path, key].join("."),
					message: "Unrecognized key",
				});
			}
		} else {
			errors.push({
				path: issue.path.join("."),
				message: issue.message,
			});
		}
	}
	return errors;
}

// ---------------------------------------------------------------------------
// Resolution pipeline
// ---------------------------------------------------------------------------

const BASE_DEFAULTS: ResolvedVerifyDefaults = {
	requireSeal: false,
	requireWitness: false,
	requireRemoteWitnessProof: false,
	requireSignedAttestation: false,
	requireAttestationBinding: false,
	strictAttestationFile: false,
};

/**
 * Resolve verify defaults from profile + config + CLI flags.
 *
 * Resolution order: CLI flags > config file > profile > built-in defaults.
 */
export function resolveVerifyDefaults(opts: {
	profile?: string;
	cliFlags: Record<string, unknown>;
	config: PatchworkConfig;
	configSource: string;
	configValidation?: ConfigValidationResult;
}): ResolvedPolicy {
	// 1. Start with base defaults
	const result: ResolvedVerifyDefaults = { ...BASE_DEFAULTS };

	// 2. Determine profile name (CLI --profile > config.verify.profile > "baseline")
	const profileName = opts.profile || opts.config.verify?.profile || "baseline";
	const profileDefaults = PROFILES[profileName] || PROFILES.baseline;
	Object.assign(result, profileDefaults);

	// 3. Apply config file values (snake_case → camelCase)
	const vc = opts.config.verify;
	if (vc) {
		if (vc.require_seal === true) result.requireSeal = true;
		if (vc.require_seal === false) result.requireSeal = false;
		if (vc.require_witness === true) result.requireWitness = true;
		if (vc.require_witness === false) result.requireWitness = false;
		if (vc.require_remote_witness_proof === true) result.requireRemoteWitnessProof = true;
		if (vc.require_remote_witness_proof === false) result.requireRemoteWitnessProof = false;
		if (vc.require_signed_attestation === true) result.requireSignedAttestation = true;
		if (vc.require_signed_attestation === false) result.requireSignedAttestation = false;
		if (vc.require_attestation_binding === true) result.requireAttestationBinding = true;
		if (vc.require_attestation_binding === false) result.requireAttestationBinding = false;
		if (vc.strict_attestation_file === true) result.strictAttestationFile = true;
		if (vc.strict_attestation_file === false) result.strictAttestationFile = false;
		if (vc.max_seal_age_seconds !== undefined) result.maxSealAgeSeconds = String(vc.max_seal_age_seconds);
		if (vc.max_witness_age_seconds !== undefined) result.maxWitnessAgeSeconds = String(vc.max_witness_age_seconds);
		if (vc.max_attestation_age_seconds !== undefined) result.maxAttestationAgeSeconds = String(vc.max_attestation_age_seconds);
		if (vc.remote_witness_quorum !== undefined) result.remoteWitnessQuorum = String(vc.remote_witness_quorum);
		if (vc.remote_witness_timeout_ms !== undefined) result.remoteWitnessTimeoutMs = String(vc.remote_witness_timeout_ms);
		if (vc.token_env !== undefined) result.tokenEnv = vc.token_env;
	}

	// 4. Apply CLI flags (only explicitly-set values override)
	const f = opts.cliFlags;
	if (f.requireSeal === true) result.requireSeal = true;
	if (f.requireWitness === true) result.requireWitness = true;
	if (f.requireRemoteWitnessProof === true) result.requireRemoteWitnessProof = true;
	if (f.requireSignedAttestation === true) result.requireSignedAttestation = true;
	if (f.requireAttestationBinding === true) result.requireAttestationBinding = true;
	if (f.strictAttestationFile === true) result.strictAttestationFile = true;
	if (typeof f.maxSealAgeSeconds === "string") result.maxSealAgeSeconds = f.maxSealAgeSeconds;
	if (typeof f.maxWitnessAgeSeconds === "string") result.maxWitnessAgeSeconds = f.maxWitnessAgeSeconds;
	if (typeof f.maxAttestationAgeSeconds === "string") result.maxAttestationAgeSeconds = f.maxAttestationAgeSeconds;
	if (typeof f.remoteWitnessQuorum === "string") result.remoteWitnessQuorum = f.remoteWitnessQuorum;
	if (typeof f.remoteWitnessTimeoutMs === "string") result.remoteWitnessTimeoutMs = f.remoteWitnessTimeoutMs;
	if (typeof f.tokenEnv === "string") result.tokenEnv = f.tokenEnv;

	// CLI --no-seal-check / --no-witness-check / --no-attestation-check can disable profile enforcement
	// Commander negates --no-X-check to sealCheck: false
	if (f.sealCheck === false) result.requireSeal = false;
	if (f.witnessCheck === false) result.requireWitness = false;
	if (f.remoteWitnessCheck === false) result.requireRemoteWitnessProof = false;
	if (f.attestationCheck === false) {
		result.requireSignedAttestation = false;
		result.requireAttestationBinding = false;
		result.strictAttestationFile = false;
	}

	return {
		defaults: result,
		profileName,
		configSource: opts.configSource,
		configValidation: opts.configValidation || VALID_RESULT,
	};
}
