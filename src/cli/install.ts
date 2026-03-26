import { copyFile, cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { installGlobalShims } from "./global-shims.js";
import { getPaths, pathExists, PLUGIN_FILES, printHeader, printKeyValue } from "./shared.js";

type InstallOptions = { dryRun: boolean };

type PluginSource = {
  file: string;
  source: string;
  exists: boolean;
  destination: string;
};

function getTimestamp(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

async function collectPluginSources(repoPluginDir: string, workspacePluginDir: string): Promise<PluginSource[]> {
  return Promise.all(
    PLUGIN_FILES.map(async (file) => ({
      file,
      source: path.join(repoPluginDir, file),
      exists: await pathExists(path.join(repoPluginDir, file)),
      destination: path.join(workspacePluginDir, file),
    })),
  );
}

function ensureObjectRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function patchOpenClawConfig(rawJson: string): string {
  const parsed = JSON.parse(rawJson) as Record<string, unknown>;

  const root = ensureObjectRecord(parsed);

  // Also patch the OpenClaw gateway default agent model conservatively.
  // Only override when the primary is missing or still on the old baseline (gpt-5.2).
  const agents = ensureObjectRecord(root.agents);
  const defaults = ensureObjectRecord(agents.defaults);
  const modelDefaults = ensureObjectRecord(defaults.model);
  const primary = typeof modelDefaults.primary === "string" ? modelDefaults.primary : "";
  if (!primary || primary === "local-proxy/gpt-5.2") {
    modelDefaults.primary = "local-proxy/gpt-5.4";
  }
  const existingFallbacks = Array.isArray(modelDefaults.fallbacks)
    ? (modelDefaults.fallbacks.filter((x) => typeof x === "string") as string[])
    : [];
  if (!existingFallbacks.includes("local-proxy/gpt-5.2")) {
    modelDefaults.fallbacks = ["local-proxy/gpt-5.2", ...existingFallbacks];
  }
  defaults.model = modelDefaults;
  agents.defaults = defaults;
  root.agents = agents;

  const plugins = ensureObjectRecord(root.plugins);
  const entries = ensureObjectRecord(plugins.entries);
  const entry = ensureObjectRecord(entries["soft-router-suggest"]);
  const config = ensureObjectRecord(entry.config);

  entry.enabled = true;
  config.ruleEngineEnabled = true;
  config.routerLlmEnabled = false;
  config.switchingEnabled = false;
  config.switchingAllowChat = false;
  config.openclawCliPath = "openclaw";
  config.taskModeEnabled = false;
  config.taskModePrimaryKind = "coding";
  config.taskModeKinds = ["coding"];
  config.taskModeMinConfidence = "medium";
  config.taskModeReturnToPrimary = true;
  config.taskModeAllowAutoDowngrade = false;
  config.freeSwitchWhenTaskModeOff = true;
  entry.config = config;

  entries["soft-router-suggest"] = entry;
  plugins.entries = entries;
  root.plugins = plugins;

  return `${JSON.stringify(root, null, 2)}\n`;
}

function getDefaultRuntimeRoutingJson(): string {
  return `${JSON.stringify(
    {
      taskModeEnabled: false,
      taskModePrimaryKind: "coding",
      taskModeKinds: ["coding"],
      taskModeDisabledKinds: [],
      taskModeMinConfidence: "medium",
      taskModeReturnToPrimary: true,
      taskModeAllowAutoDowngrade: false,
      freeSwitchWhenTaskModeOff: true,
    },
    null,
    2,
  )}\n`;
}

async function copyToolDirectoryContents(
  sourceDir: string,
  destinationDir: string,
  options?: { preserveFiles?: string[] },
): Promise<void> {
  const preserve = new Set((options?.preserveFiles ?? []).map((value) => value.toLowerCase()));
  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (preserve.has(entry.name.toLowerCase())) continue;
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);
    if (entry.isDirectory()) {
      await cp(sourcePath, destinationPath, { recursive: true, force: true });
    } else {
      await copyFile(sourcePath, destinationPath);
    }
  }
}

