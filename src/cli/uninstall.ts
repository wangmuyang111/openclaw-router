import { copyFile, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getPaths, printHeader } from "./shared.js";

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

function ensureObjectRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function disablePluginInConfig(rawJson: string): { json: string; foundEntry: boolean } {
  const parsed = JSON.parse(rawJson) as Record<string, unknown>;
  const root = ensureObjectRecord(parsed);
  const plugins = ensureObjectRecord(root.plugins);
  const entries = ensureObjectRecord(plugins.entries);

  const existing = entries["soft-router-suggest"];
  if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
    root.plugins = plugins;
    plugins.entries = entries;
    return { json: `${JSON.stringify(root, null, 2)}\n`, foundEntry: false };
  }

  const entry = ensureObjectRecord(existing);
  entry.enabled = false;
  entries["soft-router-suggest"] = entry;
  plugins.entries = entries;
  root.plugins = plugins;

  return { json: `${JSON.stringify(root, null, 2)}\n`, foundEntry: true };
}

export async function runUninstall(options: { removeFiles: boolean }): Promise<number> {
  const paths = getPaths();
  printHeader("uninstall");
  console.log("--------------------------------");

  try {
    const backupPath = path.join(
      paths.openClawHome,
      `openclaw.json.bak.soft-router-suggest.uninstall.${getTimestamp()}`,
    );

    await copyFile(paths.configPath, backupPath);
    console.log(`Backup: ${backupPath}`);

    const raw = await readFile(paths.configPath, "utf8");
    const updated = disablePluginInConfig(raw);
    await writeFile(paths.configPath, updated.json, "utf8");

    if (updated.foundEntry) {
      console.log("OK: plugin disabled in openclaw.json");
    } else {
      console.log("Note: plugin entry not found; nothing to disable.");
    }

    if (options.removeFiles) {
      await rm(paths.workspacePluginDir, { recursive: true, force: true });
      await rm(paths.workspaceToolsDir, { recursive: true, force: true });
      console.log("OK: files removed");
    }

    console.log("Done.");
    return 0;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      console.error(`openclaw.json not found at: ${paths.configPath}`);
      return 1;
    }

    throw error;
  }
}
