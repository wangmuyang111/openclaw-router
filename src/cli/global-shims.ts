import { spawnSync } from "node:child_process";
import { chmod, copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getOpenClawHome, getRepoRoot, pathExists } from "./shared.js";

const SHIM_COMMANDS = ["openclaw-router", "openclaw-soft-router"] as const;

type ShimInstallResult = {
  binDir: string;
  usedFallback: boolean;
  commands: string[];
};

function detectOpenClawExecutablePath(): string | null {
  const command = process.platform === "win32" ? "where.exe" : "which";
  const result = spawnSync(command, ["openclaw"], { encoding: "utf8" });
  if (result.status !== 0) return null;

  const lines = `${result.stdout || ""}\n${result.stderr || ""}`
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);

  return lines[0] ?? null;
}

async function resolveShimBinDir(): Promise<{ binDir: string; usedFallback: boolean }> {
  const detected = detectOpenClawExecutablePath();
  if (detected) {
    return { binDir: path.dirname(detected), usedFallback: false };
  }

  const fallback = path.join(getOpenClawHome(), "bin");
  await mkdir(fallback, { recursive: true });
  return { binDir: fallback, usedFallback: true };
}

function getDistCliPath(): string {
  return path.join(getRepoRoot(), "dist", "cli", "index.js");
}

function getScriptWrapperPath(commandName: string): string {
  const scriptFile = process.platform === "win32" ? "openclaw-router.ps1" : "openclaw-router";
  return path.join(getRepoRoot(), "scripts", scriptFile);
}

function buildWindowsCmdShim(scriptWrapperPath: string): string {
  const ps = "powershell";
  const wrapper = scriptWrapperPath.replace(/"/g, '""');
  return `@echo off\r\nsetlocal\r\n"${ps}" -ExecutionPolicy Bypass -File "${wrapper}" %*\r\n`;
}

function buildPosixShim(scriptWrapperPath: string): string {
  const wrapper = scriptWrapperPath.replace(/'/g, `'\\''`);
  return `#!/usr/bin/env sh\nexec '${wrapper}' "$@"\n`;
}

function getShimPath(binDir: string, commandName: string): string {
  return process.platform === "win32" ? path.join(binDir, `${commandName}.cmd`) : path.join(binDir, commandName);
}

export async function installGlobalShims(): Promise<ShimInstallResult> {
  const distCliPath = getDistCliPath();
  const scriptWrapperPath = getScriptWrapperPath("openclaw-router");

  if (!(await pathExists(scriptWrapperPath))) {
    throw new Error(`Script wrapper not found: ${scriptWrapperPath}`);
  }

  if (!(await pathExists(distCliPath))) {
    throw new Error(`CLI entry not found: ${distCliPath}`);
  }

  const target = await resolveShimBinDir();
  await mkdir(target.binDir, { recursive: true });

  for (const commandName of SHIM_COMMANDS) {
    const shimPath = getShimPath(target.binDir, commandName);
    if (process.platform === "win32") {
      await writeFile(shimPath, buildWindowsCmdShim(scriptWrapperPath), "utf8");
    } else {
      if (commandName === "openclaw-router") {
        await copyFile(scriptWrapperPath, shimPath);
      } else {
        await writeFile(shimPath, buildPosixShim(scriptWrapperPath), "utf8");
      }
      await chmod(shimPath, 0o755);
    }
  }

  return {
    binDir: target.binDir,
    usedFallback: target.usedFallback,
    commands: [...SHIM_COMMANDS],
  };
}

export async function removeGlobalShims(): Promise<{ removed: string[]; binDir: string | null }> {
  const detected = detectOpenClawExecutablePath();
  const candidateDirs = Array.from(
    new Set([detected ? path.dirname(detected) : null, path.join(getOpenClawHome(), "bin")].filter(Boolean)),
  ) as string[];

  const removed: string[] = [];
  for (const binDir of candidateDirs) {
    for (const commandName of SHIM_COMMANDS) {
      const shimPath = getShimPath(binDir, commandName);
      if (await pathExists(shimPath)) {
        await rm(shimPath, { force: true });
        removed.push(shimPath);
      }
    }
  }

  return { removed, binDir: candidateDirs[0] ?? null };
}

export async function inspectGlobalShims(): Promise<{
  binDir: string | null;
  commands: Array<{ name: string; path: string; exists: boolean }>;
  usedFallback: boolean;
}> {
  const target = await resolveShimBinDir();
  const commands = await Promise.all(
    SHIM_COMMANDS.map(async (commandName) => {
      const shimPath = getShimPath(target.binDir, commandName);
      return {
        name: commandName,
        path: shimPath,
        exists: await pathExists(shimPath),
      };
    }),
  );

  return {
    binDir: target.binDir,
    commands,
    usedFallback: target.usedFallback,
  };
}
