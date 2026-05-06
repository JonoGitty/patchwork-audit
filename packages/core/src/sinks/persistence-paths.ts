/**
 * Persistence-class paths for the `claude_file_write_persistence` sink.
 *
 * A write to any of these paths from a Claude-native file tool
 * (Write/Edit/MultiEdit/NotebookEdit) is the canonical way an attacker
 * achieves persistence after a successful prompt-injection: edit the user's
 * shell rc to backdoor every future shell, install a git hook that runs on
 * every commit, drop a CI workflow that runs on every push, append a key to
 * authorized_keys, etc.
 *
 * v0.6.11 enforce-mode behavior (per design §3.2):
 *   - under any taint   → deny
 *   - untainted         → approval_required
 *
 * The patterns here are picomatch globs. Path matching is case-insensitive
 * (because case-folding filesystems exist and `~/.SSH/authorized_keys` is
 * the same file as `~/.ssh/authorized_keys` on macOS) and home-aware
 * (`~/...` is expanded against the calling user's home dir before
 * matching).
 *
 * GPT round-4 watch-out #9: path identity must use realpath/canonical so
 * that symlink games can't bypass. The classifier consumes
 * `event.resolved_paths` which is realpath'd by the PostToolUse handler
 * in commit 7. This file just owns the patterns.
 */

import { homePath } from "../path/home.js";

export interface PersistencePattern {
	/** Glob pattern, optionally home-anchored with leading `~/`. */
	pattern: string;
	/** Short label for audit/denial messages. */
	label: string;
}

/**
 * Patterns are evaluated in order; the first match wins. More-specific
 * patterns come first so the audit message is informative.
 */
export const PERSISTENCE_PATTERNS: readonly PersistencePattern[] = [
	// SSH — config and authorized_keys are the highest-leverage targets.
	{ pattern: "~/.ssh/authorized_keys", label: "SSH authorized_keys (passwordless login)" },
	{ pattern: "~/.ssh/authorized_keys2", label: "SSH authorized_keys2" },
	{ pattern: "~/.ssh/config", label: "SSH client config (host aliases / proxy commands)" },
	{ pattern: "~/.ssh/**", label: "SSH directory (keys / known_hosts)" },

	// Shell startup — every future shell loads these.
	{ pattern: "~/.bashrc", label: "Bash interactive rc" },
	{ pattern: "~/.bash_profile", label: "Bash login profile" },
	{ pattern: "~/.bash_login", label: "Bash login profile" },
	{ pattern: "~/.profile", label: "POSIX shell profile" },
	{ pattern: "~/.zshrc", label: "Zsh interactive rc" },
	{ pattern: "~/.zshenv", label: "Zsh environment" },
	{ pattern: "~/.zprofile", label: "Zsh login profile" },
	{ pattern: "~/.zlogin", label: "Zsh login script" },
	{ pattern: "~/.config/fish/**", label: "Fish shell config" },
	{ pattern: "~/.inputrc", label: "Readline config" },
	{ pattern: "/etc/profile", label: "System POSIX profile" },
	{ pattern: "/etc/profile.d/**", label: "System profile drop-in" },
	{ pattern: "/etc/zshrc", label: "System zsh rc" },
	{ pattern: "/etc/bashrc", label: "System bash rc" },

	// Git — hooks run on every commit / push / fetch.
	{ pattern: "**/.git/hooks/**", label: "Git hook (runs on every commit/push/fetch)" },
	{ pattern: "**/.husky/**", label: "Husky git hook" },
	{ pattern: "~/.gitconfig", label: "Global git config (aliases / hooks / templates)" },
	{ pattern: "~/.config/git/config", label: "Global git config (XDG)" },
	{ pattern: "~/.config/git/attributes", label: "Global git attributes" },
	{ pattern: "~/.config/git/ignore", label: "Global git ignore" },

	// CI — runs on every push to the host (often with secrets).
	{ pattern: "**/.github/workflows/**", label: "GitHub Actions workflow" },
	{ pattern: "**/.gitlab-ci.yml", label: "GitLab CI config" },
	{ pattern: "**/.gitlab/**", label: "GitLab CI directory" },
	{ pattern: "**/.circleci/**", label: "CircleCI config" },
	{ pattern: "**/Jenkinsfile", label: "Jenkins pipeline" },
	{ pattern: "**/azure-pipelines.yml", label: "Azure Pipelines" },
	{ pattern: "**/bitbucket-pipelines.yml", label: "Bitbucket Pipelines" },
	{ pattern: "**/.buildkite/**", label: "Buildkite pipeline" },
	{ pattern: "**/.travis.yml", label: "Travis CI" },

	// macOS launch agents / daemons — fire on login/boot.
	{ pattern: "~/Library/LaunchAgents/**", label: "macOS LaunchAgent (runs on login)" },
	{ pattern: "/Library/LaunchAgents/**", label: "macOS LaunchAgent (system, all users)" },
	{ pattern: "/Library/LaunchDaemons/**", label: "macOS LaunchDaemon (runs as root)" },

	// systemd user units — fire on login.
	{ pattern: "~/.config/systemd/user/**", label: "systemd user unit (runs on login)" },
	{ pattern: "/etc/systemd/system/**", label: "systemd system unit (runs as root)" },

	// direnv — runs on cd into directory.
	{ pattern: "**/.envrc", label: "direnv envrc (runs on cd into dir)" },

	// Editor task / extension files — run when project is opened.
	{ pattern: "**/.vscode/tasks.json", label: "VS Code tasks (runs on open)" },
	{ pattern: "**/.vscode/launch.json", label: "VS Code launch config" },
	{ pattern: "**/.vscode/settings.json", label: "VS Code project settings" },
	{ pattern: "**/.idea/**", label: "JetBrains IDE config" },

	// Cron-like.
	{ pattern: "/etc/cron.*/**", label: "System cron drop-in" },
	{ pattern: "/var/spool/cron/**", label: "User crontab" },
	{ pattern: "/etc/crontab", label: "System crontab" },

	// Patchwork's own state (defense-in-depth — Patchwork already blocks
	// these via the existing PreToolUse classifier, but if anything
	// slipped through this is the second line).
	{ pattern: "~/.patchwork/**", label: "Patchwork state directory" },
	{ pattern: "~/.claude/settings.json", label: "Claude Code global settings (hooks!)" },
	{ pattern: "~/.claude/settings.local.json", label: "Claude Code local settings" },
	{ pattern: "**/.claude/settings.json", label: "Claude Code project settings (hooks!)" },
];

/**
 * Expand `~/...` to the calling user's home dir. Returns the input unchanged
 * if it doesn't start with `~/`. Done lazily so the patterns above stay
 * declarative.
 */
export function expandHomePattern(pattern: string): string {
	if (pattern === "~") return homePath();
	if (pattern.startsWith("~/")) return homePath(pattern.slice(2));
	return pattern;
}
