#!/usr/bin/env node
import { runDoctor } from "./doctor.js";
import { inspectGlobalShims } from "./global-shims.js";
import { runInstall } from "./install.js";
import { parseFlags } from "./shared.js";
import { runRepair } from "./repair.js";
import { runUninstall } from "./uninstall.js";

type CliCommand = "install" | "doctor" | "repair" | "uninstall" | "status";

function isCliCommand(value: string | undefined): value is CliCommand {
  return value === "install" || value === "doctor" || value === "repair" || value === "uninstall" || value === "status";
}

async function printStatus(): Promise<void> {
  const shims = await inspectGlobalShims();
  console.log("OpenClaw Soft Router CLI :: status");
  console.log("--------------------------------");
  console.log(`Global shim bin dir: ${shims.binDir ?? "(unknown)"}`);
  console.log(`Shim strategy: ${shims.usedFallback ? "fallback ~/.openclaw/bin" : "same bin dir as openclaw"}`);
  for (const item of shims.commands) {
    console.log(`- ${item.name}: ${item.exists ? item.path : "missing"}`);
  }
}

function printHelp(): void {
  console.log("Usage: openclaw-soft-router <install|doctor|repair|uninstall|status> [--dry-run] [--remove-files]");
  console.log("");
  console.log("Phase 2 status:");
  console.log("  - doctor: implemented as a real read-only cross-platform check");
  console.log("  - install --dry-run: implemented as a real cross-platform plan preview");
  console.log("  - install: implemented as a real cross-platform installer");
  console.log("  - uninstall: implemented with optional --remove-files");
  console.log("  - repair: implemented as conservative doctor + install flow");
  console.log("  - status: show global shim command installation status");
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const flags = parseFlags(process.argv.slice(3));

  if (!isCliCommand(command)) {
    printHelp();
    process.exitCode = command ? 1 : 0;
    return;
  }

  switch (command) {
    case "doctor":
      process.exitCode = await runDoctor();
      return;
    case "install":
      process.exitCode = await runInstall({ dryRun: flags.has("--dry-run") });
      return;
    case "repair":
      process.exitCode = await runRepair({ dryRun: flags.has("--dry-run") });
      return;
    case "uninstall":
      process.exitCode = await runUninstall({ removeFiles: flags.has("--remove-files") });
      return;
    case "status":
      await printStatus();
      process.exitCode = 0;
      return;
  }
}

main().catch((error: unknown) => {
  console.error("CLI failed:", error);
  process.exit(1);
});
