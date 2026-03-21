import { spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type CliCommand = "install" | "doctor" | "repair" | "uninstall";

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));

export function getRepoRoot(): string {
  return path.resolve(CURRENT_DIR, "..", "..");
}

export function getOpenClawHome(): string {
  return process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw");
}

export function getOpenClawWorkspace(): string {
  return process.env.OPENCLAW_WORKSPACE ?? path.join(getOpenClawHome(), "workspace");
}

export function getPaths() {
  const repoRoot = getRepoRoot();
  const openClawHome = getOpenClawHome();
  const workspace = getOpenClawWorkspace();

  return {
    repoRoot,
    openClawHome,
    workspace,
    configPath: path.join(openClawHome, "openclaw.json"),
    repoPluginDir: path.join(repoRoot, "plugin"),
    repoToolsDir: path.join(repoRoot, "tools", "soft-router-suggest"),
    workspacePluginDir: path.join(workspace, ".openclaw", "extensions", "soft-router-suggest"),
    workspaceToolsDir: path.join(workspace, "tools", "soft-router-suggest"),
  };
}

export const PLUGIN_FILES = [
  "index.ts",
  "openclaw.plugin.json",
  "keyword-library.ts",
  "weighted-routing-engine.ts",
  "classification-loader.ts",
  "classification-engine.ts",
] as const;

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function formatHeader(command: CliCommand): string {
  return `OpenClaw Soft Router CLI :: ${command}`;
}

export function printHeader(command: CliCommand): void {
  const paths = getPaths();
  console.log(formatHeader(command));
  console.log(`Repo: ${paths.repoRoot}`);
  console.log(`OpenClaw home: ${paths.openClawHome}`);
  console.log(`Workspace: ${paths.workspace}`);
}

export function printKeyValue(label: string, value: string): void {
  console.log(`${label.padEnd(24)} ${value}`);
}

export function detectOpenClawCli(): { ok: boolean; detail: string } {
  const result = spawnSync("openclaw", ["--version"], {
    encoding: "utf8",
    shell: true,
  });

  if (result.status === 0) {
    const line = (result.stdout || result.stderr || "OK").trim().split(/\r?\n/)[0] ?? "OK";
    return { ok: true, detail: line };
  }

  if (result.error) {
    return { ok: false, detail: result.error.message };
  }

  return { ok: false, detail: (result.stderr || "not found").trim() || "not found" };
}

export async function detectSidecarHealth(url = "http://127.0.0.1:18888/health"): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) return false;
    const json = (await response.json()) as { ok?: boolean };
    return json.ok === true;
  } catch {
    return false;
  }
}

export function parseFlags(argv: string[]): Set<string> {
  return new Set(argv.filter((value) => value.startsWith("-")));
}
