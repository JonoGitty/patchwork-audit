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
import { searchCommand } from "./commands/search.js";
import { diffCommand } from "./commands/diff.js";
import { statsCommand } from "./commands/stats.js";
import { verifyCommand } from "./commands/verify.js";
import { sealCommand } from "./commands/seal.js";
import { witnessCommand } from "./commands/witness.js";
import { attestCommand } from "./commands/attest.js";
import { dashboardCommand } from "./commands/dashboard.js";
import { reportCommand } from "./commands/report.js";
import { replayCommand } from "./commands/replay.js";
import { doctorCommand } from "./commands/doctor.js";
import { commitAttestCommand } from "./commands/commit-attest.js";
import { relayCommand } from "./commands/relay.js";
import { setupCommand } from "./commands/setup.js";
import { teamCommand } from "./commands/team.js";

const program = new Command();

program
	.name("patchwork")
	.description("The audit trail for AI coding agents")
	.version("0.6.5");

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
program.addCommand(searchCommand);
program.addCommand(diffCommand);
program.addCommand(statsCommand);
program.addCommand(verifyCommand);
program.addCommand(sealCommand);
program.addCommand(witnessCommand);
program.addCommand(attestCommand);
program.addCommand(dashboardCommand);
program.addCommand(reportCommand);
program.addCommand(replayCommand);
program.addCommand(doctorCommand);
program.addCommand(commitAttestCommand);
program.addCommand(relayCommand);
program.addCommand(setupCommand);
program.addCommand(teamCommand);

program.parse();
