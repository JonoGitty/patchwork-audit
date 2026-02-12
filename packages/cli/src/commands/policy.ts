import { Command } from "commander";
import chalk from "chalk";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import {
	loadActivePolicy,
	policyToYaml,
	STRICT_POLICY,
	DEFAULT_POLICY,
} from "@patchwork/core";

export const policyCommand = new Command("policy")
	.description("Manage enforcement policies");

policyCommand
	.command("show")
	.description("Show the active policy")
	.action(() => {
		const { policy, source } = loadActivePolicy(process.cwd());
		console.log(chalk.bold("Active Policy: ") + chalk.cyan(policy.name));
		console.log(chalk.dim(`Source: ${source}`));
		console.log(chalk.dim(`Max risk: ${policy.max_risk}`));
		console.log();

		// File rules
		const fileDenyCount = policy.files.deny.length;
		const fileAllowCount = policy.files.allow.length;
		console.log(chalk.bold("Files: ") + chalk.dim(`${fileDenyCount} deny, ${fileAllowCount} allow, default: ${policy.files.default_action}`));
		for (const rule of policy.files.deny) {
			console.log(`  ${chalk.red("\u2717")} ${rule.pattern}${rule.reason ? chalk.dim(` — ${rule.reason}`) : ""}`);
		}

		// Command rules
		const cmdDenyCount = policy.commands.deny.length;
		const cmdAllowCount = policy.commands.allow.length;
		console.log(chalk.bold("Commands: ") + chalk.dim(`${cmdDenyCount} deny, ${cmdAllowCount} allow, default: ${policy.commands.default_action}`));
		for (const rule of policy.commands.deny) {
			const pattern = rule.prefix || rule.exact || rule.regex || "";
			console.log(`  ${chalk.red("\u2717")} ${pattern}${rule.reason ? chalk.dim(` — ${rule.reason}`) : ""}`);
		}

		// Network rules
		const netDenyCount = policy.network.deny.length;
		console.log(chalk.bold("Network: ") + chalk.dim(`${netDenyCount} deny, default: ${policy.network.default_action}`));

		// MCP rules
		const mcpDenyCount = policy.mcp.deny.length;
		console.log(chalk.bold("MCP: ") + chalk.dim(`${mcpDenyCount} deny, default: ${policy.mcp.default_action}`));
	});

policyCommand
	.command("init")
	.description("Create a policy file")
	.option("--strict", "Use the strict preset (blocks dangerous operations)")
	.option("--project", "Create in project directory instead of user directory")
	.action((opts) => {
		const policy = opts.strict ? STRICT_POLICY : DEFAULT_POLICY;
		const targetDir = opts.project
			? join(process.cwd(), ".patchwork")
			: join(process.env.HOME || "~", ".patchwork");
		const targetPath = join(targetDir, "policy.yml");

		if (existsSync(targetPath)) {
			console.log(chalk.yellow(`Policy file already exists: ${targetPath}`));
			console.log(chalk.dim("Edit it directly or delete it to regenerate."));
			return;
		}

		mkdirSync(targetDir, { recursive: true });
		writeFileSync(targetPath, policyToYaml(policy), "utf-8");
		console.log(chalk.green(`Policy created: ${targetPath}`));
		console.log(chalk.dim(`Preset: ${opts.strict ? "strict" : "default (audit-only)"}`));
		console.log(chalk.dim("Edit the file to customize enforcement rules."));
	});

policyCommand
	.command("export")
	.description("Print the active policy as YAML")
	.action(() => {
		const { policy } = loadActivePolicy(process.cwd());
		console.log(policyToYaml(policy));
	});

policyCommand
	.command("validate")
	.description("Validate a policy file")
	.argument("<file>", "Path to policy YAML file")
	.action((file) => {
		try {
			const { loadPolicyFromFile } = require("@patchwork/core");
			loadPolicyFromFile(file);
			console.log(chalk.green("Policy is valid."));
		} catch (err: unknown) {
			console.log(chalk.red("Policy validation failed:"));
			console.log(chalk.red((err as Error).message));
			process.exit(1);
		}
	});
