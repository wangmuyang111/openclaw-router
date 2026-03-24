import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { getOpenClawHome, getOpenClawWorkspace, pathExists } from "./shared.js";

type RouterMode = "status" | "fast" | "rules" | "llm" | "catalog-refresh" | "sidecar-start" | "sidecar-stop";

type JsonRecord = Record<string, unknown>;

function ensureObjectRecord(value: unknown): JsonRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  return {};
}

async function loadConfig(configPath: string): Promise<JsonRecord> {
  const raw = await readFile(configPath, "utf8");
  return JSON.parse(raw) as JsonRecord;
}

async function saveConfig(configPath: string, config: JsonRecord): Promise<void> {
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function ensurePluginEntry(configRoot: JsonRecord): JsonRecord {
  const plugins = ensureObjectRecord(configRoot.plugins);
  const entries = ensureObjectRecord(plugins.entries);
  const entry = ensureObjectRecord(entries["soft-router-suggest"]);
  const entryConfig = ensureObjectRecord(entry.config);

  entry.enabled = entry.enabled ?? true;
  entry.config = entryConfig;
  entries["soft-router-suggest"] = entry;
  plugins.entries = entries;
  configRoot.plugins = plugins;
  return entry;
}

async function backupConfig(configPath: string): Promise<string> {
  const openClawHome = getOpenClawHome();
  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  const backupPath = path.join(openClawHome, `openclaw.json.bak.router.${ts}`);
  await copyFile(configPath, backupPath);
  return backupPath;
}

function setEntryConfig(entry: JsonRecord, key: string, value: unknown): void {
  const config = ensureObjectRecord(entry.config);
  config[key] = value;
  entry.config = config;
}

function getEntryConfig(entry: JsonRecord, key: string, fallback: unknown = null): unknown {
  const config = ensureObjectRecord(entry.config);
  return key in config ? config[key] : fallback;
}

async function spawnDetached(command: string, args: string[], cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

export async function runRouterMode(mode: RouterMode): Promise<number> {
  const openClawHome = getOpenClawHome();
  const workspace = getOpenClawWorkspace();
  const configPath = path.join(openClawHome, "openclaw.json");

  if (!(await pathExists(configPath))) {
    console.error(`openclaw.json not found at: ${configPath}`);
    return 1;
  }

  if (mode === "catalog-refresh") {
    const flagPath = path.join(workspace, "tools", "soft-router-suggest", ".force-refresh-catalog");
    await mkdir(path.dirname(flagPath), { recursive: true });
    await writeFile(flagPath, "", "utf8");
    console.log(`OK: requested catalog refresh (flag created): ${flagPath}`);
    return 0;
  }

  if (mode === "sidecar-start") {
    const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
    const scriptPath = path.join(repoRoot, "router-sidecar", "scripts", process.platform === "win32" ? "start-sidecar-safe.ps1" : "start-sidecar-safe.sh");
    if (!(await pathExists(scriptPath))) {
      console.error(`Sidecar start script not found: ${scriptPath}`);
      return 1;
    }

    if (process.platform === "win32") {
      await spawnDetached("powershell", ["-ExecutionPolicy", "Bypass", "-File", scriptPath], repoRoot);
    } else {
      await spawnDetached("sh", [scriptPath], repoRoot);
    }
    console.log(`OK: sidecar start requested -> ${scriptPath}`);
    return 0;
  }

  if (mode === "sidecar-stop") {
    const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
    const scriptPath = path.join(repoRoot, "router-sidecar", "scripts", process.platform === "win32" ? "stop-sidecar-safe.ps1" : "stop-sidecar-safe.sh");
    if (!(await pathExists(scriptPath))) {
      console.error(`Sidecar stop script not found: ${scriptPath}`);
      return 1;
    }

    if (process.platform === "win32") {
      await spawnDetached("powershell", ["-ExecutionPolicy", "Bypass", "-File", scriptPath], repoRoot);
    } else {
      await spawnDetached("sh", [scriptPath], repoRoot);
    }
    console.log(`OK: sidecar stop requested -> ${scriptPath}`);
    return 0;
  }

  const configRoot = await loadConfig(configPath);
  const entry = ensurePluginEntry(configRoot);

  if (mode === "status") {
    console.log(`openclaw.json: ${configPath}`);
    console.log(`plugin.enabled: ${String(entry.enabled ?? null)}`);
    console.log(`ruleEngineEnabled: ${String(getEntryConfig(entry, "ruleEngineEnabled", null))}`);
    console.log(`routerLlmEnabled: ${String(getEntryConfig(entry, "routerLlmEnabled", null))}`);
    console.log(`switchingEnabled: ${String(getEntryConfig(entry, "switchingEnabled", null))}`);
    console.log(`openclawCliPath: ${String(getEntryConfig(entry, "openclawCliPath", ""))}`);
    return 0;
  }

  const backupPath = await backupConfig(configPath);
  console.log(`Backup: ${backupPath}`);

  if (mode === "fast") {
    entry.enabled = false;
    delete entry.config;
    await saveConfig(configPath, configRoot);
    console.log("OK: FAST mode (plugin disabled)");
    return 0;
  }

  entry.enabled = true;
  setEntryConfig(entry, "ruleEngineEnabled", true);
  setEntryConfig(entry, "switchingEnabled", true);
  setEntryConfig(entry, "openclawCliPath", "openclaw");

  if (mode === "rules") {
    setEntryConfig(entry, "routerLlmEnabled", false);
    await saveConfig(configPath, configRoot);
    console.log("OK: RULES mode (rule engine enabled)");
    return 0;
  }

  if (mode === "llm") {
    setEntryConfig(entry, "routerLlmEnabled", true);
    if (getEntryConfig(entry, "routerLlmEndpoint", null) == null) {
      setEntryConfig(entry, "routerLlmEndpoint", "http://127.0.0.1:18888/route");
    }
    await saveConfig(configPath, configRoot);
    console.log("OK: LLM mode (rule engine + sidecar enabled)");
    return 0;
  }

  console.error(`Unknown router mode: ${mode}`);
  return 1;
}