async function printDryRunPlan(options: {
  pluginSources: PluginSource[];
  repoToolsDirOk: boolean;
  configOk: boolean;
  overridesDst: string;
  overridesExists: boolean;
  overridesExample: string;
  overridesExampleExists: boolean;
}): Promise<number> {
  const paths = getPaths();

  printKeyValue("config path", options.configOk ? paths.configPath : `MISSING -> ${paths.configPath}`);
  printKeyValue("repo tools dir", options.repoToolsDirOk ? paths.repoToolsDir : `MISSING -> ${paths.repoToolsDir}`);
  printKeyValue("workspace plugin dir", paths.workspacePluginDir);
  printKeyValue("workspace tools dir", paths.workspaceToolsDir);
  console.log("");

  console.log("Planned actions:");
  console.log(`1. Ensure directory exists: ${paths.workspacePluginDir}`);
  console.log(`2. Ensure directory exists: ${paths.workspaceToolsDir}`);
  console.log("3. Copy plugin files if present in repo:");
  for (const item of options.pluginSources) {
    console.log(`   - ${item.file}: ${item.exists ? "copy" : "skip (not present)"}`);
  }
  console.log(`4. Copy tool directory contents: ${options.repoToolsDirOk ? "yes (preserve runtime-routing.json if already present)" : "blocked (repo tools dir missing)"}`);
  if (!options.overridesExists && options.overridesExampleExists) {
    console.log(`5. Create keyword-overrides.user.json from example: ${options.overridesExample}`);
  } else if (!options.overridesExists) {
    console.log("5. keyword-overrides.user.json missing and example file also missing");
  } else {
    console.log(`5. Preserve existing user overrides: ${options.overridesDst}`);
  }
  console.log(`6. Backup config before patching: ${paths.configPath}.bak.soft-router-suggest.<timestamp>`);
  console.log("7. Ensure plugins.entries.soft-router-suggest exists and set:");
  console.log("   - enabled = true");
  console.log("   - config.ruleEngineEnabled = true");
  console.log("   - config.routerLlmEnabled = false");
  console.log("   - config.switchingEnabled = false");
  console.log("   - config.switchingAllowChat = false");
  console.log("   - config.openclawCliPath = 'openclaw'");
  console.log("8. Refresh global commands: openclaw-router / openclaw-soft-router");
  console.log("");

  const blockers: string[] = [];
  if (!options.configOk) blockers.push(`Missing openclaw.json at: ${paths.configPath}`);
  if (!options.repoToolsDirOk) blockers.push(`Missing repo tools dir: ${paths.repoToolsDir}`);

  if (blockers.length > 0) {
    console.log("DRY RUN BLOCKERS:");
    for (const item of blockers) console.log(`- ${item}`);
    return 1;
  }

  console.log("DRY RUN OK: plan generated successfully.");
  return 0;
}

export async function runInstall(options: InstallOptions): Promise<number> {
  const paths = getPaths();
  printHeader("install");
  console.log("--------------------------------");

  const pluginSources = await collectPluginSources(paths.repoPluginDir, paths.workspacePluginDir);
  const repoToolsDirOk = await pathExists(paths.repoToolsDir);
  const configOk = await pathExists(paths.configPath);
  const overridesDst = path.join(paths.workspaceToolsDir, "keyword-overrides.user.json");
  const overridesExists = await pathExists(overridesDst);
  const overridesExample = path.join(paths.repoToolsDir, "keyword-overrides.user.example.json");
  const overridesExampleExists = await pathExists(overridesExample);
  const runtimeRoutingPath = path.join(paths.workspaceToolsDir, "runtime-routing.json");
  const runtimeRoutingExists = await pathExists(runtimeRoutingPath);

  if (options.dryRun) {
    console.log("DRY RUN: no files will be changed.");
    console.log("");
    return printDryRunPlan({
      pluginSources,
      repoToolsDirOk,
      configOk,
      overridesDst,
      overridesExists,
      overridesExample,
      overridesExampleExists,
    });
  }

  if (!configOk) {
    console.error(`openclaw.json not found at: ${paths.configPath}`);
    return 1;
  }
  if (!repoToolsDirOk) {
    console.error(`Tool source directory missing: ${paths.repoToolsDir}`);
    return 1;
  }

  await mkdir(paths.workspacePluginDir, { recursive: true });
  await mkdir(paths.workspaceToolsDir, { recursive: true });

  for (const item of pluginSources) {
    if (!item.exists) continue;
    await copyFile(item.source, item.destination);
  }
  console.log(`OK: plugin copied -> ${paths.workspacePluginDir}`);

  await copyToolDirectoryContents(paths.repoToolsDir, paths.workspaceToolsDir, {
    preserveFiles: runtimeRoutingExists ? ["runtime-routing.json"] : [],
  });

  if (!overridesExists && overridesExampleExists) {
    await copyFile(overridesExample, overridesDst);
    console.log("OK: created keyword-overrides.user.json from example");
  }
  if (!runtimeRoutingExists) {
    await writeFile(runtimeRoutingPath, getDefaultRuntimeRoutingJson(), "utf8");
    console.log("OK: created runtime-routing.json with task mode defaults");
  }
  console.log(`OK: tools copied -> ${paths.workspaceToolsDir}`);

  const ts = getTimestamp();
  const backupPath = path.join(paths.openClawHome, `openclaw.json.bak.soft-router-suggest.${ts}`);
  await copyFile(paths.configPath, backupPath);
  console.log(`Backup: ${backupPath}`);

  const raw = await readFile(paths.configPath, "utf8");
  const patched = patchOpenClawConfig(raw);
  await writeFile(paths.configPath, patched, "utf8");
  console.log("OK: openclaw.json updated (plugin enabled)");

  const shims = await installGlobalShims();
  console.log(`OK: global commands refreshed -> ${shims.commands.join(", ")}`);
  console.log(`Shim dir: ${shims.binDir}`);
  if (shims.usedFallback) {
    console.log("Note: openclaw binary dir could not be detected, using fallback ~/.openclaw/bin");
  }

  console.log("\nNext steps:");
  console.log("  - Use openclaw-router status");
  console.log("  - Use scripts\\router.ps1 for mode switching (FAST/RULES/LLM)");
  console.log("  - Start sidecar: scripts\\sidecar-start.ps1");
  return 0;
}
