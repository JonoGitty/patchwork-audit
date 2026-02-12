import { describe, it, expect } from "vitest";
import { mapClaudeCodeTool } from "../../src/claude-code/mapper.js";

describe("mapClaudeCodeTool", () => {
	it("maps Write to file_create", () => {
		const result = mapClaudeCodeTool("Write", { file_path: "/test/file.ts" });
		expect(result.action).toBe("file_create");
		expect(result.target?.path).toBe("/test/file.ts");
		expect(result.target?.type).toBe("file");
	});

	it("maps Edit to file_edit", () => {
		const result = mapClaudeCodeTool("Edit", { file_path: "/test/file.ts" });
		expect(result.action).toBe("file_edit");
		expect(result.target?.path).toBe("/test/file.ts");
	});

	it("maps Read to file_read", () => {
		const result = mapClaudeCodeTool("Read", { file_path: "/test/file.ts" });
		expect(result.action).toBe("file_read");
	});

	it("maps Bash to command_execute", () => {
		const result = mapClaudeCodeTool("Bash", { command: "npm test" });
		expect(result.action).toBe("command_execute");
		expect(result.target?.command).toBe("npm test");
		expect(result.target?.type).toBe("command");
	});

	it("maps Glob to file_glob", () => {
		const result = mapClaudeCodeTool("Glob", { pattern: "**/*.ts", path: "/src" });
		expect(result.action).toBe("file_glob");
	});

	it("maps Grep to file_grep", () => {
		const result = mapClaudeCodeTool("Grep", { pattern: "TODO", path: "src/" });
		expect(result.action).toBe("file_grep");
	});

	it("maps WebFetch to web_fetch", () => {
		const result = mapClaudeCodeTool("WebFetch", { url: "https://example.com" });
		expect(result.action).toBe("web_fetch");
		expect(result.target?.url).toBe("https://example.com");
		expect(result.target?.type).toBe("url");
	});

	it("maps WebSearch to web_search", () => {
		const result = mapClaudeCodeTool("WebSearch", { query: "typescript generics" });
		expect(result.action).toBe("web_search");
	});

	it("maps Task to task_delegate", () => {
		const result = mapClaudeCodeTool("Task", { subagent_type: "Explore" });
		expect(result.action).toBe("task_delegate");
		expect(result.target?.type).toBe("prompt");
	});

	it("maps NotebookEdit to file_edit", () => {
		const result = mapClaudeCodeTool("NotebookEdit", { notebook_path: "/test/notebook.ipynb" });
		expect(result.action).toBe("file_edit");
		expect(result.target?.path).toBe("/test/notebook.ipynb");
	});

	it("maps mcp__ prefixed tools to mcp_tool_call", () => {
		const result = mapClaudeCodeTool("mcp__github__create_issue", { title: "Bug" });
		expect(result.action).toBe("mcp_tool_call");
		expect(result.target?.type).toBe("mcp_tool");
		expect(result.target?.tool_name).toBe("mcp__github__create_issue");
	});

	it("maps unknown tools to mcp_tool_call", () => {
		const result = mapClaudeCodeTool("SomeNewTool", { foo: "bar" });
		expect(result.action).toBe("mcp_tool_call");
	});
});
