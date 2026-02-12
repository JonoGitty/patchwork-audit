import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { logCommand } from "./commands/log.js";
import { hookCommand } from "./commands/hook.js";
import { statusCommand } from "./commands/status.js";
import { sessionsCommand } from "./commands/sessions.js";
import { showCommand } from "./commands/show.js";
import { summaryCommand } from "./commands/summary.js";
import { syncCommand } from "./commands/sync.js";
import { tailCommand } from "./commands/tail.js";
import { policyCommand } from "./commands/policy.js";
import { exportCommand } from "./commands/export.js";

const program = new Command();

program
	.name("patchwork")
	.description("The audit trail for AI coding agents")
	.version("0.1.0");

program.addCommand(initCommand);
program.addCommand(logCommand);
program.addCommand(hookCommand);
program.addCommand(statusCommand);
program.addCommand(sessionsCommand);
program.addCommand(showCommand);
program.addCommand(summaryCommand);
program.addCommand(syncCommand);
program.addCommand(tailCommand);
program.addCommand(policyCommand);
program.addCommand(exportCommand);

program.parse();
