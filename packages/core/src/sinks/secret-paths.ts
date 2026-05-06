/**
 * Credential-class paths for the `secret_read` sink.
 *
 * Reading any of these files registers `secret` taint in the session
 * (commit 3 wires this). Direct flow from a `secret_read` to a network
 * sink (commit 4+) is then unconditional-deny per design §2.
 * (`direct_secret_to_network`). The `secret_read` sink itself does not
 * block -- secret reads are legitimate (e.g. `gh auth status` reads
 * `~/.config/gh/hosts.yml`); the danger is what happens next.
 *
 * Keeping this list tight is important: false positives create alert
 * fatigue. Each entry should be a path that legitimately contains
 * exfilable credentials, not "interesting config that looks
 * credential-shaped".
 */

export interface SecretPattern {
	pattern: string;
	label: string;
}

export const SECRET_PATTERNS: readonly SecretPattern[] = [
	{ pattern: "~/.ssh/id_*", label: "SSH private key" },
	{ pattern: "~/.ssh/*.pem", label: "SSH/TLS PEM key" },
	{ pattern: "~/.ssh/*_rsa", label: "SSH RSA private key" },
	{ pattern: "~/.ssh/*_ed25519", label: "SSH ed25519 private key" },
	{ pattern: "~/.ssh/*ecdsa", label: "SSH ECDSA private key" },
	{ pattern: "~/.ssh/identity", label: "SSH legacy identity" },
	{ pattern: "~/.aws/credentials", label: "AWS credentials" },
	{ pattern: "~/.aws/config", label: "AWS config (may contain SSO tokens)" },
	{ pattern: "~/.aws/sso/**", label: "AWS SSO cache" },
	{ pattern: "~/.config/gcloud/credentials.db", label: "gcloud credentials" },
	{ pattern: "~/.config/gcloud/legacy_credentials/**", label: "gcloud legacy credentials" },
	{ pattern: "~/.config/gcloud/application_default_credentials.json", label: "gcloud ADC" },
	{ pattern: "~/.azure/accessTokens.json", label: "Azure CLI tokens" },
	{ pattern: "~/.azure/azureProfile.json", label: "Azure CLI profile" },
	{ pattern: "~/.kube/config", label: "kubeconfig (cluster credentials)" },
	{ pattern: "~/.docker/config.json", label: "Docker registry credentials" },
	{ pattern: "~/.config/gh/hosts.yml", label: "gh CLI host tokens" },
	{ pattern: "~/.npmrc", label: "npm credentials (auth tokens)" },
	{ pattern: "**/.npmrc", label: "project npm credentials" },
	{ pattern: "~/.pypirc", label: "PyPI credentials" },
	{ pattern: "~/.cargo/credentials", label: "Cargo registry credentials" },
	{ pattern: "~/.cargo/credentials.toml", label: "Cargo registry credentials" },
	{ pattern: "~/.gem/credentials", label: "RubyGems credentials" },
	{ pattern: "~/.git-credentials", label: "git stored credentials" },
	{ pattern: "~/.config/git/credentials", label: "git stored credentials (XDG)" },
	{ pattern: "~/.netrc", label: ".netrc (credentials for HTTP tools)" },
	{ pattern: "~/.password-store/**", label: "pass(1) password store" },
	{ pattern: "~/.gnupg/private-keys-v1.d/**", label: "GPG private keys" },
	{ pattern: "~/.gnupg/secring.gpg", label: "GPG legacy secret keyring" },
	{ pattern: "**/.env", label: ".env file" },
	{ pattern: "**/.env.*", label: ".env.* file" },
];
