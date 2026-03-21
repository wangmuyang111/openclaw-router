import { runDoctor } from "./doctor.js";
import { runInstall } from "./install.js";

export async function runRepair(options: { dryRun: boolean }): Promise<number> {
  console.log("OpenClaw Soft Router CLI :: repair");
  console.log("--------------------------------");
  console.log(options.dryRun ? "Mode: dry-run repair" : "Mode: repair");
  console.log("");

  console.log("Step 1/2: doctor");
  const doctorExitCode = await runDoctor();
  console.log("");

  if (doctorExitCode === 0) {
    console.log("Doctor result: no blockers detected.");
  } else {
    console.log("Doctor result: blockers detected. Continuing with repair install attempt.");
  }
  console.log("");

  console.log(`Step 2/2: install${options.dryRun ? " --dry-run" : ""}`);
  const installExitCode = await runInstall({ dryRun: options.dryRun });
  console.log("");

  if (installExitCode === 0) {
    console.log(options.dryRun ? "Repair dry-run completed successfully." : "Repair completed successfully.");
    return 0;
  }

  console.log(options.dryRun ? "Repair dry-run failed." : "Repair failed.");
  return installExitCode;
}
