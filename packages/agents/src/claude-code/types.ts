/**
 * Type definitions for Claude Code hook inputs.
 *
 * Claude Code provides 14 lifecycle hook events. Each hook receives
 * JSON on stdin with these fields. See: https://code.claude.com/docs/en/hooks
 */

export interface ClaudeCodeHookInput {
	/** Unique session identifier */
	session_id: string;

	/** Path to the full transcript file */
	transcript_path: string;

	/** Current working directory */
	cwd: string;

	/** Permission mode (e.g., "default", "plan") */
	permission_mode?: string;

	/** The hook event name */
	hook_event_name: string;

	/** Tool name (for PreToolUse/PostToolUse) */
	tool_name?: string;

	/** Tool input parameters (for PreToolUse/PostToolUse) */
	tool_input?: Record<string, unknown>;

	/** Tool response (for PostToolUse) */
	tool_response?: {
		stdout?: string;
		stderr?: string;
		output?: string;
		content?: string;
		[key: string]: unknown;
	};

	/** Tool use ID */
	tool_use_id?: string;

	/** Prompt content (for UserPromptSubmit) */
	prompt?: string;

	/** Subagent type (for SubagentStart/SubagentStop) */
	subagent_type?: string;

	/** Subagent prompt (for SubagentStart) */
	subagent_prompt?: string;
}

export interface ClaudeCodeHookOutput {
	/** Whether to allow the action (PreToolUse only) */
	allow?: boolean;

	/** Reason for denial */
	reason?: string;

	/** Feedback to provide to the agent (PostToolUse) */
	feedback?: string;
}

/**
 * Claude Code hook event names.
 */
export type ClaudeCodeHookEvent =
	| "SessionStart"
	| "SessionEnd"
	| "UserPromptSubmit"
	| "PreToolUse"
	| "PostToolUse"
	| "PostToolUseFailure"
	| "PermissionRequest"
	| "Notification"
	| "SubagentStart"
	| "SubagentStop"
	| "Stop"
	| "TeammateIdle"
	| "TaskCompleted"
	| "PreCompact";
