import path from "node:path";
import { detectOpenClawCli, detectSidecarHealth, getPaths, pathExists, PLUGIN_FILES, printHeader, printKeyValue } from "./shared.js";

export async function runDoctor(): Promise<number> {
  const paths = getPaths();

  printHeader("doctor");
  console.log("--------------------------------");

  const blockers: string[] = [];
  const warnings: string[] = [];

  const openclawJsonOk = await pathExists(paths.configPath);
  printKeyValue("openclaw.json", openclawJsonOk ? "OK" : "MISSING");
  if (!openclawJsonOk) {
    blockers.push(`Missing openclaw.json at: ${paths.configPath}`);
  }

  const cli = detectOpenClawCli();
  printKeyValue("openclaw CLI", cli.ok ? `OK (${cli.detail})` : `MISSING (${cli.detail})`);
  if (!cli.ok) {
    blockers.push("Missing OpenClaw CLI in PATH (command: openclaw)");
  }

  printKeyValue("node", process.execPath);

  const repoPluginDirOk = await pathExists(paths.repoPluginDir);
  const repoToolsDirOk = await pathExists(paths.repoToolsDir);
  printKeyValue("repo plugin dir", repoPluginDirOk ? "OK" : "MISSING");
  printKeyValue("repo tools dir", repoToolsDirOk ? "OK" : "MISSING");
  if (!repoPluginDirOk) blockers.push(`Missing repo plugin dir: ${paths.repoPluginDir}`);
  if (!repoToolsDirOk) blockers.push(`Missing repo tools dir: ${paths.repoToolsDir}`);

  const installedPluginEntry = path.join(paths.workspacePluginDir, "index.ts");
  const pluginInstalled = await pathExists(installedPluginEntry);
  printKeyValue("plugin installed", pluginInstalled ? "OK" : "MISSING");
  if (!pluginInstalled) blockers.push(`Plugin not installed: ${installedPluginEntry}`);

  const checks: Array<[label: string, filePath: string, blocker: boolean]> = [
    ["keyword library", path.join(paths.workspaceToolsDir, "keyword-library.json"), true],
    ["keyword schema", path.join(paths.workspaceToolsDir, "keyword-library.schema.json"), true],
    ["keyword overrides", path.join(paths.workspaceToolsDir, "keyword-overrides.user.json"), true],
    ["overrides schema", path.join(paths.workspaceToolsDir, "keyword-overrides.user.schema.json"), true],
    ["ui menu", path.join(paths.workspaceToolsDir, "ui-menu.ps1"), true],
    ["ui settings", path.join(paths.workspaceToolsDir, "ui.settings.json"), true],
    ["i18n zh", path.join(paths.workspaceToolsDir, "i18n", "zh-CN.json"), true],
    ["i18n en", path.join(paths.workspaceToolsDir, "i18n", "en-US.json"), true],
    ["priority file", path.join(paths.workspaceToolsDir, "model-priority.json"), false],
    ["legacy rules", path.join(paths.workspaceToolsDir, "router-rules.json"), false],
    ["legacy class rules", path.join(paths.workspaceToolsDir, "classification-rules.json"), false],
    ["legacy class schema", path.join(paths.workspaceToolsDir, "classification-rules.schema.json"), false],
  ];

  for (const [label, filePath, blocker] of checks) {
    const ok = await pathExists(filePath);
    printKeyValue(label, ok ? "OK" : "MISSING");
    if (!ok) {
      (blocker ? blockers : warnings).push(`${label} missing: ${filePath}`);
    }
  }

  const missingRepoPluginFiles: string[] = [];
  for (const file of PLUGIN_FILES) {
    const repoFile = path.join(paths.repoPluginDir, file);
    if (!(await pathExists(repoFile))) {
      missingRepoPluginFiles.push(file);
    }
  }
  if (missingRepoPluginFiles.length > 0) {
    warnings.push(`Optional legacy plugin files missing in repo: ${missingRepoPluginFiles.join(", ")}`);
  }

  const sidecarHealthy = await detectSidecarHealth();
  printKeyValue("sidecar /health", sidecarHealthy ? "HEALTHY" : "NOT HEALTHY (ok unless using LLM mode)");
  if (!sidecarHealthy) {
    warnings.push("Sidecar /health is not healthy (ok unless using LLM mode).");
  }

  console.log("");
  if (blockers.length > 0) {
    console.log("MISSING / BLOCKERS:");
    for (const item of blockers) console.log(`- ${item}`);
    console.log("");
  } else {
    console.log("OK: no blockers detected.");
    console.log("");
  }

  if (warnings.length > 0) {
    console.log("WARNINGS:");
    for (const item of warnings) console.log(`- ${item}`);
    console.log("");
  }

  console.log("Next commands:");
  console.log("- npm run openclaw:doctor");
  console.log("- node ./dist/cli/index.js install --dry-run");
  console.log("- npm run windows:install");

  return blockers.length > 0 ? 1 : 0;
}
